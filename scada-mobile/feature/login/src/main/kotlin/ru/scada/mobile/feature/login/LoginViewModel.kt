package ru.scada.mobile.feature.login

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.scada.mobile.core.common.AppInfo
import ru.scada.mobile.core.common.Outcome
import ru.scada.mobile.core.data.AuthRepository
import ru.scada.mobile.core.data.AuthState
import javax.inject.Inject

data class LoginUiState(
    val login: String = "",
    val password: String = "",
    val remember: Boolean = true,
    val loading: Boolean = false,
    val error: String? = null,
    val notice: String? = null,
    val version: String = "",
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val auth: AuthRepository,
    appInfo: AppInfo,
    private val saved: SavedStateHandle,
) : ViewModel() {
    private val _state = MutableStateFlow(
        LoginUiState(
            // Пароль в SavedStateHandle не кладём — только логин.
            login = saved.get<String>(KEY_LOGIN).orEmpty(),
            version = "${appInfo.versionName} (${appInfo.versionCode})",
            notice = when ((auth.state.value as? AuthState.SignedOut)?.reason) {
                AuthState.SignedOut.Reason.Expired -> "Сессия истекла. Войдите снова."
                else -> null
            },
        ),
    )
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onLogin(v: String) {
        saved[KEY_LOGIN] = v
        _state.update { it.copy(login = v, error = null) }
    }

    fun onPassword(v: String) = _state.update { it.copy(password = v, error = null) }
    fun onRemember(v: Boolean) = _state.update { it.copy(remember = v) }

    fun submit() {
        val s = _state.value
        if (s.loading) return
        if (s.login.isBlank() || s.password.isEmpty()) {
            _state.update { it.copy(error = "Введите логин и пароль") }
            return
        }
        _state.update { it.copy(loading = true, error = null, notice = null) }
        viewModelScope.launch {
            when (val r = auth.login(s.login, s.password, s.remember)) {
                // Навигацию на рабочее пространство делает AppNavHost по AuthState.SignedIn.
                is Outcome.Ok -> _state.update { it.copy(loading = false, password = "") }
                is Outcome.Err -> _state.update { it.copy(loading = false, error = r.error.userMessage) }
            }
        }
    }

    private companion object {
        const val KEY_LOGIN = "login"
    }
}
