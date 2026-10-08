package ru.scada.mobile.core.network

import kotlinx.serialization.json.Json

/** Сервер добавляет поля без предупреждения — неизвестные игнорируем, null не ломает разбор. */
val ScadaJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
    encodeDefaults = true
    isLenient = false
}
