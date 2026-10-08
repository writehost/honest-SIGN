package ru.scada.mobile.core.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import ru.scada.mobile.core.common.AppError
import ru.scada.mobile.core.common.Outcome
import ru.scada.mobile.core.network.http.TokenProvider
import ru.scada.mobile.core.network.http.apiCall
import ru.scada.mobile.core.network.wms.LoginRequest
import ru.scada.mobile.core.network.wms.WmsAuthApi
import ru.scada.mobile.core.network.wms.WmsUserDto

sealed interface AuthState {
    data object Checking : AuthState
    data class SignedOut(val reason: Reason = Reason.None) : AuthState {
        enum class Reason { None, Expired, LoggedOut }
    }
    /** `offline` — сессия восстановлена из хранилища, но сервер сейчас недоступен для проверки. */
    data class SignedIn(val session: UserSession, val offline: Boolean = false) : AuthState
}

/**
 * Вход в WMS (`POST /api/auth/login`), проверка (`GET /api/auth/me`) и выход.
 * «Запомнить вход» выключен — токен живёт только в памяти процесса.
 */
class AuthRepository(
    private val api: () -> WmsAuthApi,
    private val store: SecureStore<UserSession>,
    private val clock: () -> Long = System::currentTimeMillis,
) : TokenProvider {
    private val _state = MutableStateFlow<AuthState>(AuthState.Checking)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    @Volatile private var memory: UserSession? = null
    @Volatile private var remembered = false

    override fun current(): String? = memory?.takeIf { it.expiresAtMillis > clock() }?.accessToken

    suspend fun login(login: String, password: String, remember: Boolean): Outcome<UserSession> {
        val l = login.trim()
        if (l.isEmpty() || password.isEmpty()) return Outcome.Err(AppError.BadRequest("Введите логин и пароль"))
        return when (val r = apiCall { api().login(LoginRequest(l, password)) }) {
            is Outcome.Err -> r
            is Outcome.Ok -> {
                val token = r.value.accessToken
                val user = r.value.user
                if (!r.value.ok || token.isNullOrBlank() || user == null) {
                    Outcome.Err(AppError.Unexpected("сервер не вернул токен сессии"))
                } else {
                    val ttl = (r.value.expiresIn ?: DEFAULT_TTL_SECONDS) * 1000
                    val session = UserSession(token, clock() + ttl, user.toSessionUser())
                    memory = session
                    remembered = remember
                    if (remember) store.write(session) else store.clear()
                    _state.value = AuthState.SignedIn(session)
                    Outcome.Ok(session)
                }
            }
        }
    }

    /** Запуск приложения: сохранённая сессия → проверка на сервере. */
    suspend fun restore() {
        val saved = store.read()
        if (saved == null) { _state.value = AuthState.SignedOut(); return }
        if (saved.expiresAtMillis <= clock()) {
            store.clear()
            _state.value = AuthState.SignedOut(AuthState.SignedOut.Reason.Expired)
            return
        }
        memory = saved
        remembered = true
        refresh()
    }

    /** Обновляет профиль и роли из `/api/auth/me`. */
    suspend fun refresh() {
        val s = memory ?: return
        when (val r = apiCall { api().me() }) {
            is Outcome.Ok -> {
                val u = r.value.user
                if (u == null) { expire(); return }
                val updated = s.copy(user = u.toSessionUser())
                memory = updated
                if (remembered) store.write(updated)
                _state.value = AuthState.SignedIn(updated)
            }
            is Outcome.Err -> when (r.error) {
                is AppError.Unauthorized -> expire()
                is AppError.NoNetwork, is AppError.Timeout, is AppError.Server -> _state.value = AuthState.SignedIn(s, offline = true)
                else -> _state.value = AuthState.SignedIn(s)
            }
        }
    }

    /** Вызывается сетевым слоем при 401 на запросе с Bearer. */
    suspend fun expire() {
        memory = null
        store.clear()
        _state.value = AuthState.SignedOut(AuthState.SignedOut.Reason.Expired)
    }

    suspend fun logout() {
        if (memory != null) apiCall { api().logout() } // сервер гасит cookie; токен stateless — главное удалить его здесь
        memory = null
        store.clear()
        _state.value = AuthState.SignedOut(AuthState.SignedOut.Reason.LoggedOut)
    }

    private companion object {
        const val DEFAULT_TTL_SECONDS = 24L * 60 * 60
    }
}

fun WmsUserDto.toSessionUser() = SessionUser(userId, login, fio.ifBlank { login }, position, roleCodes)
