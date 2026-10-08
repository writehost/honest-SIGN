package ru.scada.mobile.core.data

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
import ru.scada.mobile.core.network.ApiConfig
import ru.scada.mobile.core.network.WmsApiClient
import ru.scada.mobile.core.network.YmsApiClient
import ru.scada.mobile.core.network.http.CookiePersistence

class MemoryStore<T : Any>(var value: T? = null) : SecureStore<T> {
    override suspend fun read() = value
    override suspend fun write(value: T) { this.value = value }
    override suspend fun clear() { value = null }
}

class RepositoriesTest {
    private lateinit var server: MockWebServer
    private val sessionStore = MemoryStore<UserSession>()
    private val deviceStore = MemoryStore<DeviceCredentials>()
    private var now = 1_000_000L
    private lateinit var auth: AuthRepository
    private lateinit var devices: DeviceRepository
    private lateinit var wms: WmsApiClient

    @Before fun setUp() {
        server = MockWebServer().apply { start() }
        lateinit var a: AuthRepository
        lateinit var d: DeviceRepository
        wms = WmsApiClient(ApiConfig(wmsBaseUrl = server.url("/").toString()), { a.current() }, { d.current() }, {})
        a = AuthRepository({ wms.auth }, sessionStore) { now }
        d = DeviceRepository({ wms.device }, deviceStore)
        auth = a; devices = d
    }

    @After fun tearDown() = server.shutdown()

    private fun json(body: String, code: Int = 200) = MockResponse().setResponseCode(code).setHeader("Content-Type", "application/json").setBody(body)
    private val loginOk = """{"ok":true,"accessToken":"tok-1","tokenType":"Bearer","expiresIn":86400,"user":{"userId":"7","login":"ivanov","fio":"Иванов","roleCodes":["warehouse_operator"]}}"""

    @Test fun `login stores the session, never the password, and uses the token`() = runTest {
        server.enqueue(json(loginOk))
        val r = auth.login(" ivanov ", "secret", remember = true)
        assertTrue(r is Outcome.Ok)
        assertEquals("tok-1", sessionStore.value!!.accessToken)
        assertEquals(1_000_000L + 86_400_000L, sessionStore.value!!.expiresAtMillis)
        assertTrue(!sessionStore.value.toString().contains("secret"))
        assertEquals("tok-1", auth.current())
        assertEquals("""{"login":"ivanov","password":"secret"}""", server.takeRequest().body.readUtf8())
    }

    @Test fun `without remember-me nothing is persisted`() = runTest {
        sessionStore.value = UserSession("old", Long.MAX_VALUE, SessionUser(login = "x", fio = "x"))
        server.enqueue(json(loginOk))
        auth.login("ivanov", "secret", remember = false)
        assertNull(sessionStore.value)
        assertEquals("tok-1", auth.current())
    }

    @Test fun `wrong password shows the server text`() = runTest {
        server.enqueue(json("""{"error":"Неверный логин или пароль"}""", 401))
        val e = (auth.login("ivanov", "bad", true) as Outcome.Err).error
        assertEquals("Неверный логин или пароль", e.userMessage)
        assertTrue(auth.state.value !is AuthState.SignedIn)
    }

    @Test fun `restore verifies with me and refreshes roles`() = runTest {
        sessionStore.value = UserSession("tok-1", now + 1000, SessionUser(login = "ivanov", fio = "Иванов"))
        server.enqueue(json("""{"user":{"userId":"7","login":"ivanov","fio":"Иванов И.","roleCodes":["auditor"]}}"""))
        auth.restore()
        val s = auth.state.value as AuthState.SignedIn
        assertEquals(listOf("auditor"), s.session.user.roleCodes)
        assertEquals("Bearer tok-1", server.takeRequest().getHeader("Authorization"))
    }

    @Test fun `expired local session is dropped without a request`() = runTest {
        sessionStore.value = UserSession("tok-1", now - 1, SessionUser(login = "a", fio = "a"))
        auth.restore()
        assertEquals(AuthState.SignedOut(AuthState.SignedOut.Reason.Expired), auth.state.value)
        assertEquals(0, server.requestCount)
        assertNull(sessionStore.value)
    }

    @Test fun `server rejects the token, session is cleared`() = runTest {
        sessionStore.value = UserSession("tok-1", now + 1000, SessionUser(login = "a", fio = "a"))
        server.enqueue(json("""{"user":null}""", 401))
        auth.restore()
        assertTrue(auth.state.value is AuthState.SignedOut)
        assertNull(sessionStore.value)
    }

    @Test fun `offline start keeps the cached session, marked offline`() = runTest {
        sessionStore.value = UserSession("tok-1", now + 1000, SessionUser(login = "a", fio = "a"))
        server.shutdown()
        auth.restore()
        assertEquals(true, (auth.state.value as AuthState.SignedIn).offline)
    }

    @Test fun `logout clears the token locally`() = runTest {
        server.enqueue(json(loginOk)); auth.login("ivanov", "x", true)
        server.enqueue(json("""{"ok":true}"""))
        auth.logout()
        assertNull(auth.current()); assertNull(sessionStore.value)
    }

    @Test fun `enroll stores device credentials with the canonical site, not DEFAULT`() = runTest {
        server.enqueue(json("""{"ok":true,"deviceUid":"TSD-7KQ2PZ","deviceName":"Телефон Иванова","deviceToken":"dev-secret","siteCode":"DEFAULT"}"""))
        val r = devices.enroll(" 482-913 ", "Pixel", "1.0.0", null)
        val c = (r as Outcome.Ok).value
        assertEquals("skeet", c.siteCode)
        assertEquals(c, deviceStore.value)
        assertEquals("dev-secret", devices.current())
        assertEquals("""{"code":"482-913","deviceName":"Pixel","platform":"android","appVersion":"1.0.0"}""", server.takeRequest().body.readUtf8())
    }

    @Test fun `bad enroll code shows the server reason`() = runTest {
        server.enqueue(json("""{"error":"Код подключения недействителен или истёк","code":"enroll_code_invalid"}""", 400))
        val e = (devices.enroll("000", null, null, null) as Outcome.Err).error
        assertEquals("Код подключения недействителен или истёк", e.userMessage)
        assertNull(deviceStore.value)
    }

    @Test fun `yms connects separately and reports a dropped session`() = runTest {
        val store = object : CookiePersistence { var s = emptyList<String>(); override fun load() = s; override fun save(serialized: List<String>) { s = serialized } }
        val yms = YmsApiClient(ApiConfig(ymsBaseUrl = server.url("/").toString()), store)
        val conn = YmsConnection({ yms.auth }, { yms.cookieJar.clear() })
        server.enqueue(json("""{"ok":true,"user":{"login":"guard1","fio":"Охрана"}}""").addHeader("Set-Cookie", "wms_session=c1; Path=/; Max-Age=600"))
        assertTrue(conn.connect("guard1", "x") is Outcome.Ok)
        server.enqueue(json("""{"error":"unauthorized"}""", 401))
        conn.check()
        assertEquals(YmsState.NotConnected, conn.state.value)
        server.enqueue(json("""{"ok":true}"""))
        conn.disconnect()
        assertTrue(store.s.isEmpty())
    }
}
