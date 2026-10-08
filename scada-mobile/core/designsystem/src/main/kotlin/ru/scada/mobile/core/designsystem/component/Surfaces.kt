package ru.scada.mobile.core.designsystem.component

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ru.scada.mobile.core.common.AppError
import ru.scada.mobile.core.designsystem.theme.Scada
import ru.scada.mobile.core.designsystem.theme.ScadaRadius
import ru.scada.mobile.core.designsystem.theme.ScadaSpacing

/** Белая рабочая поверхность с тонкой тёплой рамкой — как `.wms-panel` основного WMS. */
@Composable
fun ScadaCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    accent: Color? = null,
    padding: Dp = ScadaSpacing.lg,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = Scada.colors
    val shape = RoundedCornerShape(ScadaRadius.lg)
    val body: @Composable () -> Unit = {
        Row(Modifier.height(IntrinsicSize.Min)) {
            if (accent != null) Box(Modifier.width(4.dp).fillMaxHeight().background(accent))
            Column(Modifier.padding(padding).animateContentSize(), content = content)
        }
    }
    if (onClick != null) {
        Surface(onClick = onClick, modifier = modifier, shape = shape, color = c.surface, border = BorderStroke(1.dp, c.border), shadowElevation = 0.5.dp) { body() }
    } else {
        Surface(modifier = modifier, shape = shape, color = c.surface, border = BorderStroke(1.dp, c.border), shadowElevation = 0.5.dp) { body() }
    }
}

enum class StatusTone { Neutral, Active, Success, Warning, Error }

