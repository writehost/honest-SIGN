package ru.scada.mobile.core.network.http

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

/** Хранилище cookie YMS (на Android — зашифрованное). */
interface CookiePersistence {
    fun load(): List<String>
    fun save(serialized: List<String>)
}

/**
 * Cookie-сессия YMS. Принимает и отдаёт cookie только своего хоста — сессия YMS
 * не утекает в WMS, а Bearer WMS не уходит в YMS.
 */
class YmsCookieJar(private val host: String, private val persistence: CookiePersistence) : CookieJar {
    private val cookies = mutableListOf<Cookie>()
    private var loaded = false

    @Synchronized
    private fun ensureLoaded(url: HttpUrl) {
        if (loaded) return
        loaded = true
        persistence.load().mapNotNull { Cookie.parse(url, it) }.filter { it.domainMatchesHost() }.let(cookies::addAll)
    }

    private fun Cookie.domainMatchesHost() = host == domain || host.endsWith(".$domain")

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (url.host != host) return
        ensureLoaded(url)
        for (c in cookies) {
            this.cookies.removeAll { it.name == c.name && it.domain == c.domain && it.path == c.path }
            if (c.expiresAt > System.currentTimeMillis()) this.cookies += c
        }
        persist()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        if (url.host != host) return emptyList()
        ensureLoaded(url)
        val now = System.currentTimeMillis()
        if (cookies.removeAll { it.expiresAt <= now }) persist()
        return cookies.filter { it.matches(url) }
    }

    @Synchronized
    fun hasSession(): Boolean = cookies.any { it.expiresAt > System.currentTimeMillis() } ||
        (!loaded && persistence.load().isNotEmpty())

    @Synchronized
    fun clear() {
        cookies.clear()
        loaded = true
        persistence.save(emptyList())
    }

    private fun persist() = persistence.save(cookies.filter { it.persistent }.map { it.toString() })
}
