package ru.scada.mobile.core.designsystem.component

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import ru.scada.mobile.core.designsystem.theme.Scada
import ru.scada.mobile.core.designsystem.theme.ScadaRadius
import ru.scada.mobile.core.designsystem.theme.ScadaSpacing

enum class ScadaButtonStyle { Primary, Secondary, Danger, Ghost }

/**
 * Кнопка SCADA. Primary — фирменный лайм с лёгким вертикальным градиентом,
 * Secondary — поверхность с рамкой, Danger — красный текст и рамка (не заливка).
 * Нажатие — короткое пружинное сжатие.
 */
@Composable
fun ScadaButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: ScadaButtonStyle = ScadaButtonStyle.Primary,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    loading: Boolean = false,
    large: Boolean = true,
) {
    val c = Scada.colors
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed && enabled) 0.97f else 1f, spring(stiffness = 900f), label = "press")
    val shape = RoundedCornerShape(if (large) ScadaRadius.md else ScadaRadius.sm)
    val active = enabled && !loading
    val spec: ButtonSpec = when (style) {
        ScadaButtonStyle.Primary -> ButtonSpec(Brush.verticalGradient(listOf(c.primary, c.primaryDeep)), c.onPrimary, null)
        ScadaButtonStyle.Secondary -> ButtonSpec(SolidColor(c.surface), c.onSurface, BorderStroke(1.dp, c.border))
        ScadaButtonStyle.Danger -> ButtonSpec(SolidColor(c.surface), c.error, BorderStroke(1.dp, c.error.copy(alpha = 0.35f)))
        ScadaButtonStyle.Ghost -> ButtonSpec(null, c.onSurface, null)
    }
    val bg = spec.background
    val fg = spec.content
    val border = spec.border
    Box(
        modifier = modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .heightIn(min = if (large) ScadaSpacing.touch else 40.dp)
            .clip(shape)
            .then(if (bg != null) Modifier.background(bg) else Modifier)
            .then(if (border != null) Modifier.border(border, shape) else Modifier)
            .clickable(interactionSource = source, indication = androidx.compose.material3.ripple(), enabled = active, role = Role.Button, onClick = onClick)
            .alpha(if (enabled) 1f else 0.5f)
            .padding(horizontal = ScadaSpacing.xl),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(22.dp), color = fg, strokeWidth = 2.5.dp)
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(ScadaSpacing.sm), verticalAlignment = Alignment.CenterVertically) {
                if (icon != null) Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(20.dp))
                Text(text, style = if (large) MaterialTheme.typography.labelLarge else MaterialTheme.typography.titleSmall, color = fg)
            }
        }
    }
}

private class ButtonSpec(val background: Brush?, val content: Color, val border: BorderStroke?)

@Composable
fun ScadaButtonFull(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, style: ScadaButtonStyle = ScadaButtonStyle.Primary, icon: ImageVector? = null, enabled: Boolean = true, loading: Boolean = false) =
    ScadaButton(text, onClick, modifier.fillMaxWidth(), style, icon, enabled, loading)
