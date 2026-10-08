package ru.scada.mobile.core.designsystem.component

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.PathParser
import ru.scada.mobile.core.designsystem.theme.Scada

/**
 * Монохромная промышленная панорама: склад, резервуары, цех, конвейер, силосы,
 * погрузчик, стеллажный склад. Векторные пути (~2.5 КБ), без растров и WebView.
 * Окна и ворота вырезаются BlendMode.Clear, верх плавно растворяется в фон —
 * поэтому один ресурс работает и в светлой, и в тёмной теме.
 */
@Composable
fun IndustrialPanorama(modifier: Modifier = Modifier, tint: Color = Scada.colors.onSurface, alpha: Float = 0.16f) {
    val body = remember { PathParser().parsePathString(BODY).toPath() }
    val cuts = remember { PathParser().parsePathString(CUTS).toPath() }
    Canvas(
        modifier
            .aspectRatio(WIDTH / HEIGHT)
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen },
    ) {
        val k = size.width / WIDTH
        scale(k, k, pivot = Offset.Zero) {
            drawPath(body, tint.copy(alpha = alpha))
            drawPath(cuts, Color.Black, blendMode = BlendMode.Clear)
        }
        // Fade: верх силуэта растворяется в фон экрана
        drawRect(
            Brush.verticalGradient(0f to Color.Transparent, 0.62f to Color.Black, startY = 0f, endY = size.height),
            blendMode = BlendMode.DstIn,
        )
    }
}

private const val WIDTH = 1200f
private const val HEIGHT = 260f
private const val BODY = "M0,244h1200v16h-1200z M14,168h250v76h-250z M14,168 L14,142 L64,168z M64,168 L64,142 L114,168z M114,168 L114,142 L164,168z M164,168 L164,142 L214,168z M214,168 L214,142 L264,168z M278,120h44v124h-44z M278,120a22,10 0 0,1 44,0z M330,104h44v140h-44z M330,104a22,10 0 0,1 44,0z M274,176h104v5h-104z M394,190h12v54h-12z M380,184h40v8h-40z M430,150h240v94h-240z M470,132h120v18h-120z M612,58h16v92h-16z M642,78h14v72h-14z M452,92h12v58h-12z M430,150 L470,132 L470,150z M590,132 L670,150 L590,150z M680,236 L684,240 L862,118 L858,114z M690,236.0h3v8.0h-3z M711,221.5h3v22.5h-3z M732,207.0h3v37.0h-3z M753,192.5h3v51.5h-3z M774,178.0h3v66.0h-3z M795,163.5h3v80.5h-3z M816,149.0h3v95.0h-3z M837,134.5h3v109.5h-3z M846,102h30v16h-30z M880,96h32v128h-32z M880,224 L912,224 L902,238 L890,238z M880,96a16,9 0 0,1 32,0z M916,96h32v128h-32z M916,224 L948,224 L938,238 L926,238z M916,96a16,9 0 0,1 32,0z M876,236h76v8h-76z M970,170a30,30 0 1,0 60,0a30,30 0 1,0 -60,0z M976,188h6v56h-6z M1018,188h6v56h-6z M1032,214h44v22h-44z M1040,192h4v24h-4z M1062,192h4v24h-4z M1038,190h30v4h-30z M1076,176h5v60h-5z M1081,230h22v4h-22z M1083,206h20v24h-20z M1036,238a6,6 0 1,0 12,0a6,6 0 1,0 -12,0z M1062,238a6,6 0 1,0 12,0a6,6 0 1,0 -12,0z M1112,124h82v120h-82z M1108,124 L1153,104 L1198,124z"
private const val CUTS = "M38,200h36v44h-36z M94,200h36v44h-36z M150,200h36v44h-36z M206,200h36v44h-36z M446,170h20v10h-20z M478,170h20v10h-20z M510,170h20v10h-20z M542,170h20v10h-20z M574,170h20v10h-20z M606,170h20v10h-20z M638,170h20v10h-20z M446,196h20v10h-20z M478,196h20v10h-20z M510,196h20v10h-20z M542,196h20v10h-20z M574,196h20v10h-20z M606,196h20v10h-20z M638,196h20v10h-20z M600,206h44v38h-44z M278,148h44v3h-44z M278,180h44v3h-44z M330,132h44v3h-44z M330,164h44v3h-44z M1120,140h7v94h-7z M1135,140h7v94h-7z M1150,140h7v94h-7z M1165,140h7v94h-7z M1180,140h7v94h-7z"
