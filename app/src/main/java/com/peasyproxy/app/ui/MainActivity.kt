package com.peasyproxy.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.peasyproxy.app.data.repository.SettingsRepository
import com.peasyproxy.app.ui.navigation.Screen
import com.peasyproxy.app.ui.navigation.bottomNavItems
import com.peasyproxy.app.ui.screens.approuting.AppRoutingScreen
import com.peasyproxy.app.ui.screens.dns.DnsSettingsScreen
import com.peasyproxy.app.ui.screens.home.HomeScreen
import com.peasyproxy.app.ui.screens.importexport.ImportExportScreen
import com.peasyproxy.app.ui.screens.proxylist.ProxyListScreen
import com.peasyproxy.app.ui.screens.settings.SettingsScreen
import com.peasyproxy.app.ui.screens.settings.AdvancedSettingsScreen
import com.peasyproxy.app.ui.screens.settings.NotificationSettingsScreen
import com.peasyproxy.app.ui.screens.settings.LanguageSettingsScreen
import com.peasyproxy.app.ui.screens.statistics.StatisticsScreen
import com.peasyproxy.app.ui.theme.PeasyProxyTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var settingsRepository: SettingsRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val settings by settingsRepository.settingsFlow.collectAsStateWithLifecycle(
                initialValue = com.peasyproxy.app.domain.model.AppSettings()
            )

            PeasyProxyTheme(darkMode = settings.darkMode) {
                MainScreen()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            NavigationBar {
                bottomNavItems.forEach { screen ->
                    NavigationBarItem(
                        icon = {
                            screen.icon?.let { icon ->
                                Icon(
                                    imageVector = icon,
                                    contentDescription = screen.title
                                )
                            }
                        },
                        label = { Text(screen.title) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    onNavigateToProxyList = {
                        navController.navigate(Screen.ProxyList.route)
                    }
                )
            }
            composable(Screen.ProxyList.route) {
                ProxyListScreen(
                    onProxySelect = { proxyId ->
                        navController.popBackStack()
                    }
                )
            }
            composable(Screen.Settings.route) {
                SettingsScreen(
                    onNavigateToAppRouting = { navController.navigate(Screen.AppRouting.route) },
                    onNavigateToDnsSettings = { navController.navigate(Screen.DnsSettings.route) },
                    onNavigateToImportExport = { navController.navigate(Screen.ImportExport.route) },
                    onNavigateToAdvancedSettings = { navController.navigate(Screen.AdvancedSettings.route) },
                    onNavigateToNotificationSettings = { navController.navigate(Screen.NotificationSettings.route) },
                    onNavigateToLanguageSettings = { navController.navigate(Screen.LanguageSettings.route) }
                )
            }
            composable(Screen.Statistics.route) {
                StatisticsScreen()
            }
            composable(Screen.AppRouting.route) {
                AppRoutingScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Screen.DnsSettings.route) {
                DnsSettingsScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Screen.ImportExport.route) {
                ImportExportScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Screen.AdvancedSettings.route) {
                AdvancedSettingsScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Screen.NotificationSettings.route) {
                NotificationSettingsScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Screen.LanguageSettings.route) {
                LanguageSettingsScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
    }
}