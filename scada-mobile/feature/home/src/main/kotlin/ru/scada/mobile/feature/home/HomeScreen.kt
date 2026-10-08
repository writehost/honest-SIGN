package ru.scada.mobile.feature.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Factory
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.PhonelinkSetup
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material.icons.outlined.Warehouse
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.scada.mobile.core.common.YmsPermission
import ru.scada.mobile.core.data.YmsState
import ru.scada.mobile.core.designsystem.component.ScadaButton
import ru.scada.mobile.core.designsystem.component.ScadaButtonFull
import ru.scada.mobile.core.designsystem.component.ScadaButtonStyle
import ru.scada.mobile.core.designsystem.component.ScadaCard
import ru.scada.mobile.core.designsystem.component.ScadaModuleCard
import ru.scada.mobile.core.designsystem.component.ScadaStatusBadge
import ru.scada.mobile.core.designsystem.component.StatusTone
import ru.scada.mobile.core.designsystem.theme.Scada
import ru.scada.mobile.core.designsystem.theme.ScadaRadius
import ru.scada.mobile.core.designsystem.theme.ScadaSpacing
import java.time.LocalTime

@Composable
fun HomeRoute(onEnrollDevice: () -> Unit, viewModel: HomeViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var ymsSheet by rememberSaveable { mutableStateOf(false) }
    HomeScreen(state, onEnrollDevice, onConnectYms = { ymsSheet = true }, onLogout = viewModel::logout)
    if (ymsSheet) YmsConnectSheet(onDismiss = { ymsSheet = false })
}

private fun greeting(): String = when (LocalTime.now().hour) {
    in 5..11 -> "Доброе утро"
    in 12..17 -> "Добрый день"
    in 18..22 -> "Добрый вечер"
    else -> "Доброй ночи"
}

@Composable
fun HomeScreen(state: HomeUiState, onEnrollDevice: () -> Unit, onConnectYms: () -> Unit, onLogout: () -> Unit) {
    val c = Scada.colors
    val user = state.user
    LazyColumn(
        Modifier.fillMaxSize().background(c.background).statusBarsPadding(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(ScadaSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(ScadaSpacing.md),
    ) {
        item {
            Column(Modifier.padding(top = ScadaSpacing.md, bottom = ScadaSpacing.sm)) {
                Text("${greeting()}!", style = MaterialTheme.typography.displaySmall, color = c.onSurface)
                Text(user?.fio.orEmpty(), style = MaterialTheme.typography.titleLarge, color = c.onSurface)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ScadaSpacing.sm), modifier = Modifier.padding(top = 6.dp)) {
                    user?.position?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceMuted) }
                    Text(
                        "Площадка: ${state.siteCode}",
                        style = MaterialTheme.typography.labelMedium,
                        color = c.onSurface,
                        modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(c.surfaceAccent).padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }
        }
        item {
            AnimatedVisibility(state.offline) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(ScadaRadius.md)).background(c.warning.copy(alpha = 0.12f)).padding(ScadaSpacing.md),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.CloudOff, contentDescription = null, tint = c.onWarning)
                    Spacer(Modifier.padding(4.dp))
                    Text("Нет связи с WMS. Показаны сохранённые данные сессии.", style = MaterialTheme.typography.bodyMedium, color = c.onSurface)
                }
            }
        }
        item { DeviceCard(state, onEnrollDevice) }
        item {
            Text("Сервисы", style = MaterialTheme.typography.labelSmall, color = c.onSurfaceMuted, modifier = Modifier.padding(top = ScadaSpacing.sm, start = 4.dp))
        }
        item {
            val sections = listOfNotNull(
                "задания".takeIf { state.wms.tasks }, "приёмка".takeIf { state.wms.receiving },
                "выдача".takeIf { state.wms.issue }, "ревизия".takeIf { state.wms.revision },
            )
            ScadaModuleCard(
                code = "WMS", title = "Склад", icon = Icons.Outlined.Warehouse,
                note = "Доступно по ролям: ${sections.joinToString().ifEmpty { "сканирование и поиск" }}. Экраны склада — следующий этап.",
                available = false, onClick = {},
            )
        }
        item {
            val y = state.ymsState
            val note = when {
                state.yms.isEmpty() -> "Нет ролей YMS у пользователя"
                y is YmsState.Connected -> "Подключено как ${y.login}"
                y is YmsState.Unreachable -> "YMS недоступен: ${y.error.userMessage}"
                else -> "Отдельный вход: нажмите, чтобы подключить"
            }
            ScadaModuleCard("YMS", "Территория", Icons.Outlined.LocalShipping, note, available = YmsPermission.READ in state.yms, onClick = onConnectYms)
        }
        item { ScadaModuleCard("GSMT", "Маркировка", Icons.Outlined.QrCode2, "Декодирование и поиск кодов — этап 6", available = false, onClick = {}) }
        item { ScadaModuleCard("VEKAS", "Производство", Icons.Outlined.Factory, "Партии и агрегация через WMS-адаптер — этап 6", available = false, onClick = {}) }
        item { ScadaModuleCard("QPass", "Оборудование", Icons.Outlined.Verified, "Ожидает действующую документацию API", available = false, onClick = {}) }
        item {
            Spacer(Modifier.height(ScadaSpacing.sm))
            ScadaButtonFull("Выйти", onLogout, style = ScadaButtonStyle.Danger, icon = Icons.AutoMirrored.Outlined.Logout)
        }
    }
}

@Composable
private fun DeviceCard(state: HomeUiState, onEnrollDevice: () -> Unit) {
    val c = Scada.colors
    val d = state.device
    ScadaCard(accent = if (d == null) c.warning else null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.PhonelinkSetup, contentDescription = null, tint = c.onSurface)
            Spacer(Modifier.padding(6.dp))
            Column(Modifier.weight(1f)) {
                Text(if (d == null) "Телефон не подключён к WMS" else d.deviceName ?: d.deviceUid, style = MaterialTheme.typography.titleMedium, color = c.onSurface)
                Text(
                    if (d == null) "Задания ТСД доступны после подключения по коду из веб-WMS (раздел «Терминалы»)." else "${d.deviceUid} · площадка ${d.siteCode}",
                    style = MaterialTheme.typography.bodySmall,
                    color = c.onSurfaceMuted,
                )
            }
            if (d != null) ScadaStatusBadge("Подключён", StatusTone.Success)
        }
        Spacer(Modifier.height(ScadaSpacing.md))
        ScadaButton(if (d == null) "Подключить устройство" else "Подключение", onEnrollDevice, style = if (d == null) ScadaButtonStyle.Primary else ScadaButtonStyle.Secondary, large = false)
    }
}
