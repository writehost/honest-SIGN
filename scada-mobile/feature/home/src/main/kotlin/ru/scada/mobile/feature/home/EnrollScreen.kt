package ru.scada.mobile.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ru.scada.mobile.core.designsystem.component.ScadaButtonFull
import ru.scada.mobile.core.designsystem.component.ScadaButtonStyle
import ru.scada.mobile.core.designsystem.component.ScadaCard
import ru.scada.mobile.core.designsystem.component.ScadaStatusBadge
import ru.scada.mobile.core.designsystem.component.ScadaTextField
import ru.scada.mobile.core.designsystem.component.ScadaTopBar
import ru.scada.mobile.core.designsystem.component.StatusTone
import ru.scada.mobile.core.designsystem.theme.Scada
import ru.scada.mobile.core.designsystem.theme.ScadaSpacing

@Composable
fun EnrollRoute(onBack: () -> Unit, viewModel: EnrollViewModel = hiltViewModel()) {
    val s by viewModel.state.collectAsStateWithLifecycle()
    val c = Scada.colors
    Scaffold(topBar = { ScadaTopBar("Подключить устройство", onBack = onBack) }, containerColor = c.background) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).imePadding().verticalScroll(rememberScrollState()).padding(ScadaSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(ScadaSpacing.md),
        ) {
            val done = s.done
            if (done != null) {
                ScadaCard {
                    ScadaStatusBadge("Подключено", StatusTone.Success)
                    Text(done.deviceName ?: done.deviceUid, style = MaterialTheme.typography.headlineSmall, color = c.onSurface, modifier = Modifier.padding(top = ScadaSpacing.sm))
                    Text("Идентификатор: ${done.deviceUid}", style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceMuted)
                    Text("Площадка: ${done.siteCode}", style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceMuted)
                }
                Text(
                    "Отключение здесь удаляет токен только на телефоне. Чтобы отозвать доступ устройства, отключите его в веб-WMS → «Терминалы».",
                    style = MaterialTheme.typography.bodySmall, color = c.onSurfaceMuted,
                )
                ScadaButtonFull("Отключить на этом телефоне", { viewModel.forget() }, style = ScadaButtonStyle.Danger)
                ScadaButtonFull("Готово", onBack, style = ScadaButtonStyle.Secondary)
            } else {
                Text(
                    "Откройте веб-WMS → «Терминалы», создайте одноразовый код подключения и введите его здесь. Телефон получит собственный токен устройства — он хранится отдельно от вашей сессии.",
                    style = MaterialTheme.typography.bodyMedium, color = c.onSurface,
                )
                ScadaTextField(s.code, viewModel::onCode, "Код подключения", leadingIcon = Icons.Outlined.Key, keyboardType = KeyboardType.Ascii, enabled = !s.loading, error = s.error)
                ScadaTextField(s.deviceName, viewModel::onName, "Название устройства", leadingIcon = Icons.Outlined.Smartphone, enabled = !s.loading, imeAction = ImeAction.Done, onIme = viewModel::submit)
                ScadaButtonFull("Подключить", viewModel::submit, loading = s.loading, enabled = s.code.isNotBlank())
            }
        }
    }
}
