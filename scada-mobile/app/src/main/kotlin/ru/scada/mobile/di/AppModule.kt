package ru.scada.mobile.di

import android.content.Context
import android.os.Build
import android.util.Log
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import ru.scada.mobile.BuildConfig
import ru.scada.mobile.core.common.AppInfo
import ru.scada.mobile.core.data.AuthRepository
import ru.scada.mobile.core.data.DeviceCredentials
import ru.scada.mobile.core.data.DeviceRepository
import ru.scada.mobile.core.data.UserSession
import ru.scada.mobile.core.data.YmsConnection
import ru.scada.mobile.core.network.ApiConfig
import ru.scada.mobile.core.network.WmsApiClient
import ru.scada.mobile.core.network.YmsApiClient
import ru.scada.mobile.core.security.EncryptedCookiePersistence
import ru.scada.mobile.core.security.EncryptedFile
import ru.scada.mobile.core.security.EncryptedJsonStore
import ru.scada.mobile.core.security.KeystoreCipher
import ru.scada.mobile.feature.home.DeviceInfoProvider
import javax.inject.Qualifier
import javax.inject.Singleton

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class AppScope

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides @Singleton @AppScope
    fun appScope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @Provides @Singleton
    fun appInfo(): AppInfo = AppInfo(BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE, BuildConfig.APPLICATION_ID)

    @Provides @Singleton
    fun apiConfig(info: AppInfo): ApiConfig = ApiConfig(
        wmsBaseUrl = BuildConfig.WMS_BASE_URL,
        ymsBaseUrl = BuildConfig.YMS_BASE_URL,
        userAgent = "SCADA-Mobile/${info.versionName} (Android ${Build.VERSION.RELEASE})",
    )

    @Provides @Singleton
    fun cipher(): KeystoreCipher = KeystoreCipher("scada_mobile_store_v1")

    // Журнал только в debug и без секретов: метод, путь, код.
    private val netLog: ((String) -> Unit)? = if (BuildConfig.DEBUG) { m -> Log.d("ScadaNet", m) } else null

    @Provides @Singleton
    fun authRepository(@ApplicationContext ctx: Context, cipher: KeystoreCipher, wms: dagger.Lazy<WmsApiClient>): AuthRepository =
        AuthRepository({ wms.get().auth }, EncryptedJsonStore(EncryptedFile(ctx, "session", cipher), UserSession.serializer()))

    @Provides @Singleton
    fun deviceRepository(@ApplicationContext ctx: Context, cipher: KeystoreCipher, wms: dagger.Lazy<WmsApiClient>): DeviceRepository =
        DeviceRepository({ wms.get().device }, EncryptedJsonStore(EncryptedFile(ctx, "device", cipher), DeviceCredentials.serializer()))

    @Provides @Singleton
    fun wmsClient(config: ApiConfig, auth: AuthRepository, devices: DeviceRepository, @AppScope scope: CoroutineScope): WmsApiClient =
        WmsApiClient(config, auth, devices, onUnauthorized = { scope.launch { auth.expire() } }, log = netLog)

    @Provides @Singleton
    fun ymsClient(@ApplicationContext ctx: Context, config: ApiConfig, cipher: KeystoreCipher): YmsApiClient =
        YmsApiClient(config, EncryptedCookiePersistence(EncryptedFile(ctx, "yms_cookies", cipher)), log = netLog)

    @Provides @Singleton
    fun ymsConnection(yms: YmsApiClient): YmsConnection = YmsConnection({ yms.auth }, { yms.cookieJar.clear() })

    @Provides @Singleton
    fun deviceInfo(info: AppInfo): DeviceInfoProvider = object : DeviceInfoProvider {
        override fun defaultName() = "${Build.MANUFACTURER} ${Build.MODEL}".trim()
        override fun appVersion() = info.versionName
        override fun deviceInfo() = JsonObject(
            mapOf(
                "app" to JsonPrimitive("scada-mobile"),
                "model" to JsonPrimitive(Build.MODEL),
                "manufacturer" to JsonPrimitive(Build.MANUFACTURER),
                "sdk" to JsonPrimitive(Build.VERSION.SDK_INT),
            ),
        )
    }
}
