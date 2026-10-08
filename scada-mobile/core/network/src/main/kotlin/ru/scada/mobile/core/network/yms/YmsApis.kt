package ru.scada.mobile.core.network.yms

import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import ru.scada.mobile.core.network.wms.LoginRequest
import ru.scada.mobile.core.network.wms.OkResponse

/** YMS (yms-app/app/api/auth/…): вход ставит cookie `wms_session` на домене YMS, accessToken не возвращается. */
@Serializable
data class YmsLoginUser(val login: String = "", val fio: String = "")

@Serializable
data class YmsLoginResponse(val ok: Boolean = false, val user: YmsLoginUser? = null)

/** GET /api/auth/me → `{ login, fio, position }` (без ролей). */
@Serializable
data class YmsMeResponse(val login: String = "", val fio: String = "", val position: String = "")

interface YmsAuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): YmsLoginResponse

    @GET("api/auth/me")
    suspend fun me(): YmsMeResponse

    @POST("api/auth/logout")
    suspend fun logout(): OkResponse
}
