package ru.scada.mobile.navigation

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import ru.scada.mobile.core.data.AuthState
import ru.scada.mobile.feature.home.EnrollRoute
import ru.scada.mobile.feature.home.HomeRoute
import ru.scada.mobile.feature.login.LoginRoute

object Routes {
    const val LOGIN = "login"
    const val HOME = "home"
    const val ENROLL = "device/enroll"
}

/**
 * Граф верхнего уровня. Переход между «вход» и «рабочее пространство» решает
 * только AuthState: вход, истечение сессии (401) и выход обрабатываются одинаково.
 */
@Composable
fun AppNavHost(auth: AuthState, nav: NavHostController = rememberNavController()) {
    val signedIn = auth is AuthState.SignedIn
    LaunchedEffect(signedIn) {
        val target = if (signedIn) Routes.HOME else Routes.LOGIN
        if (nav.currentDestination?.route != target) {
            nav.navigate(target) {
                popUpTo(nav.graph.id) { inclusive = true }
                launchSingleTop = true
            }
        }
    }
    NavHost(
        navController = nav,
        startDestination = if (signedIn) Routes.HOME else Routes.LOGIN,
        enterTransition = { fadeIn() + slideInHorizontally { it / 8 } },
        exitTransition = { fadeOut() },
        popEnterTransition = { fadeIn() },
        popExitTransition = { fadeOut() + slideOutHorizontally { it / 8 } },
    ) {
        composable(Routes.LOGIN) { LoginRoute() }
        composable(Routes.HOME) { HomeRoute(onEnrollDevice = { nav.navigate(Routes.ENROLL) }) }
        composable(Routes.ENROLL) { EnrollRoute(onBack = { nav.popBackStack() }) }
    }
}
