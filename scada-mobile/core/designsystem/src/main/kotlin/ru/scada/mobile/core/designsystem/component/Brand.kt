package ru.scada.mobile.core.designsystem.component

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ru.scada.mobile.core.designsystem.R
import ru.scada.mobile.core.designsystem.theme.Scada

/** Логотип SCADA System (тот же файл, что в сайдбаре основного WMS). */
@Composable
fun ScadaLogo(size: Dp, modifier: Modifier = Modifier) {
    Image(painterResource(R.drawable.scada_logo), contentDescription = "SCADA System", modifier = modifier.size(size))
}

/**
 * Рамка наведения сканера: затемнение вокруг окна, уголки фирменного цвета,
 * по `success` уголки и рамка вспыхивают зелёным.
 */
@Composable
fun ScadaScannerOverlay(modifier: Modifier = Modifier, success: Boolean = false, windowFraction: Float = 0.72f) {
    val c = Scada.colors
    Canvas(modifier.graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }) {
        val side = size.width * windowFraction
        val left = (size.width - side) / 2
        val top = (size.height - side) / 2.4f
        val r = 22.dp.toPx()
        drawRect(Color.Black.copy(alpha = 0.55f))
        drawRoundRect(Color.Black, Offset(left, top), Size(side, side), CornerRadius(r), blendMode = BlendMode.Clear)
        val color = if (success) c.success else c.primary
        val len = side * 0.16f
        val w = 5.dp.toPx()
        val frame = Rect(left, top, left + side, top + side)
        val p = Path().apply {
            moveTo(frame.left, frame.top + len); lineTo(frame.left, frame.top + r); quadraticTo(frame.left, frame.top, frame.left + r, frame.top); lineTo(frame.left + len, frame.top)
            moveTo(frame.right - len, frame.top); lineTo(frame.right - r, frame.top); quadraticTo(frame.right, frame.top, frame.right, frame.top + r); lineTo(frame.right, frame.top + len)
            moveTo(frame.right, frame.bottom - len); lineTo(frame.right, frame.bottom - r); quadraticTo(frame.right, frame.bottom, frame.right - r, frame.bottom); lineTo(frame.right - len, frame.bottom)
            moveTo(frame.left + len, frame.bottom); lineTo(frame.left + r, frame.bottom); quadraticTo(frame.left, frame.bottom, frame.left, frame.bottom - r); lineTo(frame.left, frame.bottom - len)
        }
        drawPath(p, color, style = Stroke(width = w, cap = StrokeCap.Round))
        if (success) drawRoundRect(color.copy(alpha = 0.9f), Offset(left, top), Size(side, side), CornerRadius(r), style = Stroke(2.dp.toPx()))
    }
}
