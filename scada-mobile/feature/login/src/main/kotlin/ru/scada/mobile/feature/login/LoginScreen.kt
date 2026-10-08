package ru.scada.mobile.feature.login

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import ru.scada.mobile.core.designsystem.component.IndustrialPanorama
import ru.scada.mobile.core.designsystem.component.ScadaButtonFull
import ru.scada.mobile.core.designsystem.component.ScadaLogo
import ru.scada.mobile.core.designsystem.component.ScadaTextField
import ru.scada.mobile.core.designsystem.theme.Scada
import ru.scada.mobile.core.designsystem.theme.ScadaRadius
import ru.scada.mobile.core.designsystem.theme.ScadaSpacing

@Composable
fun LoginRoute(viewModel: LoginViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LoginScreen(state, viewModel::onLogin, viewModel::onPassword, viewModel::onRemember, viewModel::submit)
}

/**
 * Вход в SCADA. Последовательное появление: логотип → название →
 * форма поднимается → панорама проявляется снизу. Без бесконечных эффектов.
 */
@Composable
fun LoginScreen(
    state: LoginUiState,
    onLogin: (String) -> Unit,
    onPassword: (String) -> Unit,
    onRemember: (Boolean) -> Unit,
    onSubmit: () -> Unit,
) {
    val c = Scada.colors
    val focus = LocalFocusManager.current
    val passwordFocus = remember { FocusRequester() }
    val rise = with(LocalDensity.current) { 28.dp.toPx() }

    val logo = remember { Animatable(0f) }
    val title = remember { Animatable(0f) }
    val form = remember { Animatable(0f) }
    val skyline = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        launch { logo.animateTo(1f, tween(520, easing = FastOutSlowInEasing)) }
        launch { title.animateTo(1f, tween(480, delayMillis = 160, easing = FastOutSlowInEasing)) }
        launch { form.animateTo(1f, tween(560, delayMillis = 300, easing = FastOutSlowInEasing)) }
        launch { skyline.animateTo(1f, tween(900, delayMillis = 420, easing = FastOutSlowInEasing)) }
    }

    Box(Modifier.fillMaxSize().background(c.background)) {
        // 4. Панорама снизу, растворяется в фон
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding()
                .graphicsLayer { alpha = skyline.value; translationY = (1f - skyline.value) * rise },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            IndustrialPanorama(Modifier.fillMaxWidth(), alpha = if (c.isDark) 0.22f else 0.16f)
            Text(
                "SCADA SYSTEM — CONNECTED INDUSTRY",
                style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 2.4.sp),
                color = c.onSurfaceMuted.copy(alpha = 0.7f),
                modifier = Modifier.padding(top = 6.dp, bottom = ScadaSpacing.lg),
            )
        }

        Column(
            Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState())
                .padding(horizontal = ScadaSpacing.xl),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(56.dp))
            // 1. Логотип
            ScadaLogo(
                88.dp,
                Modifier.graphicsLayer {
                    alpha = logo.value
                    val s = 0.86f + 0.14f * logo.value
                    scaleX = s; scaleY = s
                },
            )
            Spacer(Modifier.height(ScadaSpacing.lg))
            // 2. Название
            Column(
                Modifier.graphicsLayer { alpha = title.value; translationY = (1f - title.value) * rise / 2 },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("SCADA Mobile", style = MaterialTheme.typography.displaySmall, color = c.onSurface)
                Spacer(Modifier.height(4.dp))
                Text("Единая промышленная платформа", style = MaterialTheme.typography.bodyLarge, color = c.onSurfaceMuted)
            }
            Spacer(Modifier.height(ScadaSpacing.xxl))

            // 3. Форма поднимается
            Column(
                Modifier.widthIn(max = 440.dp).fillMaxWidth()
                    .graphicsLayer { alpha = form.value; translationY = (1f - form.value) * rise },
                verticalArrangement = Arrangement.spacedBy(ScadaSpacing.md),
            ) {
                AnimatedVisibility(state.notice != null, enter = fadeIn() + expandVertically(), exit = fadeOut() + shrinkVertically()) {
                    Banner(state.notice.orEmpty(), error = false)
                }
                ScadaTextField(
                    value = state.login,
                    onValueChange = onLogin,
                    label = "Логин",
                    leadingIcon = Icons.Outlined.Person,
                    enabled = !state.loading,
                    imeAction = ImeAction.Next,
                    onIme = { passwordFocus.requestFocus() },
                )
                ScadaTextField(
                    value = state.password,
                    onValueChange = onPassword,
                    label = "Пароль",
                    leadingIcon = Icons.Outlined.Lock,
                    password = true,
                    enabled = !state.loading,
                    imeAction = ImeAction.Done,
                    onIme = { focus.clearFocus(); onSubmit() },
                    modifier = Modifier.focusRequester(passwordFocus),
                )
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Checkbox(
                        checked = state.remember,
                        onCheckedChange = onRemember,
                        enabled = !state.loading,
                        colors = CheckboxDefaults.colors(checkedColor = c.primaryDeep, checkmarkColor = c.onPrimary, uncheckedColor = c.border),
                    )
                    Text("Запомнить вход", style = MaterialTheme.typography.bodyMedium, color = c.onSurface)
                }
                AnimatedVisibility(state.error != null, enter = fadeIn() + expandVertically(), exit = fadeOut() + shrinkVertically()) {
                    Banner(state.error.orEmpty(), error = true)
                }
                // 5. Кнопка реагирует на нажатие (сжатие в ScadaButton)
                ScadaButtonFull(
                    text = "Войти в SCADA",
                    onClick = { focus.clearFocus(); onSubmit() },
                    loading = state.loading,
                )
                Text(
                    "Версия ${state.version}",
                    style = MaterialTheme.typography.bodySmall,
                    color = c.onSurfaceMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = ScadaSpacing.sm),
                )
            }
            Spacer(Modifier.height(220.dp))
        }
    }
}

@Composable
private fun Banner(text: String, error: Boolean) {
    val c = Scada.colors
    Text(
        text,
        style = MaterialTheme.typography.bodyMedium,
        color = if (error) c.error else c.onSurface,
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(ScadaRadius.sm))
            .background(if (error) c.error.copy(alpha = 0.08f) else c.surfaceAccent)
            .padding(horizontal = ScadaSpacing.md, vertical = ScadaSpacing.sm + 2.dp),
    )
}
