package ru.scada.mobile.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.scada.mobile.core.common.Outcome
import ru.scada.mobile.core.common.SiteCode
import ru.scada.mobile.core.common.WmsAccess
import ru.scada.mobile.core.common.YmsAccess
import ru.scada.mobile.core.common.YmsPermission
import ru.scada.mobile.core.data.AuthRepository
import ru.scada.mobile.core.data.AuthState
import ru.scada.mobile.core.data.DeviceCredentials
import ru.scada.mobile.core.data.DeviceRepository
import ru.scada.mobile.core.data.SessionUser
import ru.scada.mobile.core.data.YmsConnection
import ru.scada.mobile.core.data.YmsState
import javax.inject.Inject

data class HomeUiState(
    val user: SessionUser? = null,
    val offline: Boolean = false,
    val device: DeviceCredentials? = null,
    val wms: WmsAccess = WmsAccess.of(emptyList()),
    val yms: Set<YmsPermission> = emptySet(),
    val ymsState: YmsState = YmsState.Unknown,
) {
    /** Площадка: из подключения устройства; без него — основная по умолчанию (skeet). */
    val siteCode: String get() = device?.siteCode ?: SiteCode.PRIMARY
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val auth: AuthRepository,
    private val devices: DeviceRepository,
    private val yms: YmsConnection,
) : ViewModel() {
    val state: StateFlow<HomeUiState> = combine(auth.state, devices.device, yms.state) { a, d, y ->
        val signed = a as? AuthState.SignedIn
        val roles = signed?.session?.user?.roleCodes.orEmpty()
        HomeUiState(
            user = signed?.session?.user,
            offline = signed?.offline == true,
            device = d,
            wms = WmsAccess.of(roles),
            yms = YmsAccess.permissions(roles),
            ymsState = y,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeUiState())

    init {
        viewModelScope.launch { yms.check() }
    }

    fun refresh() = viewModelScope.launch { auth.refresh(); yms.check() }
    fun logout() = viewModelScope.launch { auth.logout() }
}

data class EnrollUiState(
    val code: String = "",
    val deviceName: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val done: DeviceCredentials? = null,
)

@HiltViewModel
class EnrollViewModel @Inject constructor(
    private val devices: DeviceRepository,
    private val info: DeviceInfoProvider,
) : ViewModel() {
    private val _state = MutableStateFlow(EnrollUiState(deviceName = info.defaultName(), done = devices.device.value))
    val state: StateFlow<EnrollUiState> = _state.asStateFlow()

    fun onCode(v: String) = _state.update { it.copy(code = v, error = null) }
    fun onName(v: String) = _state.update { it.copy(deviceName = v) }

    fun submit() {
        val s = _state.value
        if (s.loading) return
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val r = devices.enroll(s.code, s.deviceName.ifBlank { null }, info.appVersion(), info.deviceInfo())) {
                is Outcome.Ok -> _state.update { it.copy(loading = false, done = r.value, code = "") }
                is Outcome.Err -> _state.update { it.copy(loading = false, error = r.error.userMessage) }
            }
        }
    }

    fun forget() = viewModelScope.launch {
        devices.forget()
        _state.update { it.copy(done = null) }
    }
}

data class YmsConnectUiState(val login: String = "", val password: String = "", val loading: Boolean = false, val error: String? = null)

@HiltViewModel
class YmsConnectViewModel @Inject constructor(private val yms: YmsConnection, auth: AuthRepository) : ViewModel() {
    // Тот же пользователь wms_users — логин подставляем, пароль вводится заново (его не храним).
    private val _state = MutableStateFlow(YmsConnectUiState(login = (auth.state.value as? AuthState.SignedIn)?.session?.user?.login.orEmpty()))
    val state: StateFlow<YmsConnectUiState> = _state.asStateFlow()
    val ymsState: StateFlow<YmsState> = yms.state

    fun onLogin(v: String) = _state.update { it.copy(login = v, error = null) }
    fun onPassword(v: String) = _state.update { it.copy(password = v, error = null) }

    fun connect(onDone: () -> Unit) {
        val s = _state.value
        if (s.loading) return
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val r = yms.connect(s.login, s.password)) {
                is Outcome.Ok -> { _state.update { YmsConnectUiState(login = s.login) }; onDone() }
                is Outcome.Err -> _state.update { it.copy(loading = false, error = r.error.userMessage, password = "") }
            }
        }
    }

    fun disconnect() = viewModelScope.launch { yms.disconnect() }
}

/** Сведения об устройстве для enroll — реализует app (android.os.Build, версия сборки). */
interface DeviceInfoProvider {
    fun defaultName(): String
    fun appVersion(): String
    fun deviceInfo(): kotlinx.serialization.json.JsonObject
}
