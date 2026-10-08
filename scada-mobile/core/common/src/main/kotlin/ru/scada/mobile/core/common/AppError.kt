package ru.scada.mobile.core.common

/** Ошибки, которые видит пользователь. Текст сервера показывается как есть, если он есть. */
sealed class AppError(open val serverMessage: String?) {
    data class Unauthorized(override val serverMessage: String? = null) : AppError(serverMessage)
    data class Forbidden(override val serverMessage: String? = null, val code: String? = null) : AppError(serverMessage)
    data class NotFound(override val serverMessage: String? = null) : AppError(serverMessage)
    data class Conflict(override val serverMessage: String? = null, val code: String? = null) : AppError(serverMessage)
    data class TooManyRequests(val retryAfterSeconds: Long?) : AppError(null)
    data class Server(val status: Int, override val serverMessage: String? = null) : AppError(serverMessage)
    data class BadRequest(override val serverMessage: String? = null, val code: String? = null) : AppError(serverMessage)
    data object NoNetwork : AppError(null)
    data object Timeout : AppError(null)
    data class Unexpected(val description: String) : AppError(null)

    val userMessage: String
        get() = when (this) {
            is Unauthorized -> serverMessage ?: "Сессия истекла. Войдите снова."
            is Forbidden -> serverMessage ?: "Недостаточно прав для этой операции."
            is NotFound -> serverMessage ?: "Не найдено."
            is Conflict -> serverMessage ?: "Операция конфликтует с текущим состоянием."
            is TooManyRequests -> "Слишком много запросов. Повторите через ${retryAfterSeconds ?: 10} с."
            is Server -> serverMessage ?: "Сервер ответил ошибкой $status."
            is BadRequest -> serverMessage ?: "Некорректный запрос."
            NoNetwork -> "Нет связи с сервером. Проверьте интернет."
            Timeout -> "Сервер не ответил вовремя."
            is Unexpected -> "Непредвиденная ошибка: $description"
        }
}

sealed interface Outcome<out T> {
    data class Ok<T>(val value: T) : Outcome<T>
    data class Err(val error: AppError) : Outcome<Nothing>
}

inline fun <T, R> Outcome<T>.map(f: (T) -> R): Outcome<R> = when (this) {
    is Outcome.Ok -> Outcome.Ok(f(value))
    is Outcome.Err -> this
}
