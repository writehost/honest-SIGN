package ru.scada.mobile.core.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import ru.scada.mobile.core.common.AppError
import ru.scada.mobile.core.common.Outcome
import ru.scada.mobile.core.network.http.apiCall
import ru.scada.mobile.core.network.wms.LoginRequest
import ru.scada.mobile.core.network.yms.YmsAuthApi

sealed interface YmsState {
    data object Unknown : YmsState
    data object NotConnected : YmsState
    data class Connected(val login: String, val fio: String) : YmsState
    data class Unreachable(val error: AppError) : YmsState
}

/**
 * Отдельный вход в YMS. Единого входа между WMS и YMS сейчас нет: у YMS своя
 * cookie-сессия на её домене, поэтому пользователь подключает YMS один раз
 * и управляет подключением в профиле.
 */
class YmsConnection(
    private val api: () -> YmsAuthApi,
    private val clearCookies: () -> Unit,
) {
    private val _state = MutableStateFlow<YmsState>(YmsState.Unknown)
    val state: StateFlow<YmsState> = _state.asStateFlow()

    suspend fun connect(login: String, password: String): Outcome<YmsState.Connected> {
        if (login.isBlank() || password.isEmpty()) return Outcome.Err(AppError.BadRequest("Введите логин и пароль"))
        return when (val r = apiCall { api().login(LoginRequest(login.trim(), password)) }) {
            is Outcome.Err -> r
            is Outcome.Ok -> {
                if (!r.value.ok) return Outcome.Err(AppError.Unexpected("YMS не подтвердил вход"))
                val c = YmsState.Connected(r.value.user?.login ?: login.trim(), r.value.user?.fio.orEmpty())
                _state.value = c
                Outcome.Ok(c)
            }
        }
    }

    suspend fun check() {
        _state.value = when (val r = apiCall { api().me() }) {
            is Outcome.Ok -> if (r.value.login.isBlank()) YmsState.NotConnected else YmsState.Connected(r.value.login, r.value.fio)
            is Outcome.Err -> if (r.error is AppError.Unauthorized) YmsState.NotConnected else YmsState.Unreachable(r.error)
        }
    }

    suspend fun disconnect() {
        apiCall { api().logout() }
        clearCookies()
        _state.value = YmsState.NotConnected
    }
}
