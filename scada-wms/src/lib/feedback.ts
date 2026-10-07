// Scan feedback: a short beep + buzz the storekeeper feels without looking at the screen.

let ctx: AudioContext | null = null
let prefs = { sound: true, vibration: true }

export function setFeedbackPrefs(p: { sound: boolean; vibration: boolean }) {
  prefs = p
}

function tone(freqs: number[], dur: number, type: OscillatorType, gain = 0.08) {
  if (!prefs.sound) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    let t = ctx.currentTime
    for (const f of freqs) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.value = f
      g.gain.setValueAtTime(gain, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + dur)
      t += dur * 0.9
    }
  } catch {
    /* audio unavailable */
  }
}

function buzz(pattern: number | number[]) {
  if (prefs.vibration && 'vibrate' in navigator) navigator.vibrate(pattern)
}

export const feedback = {
  ok() {
    tone([1568], 0.08, 'square', 0.05)
    buzz(35)
  },
  done() {
    tone([1318, 1760], 0.09, 'square', 0.05)
    buzz([35, 40, 35])
  },
  warn() {
    tone([660, 660], 0.12, 'triangle', 0.09)
    buzz([80, 60, 80])
  },
  error() {
    tone([196, 147], 0.22, 'sawtooth', 0.09)
    buzz([160, 80, 160, 80, 160])
  },
}
