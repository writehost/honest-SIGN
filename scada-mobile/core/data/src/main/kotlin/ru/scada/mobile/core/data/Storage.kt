package ru.scada.mobile.core.data

import kotlinx.serialization.Serializable

@Serializable
data class SessionUser(
    val userId: String? = null,
    val login: String,
    val fio: String,
    val position: String? = null,
    val roleCodes: List<String> = emptyList(),
)

/** Пользовательская сессия WMS. Пароль не хранится никогда. */
@Serializable
data class UserSession(
    val accessToken: String,
    val expiresAtMillis: Long,
    val user: SessionUser,
)

/** Учётные данные ТСД — отдельно от сессии пользователя. */
@Serializable
data class DeviceCredentials(
    val deviceUid: String,
    val deviceToken: String,
    val siteCode: String,
    val deviceName: String? = null,
)

/** Зашифрованное хранилище (на Android — Keystore AES-GCM). */
interface SecureStore<T : Any> {
    suspend fun read(): T?
    suspend fun write(value: T)
    suspend fun clear()
}
