package ru.scada.mobile.core.common

/** Локальная информация о сборке. Отдельного канала обновлений у SCADA Mobile пока нет. */
data class AppInfo(val versionName: String, val versionCode: Int, val applicationId: String)
