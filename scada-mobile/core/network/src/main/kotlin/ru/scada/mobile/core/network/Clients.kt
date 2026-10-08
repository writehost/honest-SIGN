package ru.scada.mobile.core.network

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import ru.scada.mobile.core.network.http.CookiePersistence
import ru.scada.mobile.core.network.http.DeviceTokenInterceptor
import ru.scada.mobile.core.network.http.RedactedLogInterceptor
import ru.scada.mobile.core.network.http.SafeRetryInterceptor
import ru.scada.mobile.core.network.http.TokenProvider
import ru.scada.mobile.core.network.http.UnauthorizedInterceptor
import ru.scada.mobile.core.network.http.UserAuthInterceptor
import ru.scada.mobile.core.network.http.YmsCookieJar
import ru.scada.mobile.core.network.wms.WmsAuthApi
import ru.scada.mobile.core.network.wms.WmsDeviceApi
import ru.scada.mobile.core.network.yms.YmsAuthApi
import java.util.concurrent.TimeUnit

private fun baseClient(config: ApiConfig, log: ((String) -> Unit)?): OkHttpClient.Builder =
    OkHttpClient.Builder()
        .connectTimeout(config.connectTimeoutSeconds, TimeUnit.SECONDS)
        .readTimeout(config.readTimeoutSeconds, TimeUnit.SECONDS)
        .writeTimeout(config.readTimeoutSeconds, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val r: Request = chain.request()
            chain.proceed(r.newBuilder().header("User-Agent", config.userAgent).header("Accept", "application/json").build())
        }
        .apply { if (log != null) addInterceptor(RedactedLogInterceptor(log)) }
        .addInterceptor(SafeRetryInterceptor())

private fun retrofit(baseUrl: String, client: OkHttpClient): Retrofit =
    Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(client)
        .addConverterFactory(ScadaJson.asConverterFactory("application/json".toMediaType()))
        .build()

/**
 * WMS: пользовательская сессия (Bearer) + токен устройства ТСД (X-Device-Token).
 * VEKAS — публичный адаптер этого же сервера (`/api/wms/vekas/…`), поэтому
 * VekasApi создаётся из этого же клиента (этап 6).
 */
class WmsApiClient(
    config: ApiConfig,
    userToken: TokenProvider,
    deviceToken: TokenProvider,
    onUnauthorized: () -> Unit,
    log: ((String) -> Unit)? = null,
) {
    val http: OkHttpClient = baseClient(config, log)
        .addInterceptor(UserAuthInterceptor(userToken))
        .addInterceptor(DeviceTokenInterceptor(deviceToken))
        .addInterceptor(UnauthorizedInterceptor(onUnauthorized))
        .build()
    val retrofit: Retrofit = retrofit(config.wmsBaseUrl, http)
    val auth: WmsAuthApi = retrofit.create(WmsAuthApi::class.java)
    val device: WmsDeviceApi = retrofit.create(WmsDeviceApi::class.java)
}

/** YMS: отдельный хост и cookie-сессия. Bearer WMS сюда никогда не добавляется. */
class YmsApiClient(config: ApiConfig, cookies: CookiePersistence, log: ((String) -> Unit)? = null) {
    val cookieJar = YmsCookieJar(okhttp3.HttpUrl.Builder().scheme("https").host(hostOf(config.ymsBaseUrl)).build().host, cookies)
    val http: OkHttpClient = baseClient(config, log).cookieJar(cookieJar).build()
    val retrofit: Retrofit = retrofit(config.ymsBaseUrl, http)
    val auth: YmsAuthApi = retrofit.create(YmsAuthApi::class.java)

    private companion object {
        fun hostOf(url: String) = url.removePrefix("https://").removePrefix("http://").substringBefore('/').substringBefore(':')
    }
}
