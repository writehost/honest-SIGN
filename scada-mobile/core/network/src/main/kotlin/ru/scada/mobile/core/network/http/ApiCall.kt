package ru.scada.mobile.core.network.http

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import retrofit2.HttpException
import ru.scada.mobile.core.common.AppError
import ru.scada.mobile.core.common.Outcome
import ru.scada.mobile.core.network.ScadaJson
import ru.scada.mobile.core.network.wms.ErrorBody
import java.io.IOException
import java.io.InterruptedIOException
import java.net.SocketTimeoutException

/** Переводит исключения Retrofit/OkHttp в типизированную ошибку. Отмена корутины пробрасывается. */
suspend fun <T> apiCall(block: suspend () -> T): Outcome<T> = try {
    Outcome.Ok(block())
} catch (e: CancellationException) {
    throw e
} catch (e: HttpException) {
    Outcome.Err(e.toAppError())
} catch (e: SocketTimeoutException) {
    Outcome.Err(AppError.Timeout)
} catch (e: InterruptedIOException) {
    Outcome.Err(AppError.Timeout)
} catch (e: IOException) {
    Outcome.Err(AppError.NoNetwork)
} catch (e: SerializationException) {
    Outcome.Err(AppError.Unexpected("неожиданный формат ответа сервера"))
}

fun HttpException.toAppError(): AppError {
    val raw = runCatching { response()?.errorBody()?.string() }.getOrNull()
    val body = raw?.let { runCatching { ScadaJson.decodeFromString(ErrorBody.serializer(), it) }.getOrNull() }
    val msg = body?.error?.takeIf { it.isNotBlank() }
    return when (val c = code()) {
        400, 422 -> AppError.BadRequest(msg, body?.code)
        401 -> AppError.Unauthorized(msg)
        403 -> AppError.Forbidden(msg, body?.code)
        404 -> AppError.NotFound(msg)
        409 -> AppError.Conflict(msg, body?.code)
        429 -> AppError.TooManyRequests(response()?.headers()?.get("Retry-After")?.toLongOrNull())
        else -> AppError.Server(c, msg)
    }
}