/** Статус: нейтральный бейдж с цветной точкой — как статусы основного WMS. */
@Composable
fun ScadaStatusBadge(text: String, tone: StatusTone, modifier: Modifier = Modifier) {
    val c = Scada.colors
    val dot = when (tone) {
        StatusTone.Neutral -> c.onSurfaceMuted.copy(alpha = 0.5f)
        StatusTone.Active -> c.primaryDeep
        StatusTone.Success -> c.success
        StatusTone.Warning -> c.warning
        StatusTone.Error -> c.error
    }
    Row(
        modifier
            .clip(RoundedCornerShape(8.dp))
            .background(c.background)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(dot))
        Text(text, style = MaterialTheme.typography.labelMedium, color = if (tone == StatusTone.Error) c.error else c.onSurface, maxLines = 1)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScadaTopBar(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null, actions: @Composable () -> Unit = {}) {
    val c = Scada.colors
    TopAppBar(
        title = {
            Column {
                Text(title, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = c.onSurfaceMuted, maxLines = 1)
            }
        },
        navigationIcon = {
            if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад") }
        },
        actions = { actions() },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = c.surface, titleContentColor = c.onSurface, navigationIconContentColor = c.onSurface),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScadaBottomSheet(onDismiss: () -> Unit, title: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val c = Scada.colors
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = c.surface,
        shape = RoundedCornerShape(topStart = ScadaRadius.xl, topEnd = ScadaRadius.xl),
    ) {
        Column(Modifier.padding(horizontal = ScadaSpacing.xl).padding(bottom = ScadaSpacing.xxl)) {
            if (title != null) {
                Text(title, style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(ScadaSpacing.lg))
            }
            content()
        }
    }
}

/**
 * Карточка сервиса экосистемы. `available = false` — сервис показан честно
 * неактивным (нет прав или нет подтверждённого API), а не «рабочей» кнопкой.
 */
@Composable
fun ScadaModuleCard(
    code: String,
    title: String,
    icon: ImageVector,
    note: String,
    modifier: Modifier = Modifier,
    available: Boolean = true,
    onClick: () -> Unit,
) {
    val c = Scada.colors
    ScadaCard(modifier = modifier.alpha(if (available) 1f else 0.62f), onClick = if (available) onClick else null, padding = ScadaSpacing.md) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(42.dp).clip(RoundedCornerShape(ScadaRadius.sm)).background(if (available) c.primary else c.surfaceMuted),
                contentAlignment = Alignment.Center,
            ) { Icon(if (available) icon else Icons.Outlined.Lock, contentDescription = null, tint = if (available) c.onPrimary else c.onSurfaceMuted) }
            Spacer(Modifier.width(ScadaSpacing.md))
            Column(Modifier.weight(1f)) {
                Text(code, style = MaterialTheme.typography.labelSmall, color = c.onSurfaceMuted)
                Text(title, style = MaterialTheme.typography.titleMedium, color = c.onSurface)
                Text(note, style = MaterialTheme.typography.bodySmall, color = c.onSurfaceMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** Карточка задания: номер, тип, маршрут «откуда → куда», приоритет и крупное действие. */
@Composable
fun ScadaTaskCard(
    number: String,
    title: String,
    status: @Composable () -> Unit,
    lines: List<Pair<String, String>>,
    modifier: Modifier = Modifier,
    urgent: Boolean = false,
    action: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null,
) {
    val c = Scada.colors
    ScadaCard(modifier = modifier, onClick = onClick, accent = if (urgent) c.warning else null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(number, style = MaterialTheme.typography.labelMedium, color = c.onSurfaceMuted)
                Text(title, style = MaterialTheme.typography.titleLarge, color = c.onSurface)
            }
            status()
        }
        if (lines.isNotEmpty()) {
            Spacer(Modifier.height(ScadaSpacing.md))
            lines.forEach { (k, v) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                    Text(k, style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceMuted, modifier = Modifier.width(96.dp))
                    Text(v, style = MaterialTheme.typography.bodyMedium, color = c.onSurface, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        if (action != null) {
            Spacer(Modifier.height(ScadaSpacing.md))
            action()
        }
    }
}

@Composable
fun ScadaEmptyState(title: String, text: String? = null, icon: ImageVector = Icons.Outlined.Inbox, action: (@Composable () -> Unit)? = null) {
    StateBlock(icon, Scada.colors.onSurfaceMuted, title, text, action)
}

@Composable
fun ScadaErrorState(error: AppError, onRetry: (() -> Unit)?) {
    val c = Scada.colors
    val offline = error is AppError.NoNetwork || error is AppError.Timeout
    StateBlock(
        icon = if (offline) Icons.Outlined.CloudOff else Icons.Outlined.ErrorOutline,
        tint = if (offline) c.onSurfaceMuted else c.error,
        title = if (offline) "Нет связи" else "Не удалось загрузить",
        text = error.userMessage,
        action = onRetry?.let { { ScadaButton("Повторить", it, style = ScadaButtonStyle.Secondary, large = false) } },
    )
}

@Composable
private fun StateBlock(icon: ImageVector, tint: Color, title: String, text: String?, action: (@Composable () -> Unit)?) {
    val c = Scada.colors
    Column(Modifier.fillMaxWidth().padding(ScadaSpacing.xxl), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(40.dp))
        Spacer(Modifier.height(ScadaSpacing.md))
        Text(title, style = MaterialTheme.typography.titleMedium, color = c.onSurface, textAlign = TextAlign.Center)
        if (text != null) {
            Spacer(Modifier.height(ScadaSpacing.xs))
            Text(text, style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceMuted, textAlign = TextAlign.Center)
        }
        if (action != null) {
            Spacer(Modifier.height(ScadaSpacing.lg))
            action()
        }
    }
}

/** Скелетон: мягкое мерцание вместо спиннера в списках. */
@Composable
fun ScadaLoadingState(rows: Int = 3, modifier: Modifier = Modifier) {
    val c = Scada.colors
    val t = rememberInfiniteTransition(label = "skeleton")
    val a by t.animateFloat(0.45f, 0.9f, infiniteRepeatable(tween(850), RepeatMode.Reverse), label = "a")
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(ScadaSpacing.md)) {
        repeat(rows) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(ScadaRadius.lg)).background(c.surface).padding(ScadaSpacing.lg),
                verticalArrangement = Arrangement.spacedBy(ScadaSpacing.sm),
            ) {
                Box(Modifier.fillMaxWidth(0.35f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(c.surfaceMuted.copy(alpha = a)))
                Box(Modifier.fillMaxWidth(0.7f).height(18.dp).clip(RoundedCornerShape(6.dp)).background(c.surfaceMuted.copy(alpha = a)))
                Box(Modifier.fillMaxWidth(0.5f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(c.surfaceMuted.copy(alpha = a)))
            }
        }
    }
}

@Composable
fun ScadaFullscreenLoading() {
    Box(Modifier.fillMaxSize().background(Scada.colors.background), contentAlignment = Alignment.Center) {
        androidx.compose.material3.CircularProgressIndicator(color = Scada.colors.primaryDeep)
    }
}
