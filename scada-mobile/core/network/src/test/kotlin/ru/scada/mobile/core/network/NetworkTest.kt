package ru.scada.mobile.core.network

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import ru.scada.mobile.core.common.AppError
import ru.scada.mobile.core.common.Outcome
import ru.scada.mobile.core.network.http.CookiePersistence
import ru.scada.mobile.core.network.http.apiCall
import ru.scada.mobile.core.network.wms.EnrollRequest
import ru.scada.mobile.core.network.wms.LoginRequest
import ru.scada.mobile.core.network.wms.TaskMutationRequest

class NetworkTest {
    private lateinit var server: MockWebServer
    private var unauthorized = 0

    @Before fun setUp() { server = MockWebServer().apply { start() } }
    @After fun tearDown() = server.shutdown()

    private fun wms(user: String? = "U-TOKEN", device: String? = "D-TOKEN") = WmsApiClient(
        ApiConfig(wmsBaseUrl = server.url("/").toString(), readTimeoutSeconds = 5),
        userToken = { user }, deviceToken = { device }, onUnauthorized = { unauthorized++ },
    )

    private fun json(body: String, code: Int = 200) = MockResponse().setResponseCode(code).setHeader("Content-Type", "application/json").setBody(body)

    @Test fun `login posts login+password and reads roleCodes inside user`() = runTest {
        server.enqueue(json("""{"ok":true,"accessToken":"abc.def","tokenType":"Bearer","expiresIn":86400,
            "user":{"userId":"7","login":"ivanov","fio":"Иванов И.","position":"Кладовщик","roleCodes":["warehouse_operator"]},"extra":1}"""))
        val r = wms(user = null).auth.login(LoginRequest("ivanov", "p@ss"))
        assertEquals("abc.def", r.accessToken)
        assertEquals(listOf("warehouse_operator"), r.user!!.roleCodes)
        val req = server.takeRequest()
        assertEquals("/api/auth/login", req.path)
        assertEquals("""{"login":"ivanov","password":"p@ss"}""", req.body.readUtf8())
        assertNull(req.getHeader("Authorization"))
    }

    @Test fun `legacy user without roleCodes still parses`() = runTest {
        server.enqueue(json("""{"ok":true,"accessToken":"t","user":{"login":"admin","fio":"Админ"}}"""))
        assertEquals(emptyList<String>(), wms().auth.login(LoginRequest("admin", "x")).user!!.roleCodes)
    }

    @Test fun `bearer goes to user routes, device token only to device routes`() = runTest {
        val c = wms()
        server.enqueue(json("""{"user":{"login":"a"}}"""))
        c.auth.me()
        server.takeRequest().let {
            assertEquals("Bearer U-TOKEN", it.getHeader("Authorization"))
            assertNull(it.getHeader("X-Device-Token"))
        }
        server.enqueue(json("""{"tasks":[{"taskId":"1542","taskType":"move","taskStatus":"open","priorityCode":"high","sourceLocationCode":"FG-A-12","targetLocationCode":"FG-B-08"}],"nextCursor":""}"""))
        val tasks = c.device.tasks(siteCode = "skeet", deviceUid = "TSD-ABC123")
        assertEquals("FG-B-08", tasks.tasks.single().targetLocationCode)
        server.takeRequest().let {
            assertEquals("D-TOKEN", it.getHeader("X-Device-Token"))
            assertNull(it.getHeader("Authorization"))
            assertEquals("/api/wms/devices/tasks?siteCode=skeet&deviceUid=TSD-ABC123", it.path)
        }
        server.enqueue(json("""{"ok":true,"deviceUid":"TSD-1","deviceToken":"new","siteCode":"DEFAULT"}"""))
        c.device.enroll(EnrollRequest(code = "123-456"))
        server.takeRequest().let {
            assertNull(it.getHeader("X-Device-Token"))
            assertNull(it.getHeader("Authorization"))
        }
    }

    @Test fun `server errors become typed errors with the server text`() = runTest {
        server.enqueue(json("""{"error":"task is assigned to another device","code":"wrong_device","disposition":"failed"}""", 409))
        val r = apiCall { wms().device.start("1", TaskMutationRequest(requestId = "6f1c1a8e-2b2b-4c1e-9d8f-1a2b3c4d5e6f", siteCode = "skeet", deviceUid = "TSD-1")) }
        val e = (r as Outcome.Err).error as AppError.Conflict
        assertEquals("wrong_device", e.code)
        assertEquals("task is assigned to another device", e.userMessage)
    }

    @Test fun `401 on a bearer request is reported once`() = runTest {
        server.enqueue(json("""{"user":null}""", 401))
        val r = apiCall { wms().auth.me() }
        assertTrue((r as Outcome.Err).error is AppError.Unauthorized)
        assertEquals(1, unauthorized)
    }

    @Test fun `GET is retried on 503, POST is never retried`() = runTest {
        server.enqueue(MockResponse().setResponseCode(503))
        server.enqueue(json("""{"tasks":[]}"""))
        wms().device.tasks("skeet", "TSD-1")
        assertEquals(2, server.requestCount)

        server.enqueue(MockResponse().setResponseCode(503))
        server.enqueue(json("""{"taskId":"1","disposition":"applied"}"""))
        val r = apiCall { wms().device.complete("1", TaskMutationRequest("6f1c1a8e-2b2b-4c1e-9d8f-1a2b3c4d5e6f", "skeet", "TSD-1")) }
        assertTrue(r is Outcome.Err)
        assertEquals(3, server.requestCount)
    }

    @Test fun `no network is reported as NoNetwork`() = runTest {
        val c = WmsApiClient(ApiConfig(wmsBaseUrl = "http://127.0.0.1:1/", connectTimeoutSeconds = 1), { null }, { null }, {})
        val r = apiCall { c.auth.me() }
        assertTrue((r as Outcome.Err).error is AppError.NoNetwork)
    }

    @Test fun `yms keeps its own cookie session and never sends a bearer`() = runTest {
        val store = object : CookiePersistence {
            var saved = emptyList<String>()
            override fun load() = saved
            override fun save(serialized: List<String>) { saved = serialized }
        }
        val yms = YmsApiClient(ApiConfig(ymsBaseUrl = server.url("/").toString()), store)
        server.enqueue(json("""{"ok":true,"user":{"login":"guard1","fio":"Охрана"}}""").addHeader("Set-Cookie", "wms_session=yms.cookie; Path=/; Max-Age=86400; HttpOnly"))
        assertEquals("guard1", yms.auth.login(LoginRequest("guard1", "x")).user!!.login)
        server.enqueue(json("""{"login":"guard1","fio":"Охрана","position":"КПП"}"""))
        yms.auth.me()
        server.takeRequest()
        server.takeRequest().let {
            assertEquals("wms_session=yms.cookie", it.getHeader("Cookie"))
            assertNull(it.getHeader("Authorization"))
        }
        assertTrue(store.saved.single().startsWith("wms_session=yms.cookie"))

        // A fresh client (app restart) restores the session from the encrypted store
        val again = YmsApiClient(ApiConfig(ymsBaseUrl = server.url("/").toString()), store)
        server.enqueue(json("""{"login":"guard1"}"""))
        again.auth.me()
        assertEquals("wms_session=yms.cookie", server.takeRequest().getHeader("Cookie"))
        again.cookieJar.clear()
        assertTrue(store.saved.isEmpty())
    }
}
