package ru.scada.mobile.core.security

import android.content.Context
import android.util.AtomicFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import ru.scada.mobile.core.data.SecureStore
import ru.scada.mobile.core.network.ScadaJson
import ru.scada.mobile.core.network.http.CookiePersistence
import java.io.File

/**
 * Зашифрованный файл в `noBackupFilesDir` (не попадает в облачные копии).
 * Если расшифровать нельзя (ключ сброшен) — данные считаются отсутствующими.
 */
class EncryptedFile(context: Context, name: String, private val cipher: KeystoreCipher) {
    private val file = AtomicFile(File(context.noBackupFilesDir, "$name.bin"))

    @Synchronized
    fun readText(): String? = runCatching {
        if (!file.baseFile.exists()) return null
        String(cipher.decrypt(file.readFully()), Charsets.UTF_8)
    }.getOrElse {
        file.delete()
        null
    }

    @Synchronized
    fun writeText(text: String) {
        val out = file.startWrite()
        try {
            out.write(cipher.encrypt(text.toByteArray(Charsets.UTF_8)))
            file.finishWrite(out)
        } catch (e: Exception) {
            file.failWrite(out)
            throw e
        }
    }

    @Synchronized
    fun delete() = file.delete()
}

class EncryptedJsonStore<T : Any>(private val file: EncryptedFile, private val serializer: KSerializer<T>) : SecureStore<T> {
    override suspend fun read(): T? = withContext(Dispatchers.IO) {
        file.readText()?.let { runCatching { ScadaJson.decodeFromString(serializer, it) }.getOrNull() }
    }

    override suspend fun write(value: T) = withContext(Dispatchers.IO) { file.writeText(ScadaJson.encodeToString(serializer, value)) }

    override suspend fun clear() = withContext(Dispatchers.IO) { file.delete() }
}

/** Cookie YMS — синхронно: их читает OkHttp в своём потоке. */
class EncryptedCookiePersistence(private val file: EncryptedFile) : CookiePersistence {
    private val serializer = ListSerializer(String.serializer())
    override fun load(): List<String> = file.readText()?.let { runCatching { ScadaJson.decodeFromString(serializer, it) }.getOrNull() }.orEmpty()
    override fun save(serialized: List<String>) {
        if (serialized.isEmpty()) file.delete() else file.writeText(ScadaJson.encodeToString(serializer, serialized))
    }
}
