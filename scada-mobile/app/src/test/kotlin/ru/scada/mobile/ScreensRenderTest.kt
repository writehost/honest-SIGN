package ru.scada.mobile

import android.app.Application
import androidx.compose.runtime.Composable
import com.github.takahirom.roborazzi.captureRoboImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.assertIsDisplayed
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import ru.scada.mobile.core.common.SiteCode
import ru.scada.mobile.core.common.WmsAccess
import ru.scada.mobile.core.common.YmsAccess
import ru.scada.mobile.core.data.DeviceCredentials
import ru.scada.mobile.core.data.SessionUser
import ru.scada.mobile.core.data.YmsState
import ru.scada.mobile.core.designsystem.theme.ScadaTheme
import ru.scada.mobile.core.designsystem.theme.ThemeMode
import ru.scada.mobile.feature.home.HomeScreen
import ru.scada.mobile.feature.home.HomeUiState
import ru.scada.mobile.feature.login.LoginScreen
import ru.scada.mobile.feature.login.LoginUiState
import java.io.File

/**
 * Рендерит реальные Compose-экраны (Robolectric, native graphics) в PNG —
 * проверка вёрстки без устройства. Данные состояния заданы явно: это кадры
 * интерфейса, а не ответы сервера.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = Application::class, qualifiers = "w393dp-h852dp-xxhdpi")
class ScreensRenderTest {
    @get:Rule val compose = createComposeRule()

    private fun shot(name: String, mode: ThemeMode, content: @Composable () -> Unit) {
        compose.setContent { ScadaTheme(mode) { content() } }
        compose.waitForIdle()
        val dir = File(System.getProperty("screenshots.dir") ?: "build/screens").apply { mkdirs() }
        compose.onRoot().captureRoboImage(File(dir, "$name.png").absolutePath)
    }

    private val login = LoginUiState(login = "ivanov", password = "secret", version = "0.1.0 (1)")

    @Test fun loginLight() {
        shot("login-light", ThemeMode.Light) { LoginScreen(login, {}, {}, {}, {}) }
        compose.onNodeWithText("Войти в SCADA").assertIsDisplayed()
        compose.onNodeWithText("SCADA SYSTEM — CONNECTED INDUSTRY").assertIsDisplayed()
    }

    @Test fun loginDark() = shot("login-dark", ThemeMode.Dark) { LoginScreen(login, {}, {}, {}, {}) }

    @Test fun loginError() = shot("login-error", ThemeMode.Light) {
        LoginScreen(login.copy(password = "", error = "Неверный логин или пароль"), {}, {}, {}, {})
    }

    private val roles = listOf("warehouse_operator", "yms_guard")
    private val home = HomeUiState(
        user = SessionUser("7", "ivanov", "Иванов Иван", "Оператор склада", roles),
        device = DeviceCredentials("TSD-7KQ2PZ", "token", SiteCode.canonical("DEFAULT"), "Samsung SM-A155F"),
        wms = WmsAccess.of(roles),
        yms = YmsAccess.permissions(roles),
        ymsState = YmsState.NotConnected,
    )

    @Test fun homeLight() {
        shot("home-light", ThemeMode.Light) { HomeScreen(home, {}, {}, {}) }
        compose.onNodeWithText("Площадка: skeet").assertIsDisplayed()
    }

    @Test fun homeDarkNoDevice() = shot("home-dark", ThemeMode.Dark) { HomeScreen(home.copy(device = null, offline = true), {}, {}, {}) }
}
