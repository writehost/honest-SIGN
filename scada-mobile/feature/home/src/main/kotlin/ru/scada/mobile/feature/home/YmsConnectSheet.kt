package ru.scada.mobile.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.text.input.ImeAction
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.scada.mobile.core.data.YmsState
import ru.scada.mobile.core.designsystem.component.ScadaBottomSheet
import ru.scada.mobile.core.designsystem.component.ScadaButtonFull
import ru.scada.mobile.core.designsystem.component.ScadaButtonStyle
import ru.scada.mobile.core.designsystem.component.ScadaTextField
import ru.scada.mobile.core.designsystem.theme.Scada
import ru.scada.mobile.core.designsystem.theme.ScadaSpacing

/** Однократное подключение YMS: отдельная cookie-сессия на yms.scadasystem.io. */
@Composable
fun YmsConnectSheet(onDismiss: () -> Unit, viewModel: YmsConnectViewModel = hiltViewModel()) {
    val s by viewModel.state.collectAsStateWithLifecycle()
    val yms by viewModel.ymsState.collectAsStateWithLifecycle()
    val c = Scada.colors
    ScadaBottomSheet(onDismiss, title = "YMS — Территория") {
        Column(verticalArrangement = Arrangement.spacedBy(ScadaSpacing.md)) {
            val connected = yms as? YmsState.Connected
            if (connected != null) {
                Text("Подключено как ${connected.login}${connected.fio.takeIf { it.isNotBlank() }?.let { " ($it)" }.orEmpty()}.", style = MaterialTheme.typography.bodyLarge, color = c.onSurface)
                ScadaButtonFull("Отключить YMS", { viewModel.disconnect(); onDismiss() }, style = ScadaButtonStyle.Danger)
            } else {
                Text(
                    "У YMS своя сессия: единого входа с WMS пока нет. Войдите один раз той же учётной записью — подключением можно управлять в профиле.",
                    style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceMuted,
                )
                ScadaTextField(s.login, viewModel::onLogin, "Логин", leadingIcon = Icons.Outlined.Person, enabled = !s.loading)
                ScadaTextField(s.password, viewModel::onPassword, "Пароль", leadingIcon = Icons.Outlined.Lock, password = true, enabled = !s.loading, error = s.error, imeAction = ImeAction.Done, onIme = { viewModel.connect(onDismiss) })
                ScadaButtonFull("Подключить YMS", { viewModel.connect(onDismiss) }, loading = s.loading)
            }
        }
    }
}
