package com.peasyproxy.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(
    val route: String,
    val title: String,
    val icon: ImageVector? = null
) {
    object Home : Screen("home", "Home", Icons.Default.Home)
    object ProxyList : Screen("proxy_list", "Proxies", Icons.Default.List)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
    object Statistics : Screen("statistics", "Statistics", Icons.Default.BarChart)
    object AppRouting : Screen("app_routing", "App Routing", null)
    object DnsSettings : Screen("dns_settings", "DNS Settings", null)
    object ImportExport : Screen("import_export", "Import/Export", null)
    object AdvancedSettings : Screen("advanced_settings", "Advanced Settings", null)
    object NotificationSettings : Screen("notification_settings", "Notification Settings", null)
    object LanguageSettings : Screen("language_settings", "Language Settings", null)
}

val bottomNavItems = listOf(
    Screen.Home,
    Screen.ProxyList,
    Screen.Statistics,
    Screen.Settings
)