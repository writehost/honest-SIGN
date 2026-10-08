package ru.scada.mobile.core.network.http

import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException

/** Источник учётных данных; реализуется хранилищем на Android (Keystore). */
fun interface TokenProvider {
    fun current(): String?
}

private const val DEVICE_PREFIX = "/api/wms/devices/"
private const val ENROLL = "/api/wms/devices/enroll"
private val PUBLIC_USER_PATHS = setOf("/api/auth/login")

/**
 * Bearer пользовательской сессии WMS. Не ставится на маршруты ТСД: там действует
 * токен устройства, и два вида учётных данных не смешиваются.
 */
class UserAuthInterceptor(private val token: TokenProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val req = chain.request()
        val path = req.url.encodedPath
        if (path in PUBLIC_USER_PATHS || path.startsWith(DEVICE_PREFIX) || req.header("Authorization") != null) {
            return chain.proceed(req)
        }
        val t = token.current() ?: return chain.proceed(req)
        return chain.proceed(req.newBuilder().header("Authorization", "Bearer $t").build())
    }
}

/** X-Device-Token для `/api/wms/devices/…` (кроме enroll — он публичный и выдаёт токен). */
class DeviceTokenInterceptor(private val token: TokenProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val req = chain.request()
        val path = req.url.encodedPath
        if (!path.startsWith(DEVICE_PREFIX) || path == ENROLL) return chain.proceed(req)
        val t = token.current() ?: return chain.proceed(req)
        return chain.proceed(req.newBuilder().header("X-Device-Token", t).build())
    }
}

/**
 * Повторы только для безопасных запросов (GET/HEAD) при обрыве связи и 502/503/504.
 * POST никогда не повторяется автоматически: мутации повторяет пользователь
 * тем же requestId, и сервер сам отвечает `duplicate`.
 */
class SafeRetryInterceptor(
    private val maxRetries: Int = 2,
    private val backoffMillis: Long = 400,
    private val sleep: (Long) -> Unit = Thread::sleep,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val req = chain.request()
        val safe = req.method == "GET" || req.method == "HEAD"
        if (!safe) return chain.proceed(req)
        var attempt = 0
        while (true) {
            try {
                val res = chain.proceed(req)
                if (res.code !in RETRY_CODES || attempt >= maxRetries) return res
                res.close()
            } catch (e: IOException) {
                if (attempt >= maxRetries || chain.call().isCanceled()) throw e
            }
            attempt++
            sleep(backoffMillis * attempt)
        }
    }

    private companion object {
        val RETRY_CODES = setOf(502, 503, 504)
    }
}

/** Сообщает о 401 на запросах с пользовательской сессией — приложение уводит на вход. */
class UnauthorizedInterceptor(private val onUnauthorized: () -> Unit) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val res = chain.proceed(chain.request())
        if (res.code == 401 && chain.request().header("Authorization")?.startsWith("Bearer ") == true) onUnauthorized()
        return res
    }
}

/**
 * Журнал без секретов: метод, путь, код, время. Заголовки, query и тела не пишутся —
 * в них токены, пароли и коды маркировки.
 */
class RedactedLogInterceptor(private val log: (String) -> Unit) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val req = chain.request()
        val started = System.nanoTime()
        return try {
            val res = chain.proceed(req)
            log("${req.method} ${req.url.encodedPath} → ${res.code} (${(System.nanoTime() - started) / 1_000_000} ms)")
            res
        } catch (e: IOException) {
            log("${req.method} ${req.url.encodedPath} → ${e.javaClass.simpleName}")
            throw e
        }
    }
}
