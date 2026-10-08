package ru.scada.mobile.core.network.wms

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

// Контракты взяты из обработчиков scada_system/app/api/… (не из догадок).

/** POST /api/auth/login — `login` не обязан быть e-mail. */
@Serializable
data class LoginRequest(val login: String, val password: String)

@Serializable
data class WmsUserDto(
    val userId: String? = null,
    val login: String,
    val fio: String = "",
    val position: String? = null,
    /** Внутри `user`, не на верхнем уровне ответа. У старых учётных записей может отсутствовать. */
    val roleCodes: List<String> = emptyList(),
)

/** Ответ: `{ ok, accessToken, tokenType: "Bearer", expiresIn (сек), user }`. */
@Serializable
data class LoginResponse(
    val ok: Boolean = false,
    val accessToken: String? = null,
    val tokenType: String? = null,
    val expiresIn: Long? = null,
    val user: WmsUserDto? = null,
)

/** GET /api/auth/me → `{ user }` или 401 `{ user: null }`. */
@Serializable
data class MeResponse(val user: WmsUserDto? = null)

@Serializable
data class OkResponse(val ok: Boolean = false)

/** Тело ошибок WMS: `{ error, code?, disposition? }`. */
@Serializable
data class ErrorBody(val error: String? = null, val code: String? = null, val disposition: String? = null)

/** POST /api/wms/devices/enroll — публичный маршрут, код одноразовый. */
@Serializable
data class EnrollRequest(
    val code: String,
    val deviceUid: String? = null,
    val deviceName: String? = null,
    val platform: String = "android",
    val appVersion: String? = null,
    val deviceInfo: JsonObject? = null,
)

/** `siteCode` может прийти литералом `DEFAULT` — канонизировать через SiteCode.canonical. */
@Serializable
data class EnrollResponse(
    val ok: Boolean = false,
    val deviceUid: String? = null,
    val deviceName: String? = null,
    val deviceToken: String? = null,
    val siteCode: String? = null,
)

/** Строка задания (`lib/wms/tasks.ts`). Все поля, кроме id, необязательны. */
@Serializable
data class WmsTaskDto(
    val taskId: String,
    val taskCode: String? = null,
    val taskType: String = "",
    val taskStatus: String = "",
    val priorityCode: String? = null,
    val plannedQty: Double? = null,
    val confirmedQty: Double? = null,
    val sequenceNo: Int? = null,
    val dueAt: String? = null,
    val claimedAt: String? = null,
    val startedAt: String? = null,
    val completedAt: String? = null,
    val exceptionCode: String? = null,
    val exceptionNote: String? = null,
    val taskPayload: JsonElement? = null,
    val itemCode: String? = null,
    val itemName: String? = null,
    val lotCode: String? = null,
    val batchLabel: String? = null,
    val expiryAt: String? = null,
    val documentId: String? = null,
    val documentNo: String? = null,
    val documentType: String? = null,
    val sourceWarehouseCode: String? = null,
    val targetWarehouseCode: String? = null,
    val sourceWarehouseName: String? = null,
    val targetWarehouseName: String? = null,
    val sourceLocationCode: String? = null,
    val targetLocationCode: String? = null,
    val assignedUser: String? = null,
    val assignedDevice: String? = null,
    val assignedDeviceUid: String? = null,
)

/** GET /api/wms/devices/tasks?siteCode&deviceUid[&status&type&query&cursor&limit] */
@Serializable
data class DeviceTasksResponse(
    val tasks: List<WmsTaskDto> = emptyList(),
    val nextCursor: String? = null,
)

/**
 * Тело мутаций /api/wms/devices/tasks/{id}/(claim|start|complete|exception).
 * `requestId` (UUID) — ключ идемпотентности `runIdempotentWrite`: повтор с тем же
 * id вернёт `disposition: "duplicate"`, а не выполнит операцию второй раз.
 */
@Serializable
data class TaskMutationRequest(
    val requestId: String,
    val siteCode: String,
    val deviceUid: String,
    val operatorUserId: String? = null,
    val confirmedQty: Double? = null,
    val sourceLocationCode: String? = null,
    val targetLocationCode: String? = null,
    val note: String? = null,
    val exceptionCode: String? = null,
    val exceptionNote: String? = null,
)

/** `disposition`: applied | duplicate | conflict | failed */
@Serializable
data class TaskMutationResponse(
    val taskId: String? = null,
    val disposition: String? = null,
    val error: String? = null,
    val code: String? = null,
)
