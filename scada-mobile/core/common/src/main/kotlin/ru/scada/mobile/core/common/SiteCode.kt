package ru.scada.mobile.core.common

/**
 * Площадка WMS. Повторяет `lib/wms/site-code.ts` основного WMS:
 * пустое значение и литерал `DEFAULT` (его возвращает enroll при сбое
 * чтения площадки) означают основную площадку `skeet`.
 */
object SiteCode {
    const val PRIMARY = "skeet"

    fun canonical(raw: String?): String {
        val value = raw?.trim().orEmpty()
        if (value.isEmpty() || value.equals("default", ignoreCase = true)) return PRIMARY
        return value
    }

    fun isLegacyDefault(raw: String?): Boolean = raw?.trim().equals("default", ignoreCase = true)
}
