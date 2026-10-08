package ru.scada.mobile.core.network

/**
 * Адреса сервисов. Значения по умолчанию — боевые адреса из контракта;
 * в сборке их можно переопределить через BuildConfig/настройки.
 * VEKAS ходит через публичный WMS-адаптер `/api/wms/vekas/…`, отдельного адреса нет.
 */
data class ApiConfig(
    val wmsBaseUrl: String = "https://wms.scada25.ru/",
    val ymsBaseUrl: String = "https://yms.scadasystem.io/",
    val connectTimeoutSeconds: Long = 10,
    val readTimeoutSeconds: Long = 30,
    val userAgent: String = "SCADA-Mobile",
)
