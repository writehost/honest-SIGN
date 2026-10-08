package ru.scada.mobile.core.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Цвета — действующие токены SCADA System WMS (`scada_system/app/globals.css`,
 * :root и .dark), пересчитанные из oklch в sRGB. Не подбирать на глаз:
 * при смене токенов в основном WMS пересчитать здесь.
 */
@Immutable
data class ScadaColors(
    val background: Color,
    val surface: Color,
    val surfaceMuted: Color,
    val surfaceAccent: Color,
    val onSurface: Color,
    val onSurfaceMuted: Color,
    val border: Color,
    val input: Color,
    val primary: Color,
    /** Нижняя точка фирменного градиента основной кнопки. */
    val primaryDeep: Color,
    val onPrimary: Color,
    val success: Color,
    val warning: Color,
    val onWarning: Color,
    val error: Color,
    val isDark: Boolean,
)

val LightScadaColors = ScadaColors(
    background = Color(0xFFF4F2EA),
    surface = Color(0xFFFDFDFD),
    surfaceMuted = Color(0xFFEAE4D6),
    surfaceAccent = Color(0xFFF0EBDC),
    onSurface = Color(0xFF152715),
    onSurfaceMuted = Color(0xFF4F584F),
    border = Color(0xFFDCD7C9),
    input = Color(0xFFEAE4D6),
    primary = Color(0xFFC5D424),
    primaryDeep = Color(0xFFA7B81A),
    onPrimary = Color(0xFF152715),
    success = Color(0xFF3A9742),
    warning = Color(0xFFE48233),
    onWarning = Color(0xFF412714),
    error = Color(0xFFCC272E),
    isDark = false,
)

val DarkScadaColors = ScadaColors(
    background = Color(0xFF0C140C),
    surface = Color(0xFF151D15),
    surfaceMuted = Color(0xFF1E271E),
    surfaceAccent = Color(0xFF1A231A),
    onSurface = Color(0xFFF1EEE7),
    onSurfaceMuted = Color(0xFF9C978A),
    border = Color(0xFF283128),
    input = Color(0xFF1E271E),
    primary = Color(0xFFC5D424),
    primaryDeep = Color(0xFFA7B81A),
    onPrimary = Color(0xFF091B0A),
    success = Color(0xFF4AA651),
    warning = Color(0xFFF59145),
    onWarning = Color(0xFF341A07),
    error = Color(0xFFE0474D),
    isDark = true,
)

private fun ScadaColors.toMaterial(): ColorScheme {
    val base = if (isDark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = primary,
        onPrimary = onPrimary,
        primaryContainer = surfaceAccent,
        onPrimaryContainer = onSurface,
        secondary = onSurfaceMuted,
        onSecondary = surface,
        secondaryContainer = surfaceMuted,
        onSecondaryContainer = onSurface,
        background = background,
        onBackground = onSurface,
        surface = surface,
        onSurface = onSurface,
        surfaceVariant = surfaceMuted,
        onSurfaceVariant = onSurfaceMuted,
        surfaceContainer = surface,
        surfaceContainerLow = background,
        surfaceContainerHigh = surface,
        outline = border,
        outlineVariant = border,
        error = error,
        onError = Color.White,
    )
}

/** Радиусы основного WMS: --radius = 1rem → sm 12, md 14, lg 16, xl 20. */
object ScadaRadius {
    val sm = 12.dp
    val md = 14.dp
    val lg = 16.dp
    val xl = 20.dp
}

object ScadaSpacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 24.dp
    val xxl = 32.dp
    /** Минимальная высота касания для работы в перчатках. */
    val touch = 52.dp
}

private val ScadaShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(ScadaRadius.sm),
    medium = RoundedCornerShape(ScadaRadius.md),
    large = RoundedCornerShape(ScadaRadius.lg),
    extraLarge = RoundedCornerShape(ScadaRadius.xl),
)

private val Sans = FontFamily.SansSerif

/** Плотная иерархия: тело 15–17 sp, заголовки 20–28 sp. */
private val ScadaTypography = Typography(
    displaySmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 34.sp, letterSpacing = (-0.4).sp),
    headlineMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 30.sp, letterSpacing = (-0.3).sp),
    headlineSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 26.sp),
    titleLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 21.sp),
    bodySmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.6.sp),
)

val LocalScadaColors = staticCompositionLocalOf { LightScadaColors }

enum class ThemeMode { System, Light, Dark }

@Composable
fun ScadaTheme(mode: ThemeMode = ThemeMode.System, content: @Composable () -> Unit) {
    val dark = when (mode) {
        ThemeMode.System -> isSystemInDarkTheme()
        ThemeMode.Light -> false
        ThemeMode.Dark -> true
    }
    val colors = if (dark) DarkScadaColors else LightScadaColors
    CompositionLocalProvider(LocalScadaColors provides colors) {
        MaterialTheme(colorScheme = colors.toMaterial(), typography = ScadaTypography, shapes = ScadaShapes, content = content)
    }
}

object Scada {
    val colors: ScadaColors
        @Composable get() = LocalScadaColors.current
}
