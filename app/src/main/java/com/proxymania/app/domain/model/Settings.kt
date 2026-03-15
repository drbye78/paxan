package com.proxymania.app.domain.model

data class AppSettings(
    val autoConnectOnStart: Boolean = false,
    val autoReconnect: Boolean = true,
    val failoverEnabled: Boolean = true,
    val killSwitchEnabled: Boolean = false,
    val autoRotateEnabled: Boolean = false,
    val autoRotateIntervalMinutes: Int = 15,
    val rotationStrategy: RotationStrategy = RotationStrategy.FASTEST,
    val connectionTimeout: Int = 5000,
    val healthCheckIntervalSeconds: Int = 30,
    val notificationsEnabled: Boolean = true,
    val errorAlertsEnabled: Boolean = true,
    val darkMode: DarkMode = DarkMode.SYSTEM,
    val selectedTestEndpoints: List<String> = DEFAULT_TEST_ENDPOINTS
) {
    companion object {
        val DEFAULT_TEST_ENDPOINTS = listOf(
            "https://www.google.com",
            "https://httpbin.org/ip",
            "https://connectivitycheck.gstatic.com/generate_204"
        )
    }
}

enum class RotationStrategy {
    RANDOM,
    FASTEST,
    LEAST_USED,
    HIGHEST_TRUST
}

enum class DarkMode {
    LIGHT,
    DARK,
    AMOLED,
    SYSTEM
}

enum class AutoRotateInterval(val minutes: Int, val display: String) {
    OFF(0, "Off"),
    FIVE_MINUTES(5, "5 minutes"),
    FIFTEEN_MINUTES(15, "15 minutes"),
    THIRTY_MINUTES(30, "30 minutes"),
    ONE_HOUR(60, "1 hour")
}