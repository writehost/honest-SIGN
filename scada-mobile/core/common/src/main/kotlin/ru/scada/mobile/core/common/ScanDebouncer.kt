package ru.scada.mobile.core.common

/**
 * Защита от повторных считываний: камера видит один и тот же код много кадров
 * подряд. Повтор того же значения в пределах окна игнорируется.
 */
class ScanDebouncer(private val windowMillis: Long = 1_500, private val clock: () -> Long = System::currentTimeMillis) {
    private var last: String? = null
    private var lastAt = 0L

    @Synchronized
    fun accept(value: String): Boolean {
        val now = clock()
        if (value == last && now - lastAt < windowMillis) return false
        last = value
        lastAt = now
        return true
    }

    @Synchronized
    fun reset() { last = null }
}
