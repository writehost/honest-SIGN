package ru.scada.mobile.core.network.wms

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface WmsAuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @GET("api/auth/me")
    suspend fun me(): MeResponse

    /** Сервер только гасит cookie; Bearer-токен stateless и живёт до expiresIn. */
    @POST("api/auth/logout")
    suspend fun logout(): OkResponse
}

/** Маршруты ТСД. Авторизация — заголовок X-Device-Token (см. DeviceTokenInterceptor). */
interface WmsDeviceApi {
    @POST("api/wms/devices/enroll")
    suspend fun enroll(@Body body: EnrollRequest): EnrollResponse

    @GET("api/wms/devices/tasks")
    suspend fun tasks(
        @Query("siteCode") siteCode: String,
        @Query("deviceUid") deviceUid: String,
        @Query("operatorUserId") operatorUserId: String? = null,
        @Query("status") status: String? = null,
        @Query("type") type: String? = null,
        @Query("query") query: String? = null,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int? = null,
    ): DeviceTasksResponse

    @POST("api/wms/devices/tasks/{id}/claim")
    suspend fun claim(@Path("id") taskId: String, @Body body: TaskMutationRequest): TaskMutationResponse

    @POST("api/wms/devices/tasks/{id}/start")
    suspend fun start(@Path("id") taskId: String, @Body body: TaskMutationRequest): TaskMutationResponse

    @POST("api/wms/devices/tasks/{id}/complete")
    suspend fun complete(@Path("id") taskId: String, @Body body: TaskMutationRequest): TaskMutationResponse

    @POST("api/wms/devices/tasks/{id}/exception")
    suspend fun exception(@Path("id") taskId: String, @Body body: TaskMutationRequest): TaskMutationResponse
}
