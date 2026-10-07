// Camera decoding. Native BarcodeDetector (Chrome on Android — fast, uses the
// platform ML kit) when present; otherwise ZXing in JS (iOS Safari, Firefox).

export type StopFn = () => void

const FORMATS = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'data_matrix', 'upc_a', 'code_39']

interface NativeDetector {
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>
}

export async function startCamera(video: HTMLVideoElement, onCode: (code: string) => void): Promise<StopFn> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  await video.play()

  let stopped = false
  let lastCode = ''
  let lastAt = 0
  const emit = (code: string) => {
    // the same code stays in frame for a while — fire once per 1.5 s
    const t = Date.now()
    if (code === lastCode && t - lastAt < 1500) return
    lastCode = code
    lastAt = t
    onCode(code)
  }

  const stopStream = () => {
    stopped = true
    stream.getTracks().forEach((tr) => tr.stop())
    video.srcObject = null
  }

  const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => NativeDetector }).BarcodeDetector
  if (Native) {
    const det = new Native({ formats: FORMATS })
    const tick = async () => {
      if (stopped) return
      try {
        const res = await det.detect(video)
        if (res[0]?.rawValue) emit(res[0].rawValue)
      } catch { /* frame not ready */ }
      setTimeout(tick, 120)
    }
    void tick()
    return stopStream
  }

  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODE_128, BarcodeFormat.DATA_MATRIX, BarcodeFormat.UPC_A,
  ])
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
  const controls = await reader.decodeFromVideoElement(video, (result) => {
    if (result && !stopped) emit(result.getText())
  })
  return () => {
    controls.stop()
    stopStream()
  }
}

export const cameraSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
