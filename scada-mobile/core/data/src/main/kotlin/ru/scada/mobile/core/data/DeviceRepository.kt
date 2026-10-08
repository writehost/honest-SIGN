package ru.scada.mobile.core.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.JsonObject
import ru.scada.mobile.core.common.AppError
import ru.scada.mobile.core.common.Outcome
import ru.scada.mobile.core.common.SiteCode
import ru.scada.mobile.core.network.http.TokenProvider
import ru.scada.mobile.core.network.http.apiCall
import ru.scada.mobile.core.network.wms.EnrollRequest
import ru.scada.mobile.core.network.wms.WmsDeviceApi

/**
 * Подключение телефона как устройства WMS: одноразовый код из веб-WMS
 * («Терминалы») → `POST /api/wms/devices/enroll` → постоянный deviceToken.
 */
class DeviceRepository(
    private val api: () -> WmsDeviceApi,
    private val store: SecureStore<DeviceCredentials>,
) : TokenProvider {
    private val _device = MutableStateFlow<DeviceCredentials?>(null)
    val device: StateFlow<DeviceCredentials?> = _device.asStateFlow()

    override fun current(): String? = _device.value?.deviceToken

    suspend fun load() { _device.value = store.read() }

    suspend fun enroll(code: String, deviceName: String?, appVersion: String?, deviceInfo: JsonObject?): Outcome<DeviceCredentials> {
        val c = code.trim()
        if (c.isEmpty()) return Outcome.Err(AppError.BadRequest("Введите код подключения"))
        val r = apiCall { api().enroll(EnrollRequest(code = c, deviceName = deviceName, appVersion = appVersion, deviceInfo = deviceInfo)) }
        if (r is Outcome.Err) return r
        val body = (r as Outcome.Ok).value
        val token = body.deviceToken
        val uid = body.deviceUid
        if (!body.ok || token.isNullOrBlank() || uid.isNullOrBlank()) return Outcome.Err(AppError.Unexpected("сервер не выдал токен устройства"))
        // enroll при сбое возвращает литерал DEFAULT — сохраняем каноническую площадку, как сервер.
        val creds = DeviceCredentials(uid, token, SiteCode.canonical(body.siteCode), body.deviceName)
        store.write(creds)
        _device.value = creds
        return Outcome.Ok(creds)
    }

    /** Отключает телефон локально. Отзыв на сервере делается в веб-WMS («Терминалы»). */
    suspend fun forget() {
        store.clear()
        _device.value = null
    }
}
