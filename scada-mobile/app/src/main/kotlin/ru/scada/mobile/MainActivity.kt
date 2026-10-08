package ru.scada.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import ru.scada.mobile.core.data.AuthRepository
import ru.scada.mobile.core.data.AuthState
import ru.scada.mobile.core.data.DeviceRepository
import ru.scada.mobile.core.designsystem.theme.ScadaTheme
import ru.scada.mobile.navigation.AppNavHost
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var auth: AuthRepository
    @Inject lateinit var devices: DeviceRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Сплэш держится, пока не ясно, есть ли действующая сессия.
        splash.setKeepOnScreenCondition { auth.state.value is AuthState.Checking }
        if (auth.state.value is AuthState.Checking) {
            lifecycleScope.launch {
                devices.load()
                auth.restore()
            }
        }
        setContent {
            ScadaTheme {
                val state by auth.state.collectAsStateWithLifecycle()
                if (state !is AuthState.Checking) AppNavHost(state)
            }
        }
    }
}
