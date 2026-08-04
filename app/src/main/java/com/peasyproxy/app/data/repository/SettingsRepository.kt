package com.peasyproxy.app.data.repository

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.peasyproxy.app.domain.model.AppRoutingConfig
import com.peasyproxy.app.domain.model.AppSettings
import com.peasyproxy.app.domain.model.AutoRotateInterval
import com.peasyproxy.app.domain.model.DarkMode
import com.peasyproxy.app.domain.model.DnsConfig
import com.peasyproxy.app.domain.model.NotificationPreferences
import com.peasyproxy.app.domain.model.RotationStrategy
import com.tencent.mmkv.MMKV
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SettingsRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson
) {

    init {
        MMKV.initialize(context)
    }

    private val mmkv: MMKV by lazy {
        MMKV.mmkvWithID("peasyproxy_settings", MMKV.MULTI_PROCESS_MODE)
    }

    // =========================================================================
    // Main settings flow (replaces DataStore-based Flow)
    // =========================================================================

    private val _settingsFlow = MutableStateFlow(loadSettings())
    val settingsFlow: StateFlow<AppSettings> = _settingsFlow.asStateFlow()

    private fun loadSettings(): AppSettings {
        return AppSettings(
            autoConnectOnStart = mmkv.decodeBool("auto_connect_on_start", false),
            autoReconnect = mmkv.decodeBool("auto_reconnect", true),
            failoverEnabled = mmkv.decodeBool("failover_enabled", true),
            killSwitchEnabled = mmkv.decodeBool("kill_switch_enabled", false),
            autoRotateEnabled = mmkv.decodeBool("auto_rotate_enabled", false),
            autoRotateIntervalMinutes = mmkv.decodeInt("auto_rotate_interval", 15),
            rotationStrategy = try {
                RotationStrategy.valueOf(mmkv.decodeString("rotation_strategy") ?: "FASTEST")
            } catch (e: Exception) {
                RotationStrategy.FASTEST
            },
            connectionTimeout = mmkv.decodeInt("connection_timeout", 5000),
            healthCheckIntervalSeconds = mmkv.decodeInt("health_check_interval", 30),
            notificationsEnabled = mmkv.decodeBool("notifications_enabled", true),
            errorAlertsEnabled = mmkv.decodeBool("error_alerts_enabled", true),
            darkMode = try {
                DarkMode.valueOf(mmkv.decodeString("dark_mode") ?: "SYSTEM")
            } catch (e: Exception) {
                DarkMode.SYSTEM
            },
            selectedTestEndpoints = decodeStringList(mmkv.decodeString("selected_test_endpoints"))
                .ifEmpty { AppSettings.DEFAULT_TEST_ENDPOINTS },
            customDnsEnabled = mmkv.decodeBool("custom_dns_enabled", false),
            primaryDns = mmkv.decodeString("primary_dns") ?: "8.8.8.8",
            secondaryDns = mmkv.decodeString("secondary_dns") ?: "8.8.4.4",
            vpnEnabled = mmkv.decodeBool("vpn_enabled", false)
        )
    }

    private fun emitSettings() {
        _settingsFlow.value = loadSettings()
    }

    // =========================================================================
    // DNS config flow — derived from main settings flow
    // =========================================================================

    val dnsConfigFlow: Flow<DnsConfig> = _settingsFlow.map { settings ->
        DnsConfig(
            customDnsEnabled = settings.customDnsEnabled,
            primaryDns = settings.primaryDns,
            secondaryDns = settings.secondaryDns
        )
    }

    // =========================================================================
    // App routing flow
    // =========================================================================

    private val _appRoutingFlow = MutableStateFlow(loadAppRoutingConfig())
    val appRoutingFlow: StateFlow<AppRoutingConfig> = _appRoutingFlow.asStateFlow()

    private fun loadAppRoutingConfig(): AppRoutingConfig {
        val isIncludeMode = mmkv.decodeBool("is_include_mode", true)
        return AppRoutingConfig(
            mode = if (isIncludeMode) AppRoutingConfig.Mode.INCLUDE else AppRoutingConfig.Mode.EXCLUDE,
            includedApps = decodeStringList(mmkv.decodeString("included_apps")).toSet(),
            excludedApps = decodeStringList(mmkv.decodeString("excluded_apps")).toSet(),
            allowBypass = mmkv.decodeBool("allow_bypass", false)
        )
    }

    private fun emitAppRouting() {
        _appRoutingFlow.value = loadAppRoutingConfig()
    }

    // =========================================================================
    // Notification preferences flow
    // =========================================================================

    private val _notificationPreferencesFlow = MutableStateFlow(loadNotificationPreferences())
    val notificationPreferencesFlow: StateFlow<NotificationPreferences> = _notificationPreferencesFlow.asStateFlow()

    private fun loadNotificationPreferences(): NotificationPreferences {
        return NotificationPreferences(
            connectionNotifications = mmkv.decodeBool("connection_notifications", true),
            errorAlerts = mmkv.decodeBool("error_alerts", true),
            soundEnabled = mmkv.decodeBool("sound_enabled", true),
            vibrationEnabled = mmkv.decodeBool("vibration_enabled", true),
            soundUri = mmkv.decodeString("sound_uri"),
            vibrationPattern = decodeLongList(mmkv.decodeString("vibration_pattern"))
                ?: listOf(0, 250, 250, 250)
        )
    }

    private fun emitNotificationPreferences() {
        _notificationPreferencesFlow.value = loadNotificationPreferences()
    }

    // =========================================================================
    // Language flow
    // =========================================================================

    private val _languageFlow = MutableStateFlow(loadLanguage())
    val languageFlow: StateFlow<String> = _languageFlow.asStateFlow()

    private fun loadLanguage(): String {
        return mmkv.decodeString("language") ?: "en"
    }

    // =========================================================================
    // Split tunnel mode flow
    // =========================================================================

    private val _splitTunnelModeFlow = MutableStateFlow(loadSplitTunnelMode())
    val splitTunnelModeFlow: StateFlow<com.peasyproxy.app.domain.model.SplitTunnelMode> = _splitTunnelModeFlow.asStateFlow()

    private fun loadSplitTunnelMode(): com.peasyproxy.app.domain.model.SplitTunnelMode {
        return try {
            com.peasyproxy.app.domain.model.SplitTunnelMode.valueOf(
                mmkv.decodeString("split_tunnel_mode") ?: "DISABLED"
            )
        } catch (e: Exception) {
            com.peasyproxy.app.domain.model.SplitTunnelMode.DISABLED
        }
    }

    // =========================================================================
    // Serialization helpers (Issue #27: JSON replaces fragile comma-separated)
    // =========================================================================

    private fun encodeStringList(list: Iterable<String>): String {
        return gson.toJson(list.toList())
    }

    private fun decodeStringList(encoded: String?): List<String> {
        if (encoded.isNullOrBlank()) return emptyList()
        return try {
            gson.fromJson(encoded, object : TypeToken<List<String>>() {}.type)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun encodeLongList(list: List<Long>): String {
        return gson.toJson(list)
    }

    private fun decodeLongList(encoded: String?): List<Long>? {
        if (encoded.isNullOrBlank()) return null
        return try {
            gson.fromJson(encoded, object : TypeToken<List<Long>>() {}.type)
        } catch (e: Exception) {
            null
        }
    }

    // =========================================================================
    // Generic MMKV write + emit helper
    // =========================================================================

    private inline fun <reified T> updateField(
        key: String,
        value: T,
        emit: () -> Unit
    ) {
        when (value) {
            is Boolean -> mmkv.encode(key, value)
            is Int -> mmkv.encode(key, value)
            is Long -> mmkv.encode(key, value)
            is Float -> mmkv.encode(key, value)
            is Double -> mmkv.encode(key, value)
            is String -> mmkv.encode(key, value)
            else -> mmkv.encode(key, gson.toJson(value))
        }
        emit()
    }

    // =========================================================================
    // Settings update methods
    // =========================================================================

    fun updateAutoConnectOnStart(enabled: Boolean) =
        updateField("auto_connect_on_start", enabled) { emitSettings() }

    fun updateAutoReconnect(enabled: Boolean) =
        updateField("auto_reconnect", enabled) { emitSettings() }

    fun updateFailoverEnabled(enabled: Boolean) =
        updateField("failover_enabled", enabled) { emitSettings() }

    fun updateKillSwitchEnabled(enabled: Boolean) =
        updateField("kill_switch_enabled", enabled) { emitSettings() }

    fun updateAutoRotateEnabled(enabled: Boolean) =
        updateField("auto_rotate_enabled", enabled) { emitSettings() }

    fun updateAutoRotateInterval(interval: AutoRotateInterval) =
        updateField("auto_rotate_interval", interval.minutes) { emitSettings() }

    fun updateRotationStrategy(strategy: RotationStrategy) =
        updateField("rotation_strategy", strategy.name) { emitSettings() }

    fun updateConnectionTimeout(timeout: Int) =
        updateField("connection_timeout", timeout) { emitSettings() }

    fun updateHealthCheckInterval(interval: Int) =
        updateField("health_check_interval", interval) { emitSettings() }

    fun updateNotificationsEnabled(enabled: Boolean) =
        updateField("notifications_enabled", enabled) { emitSettings() }

    fun updateErrorAlertsEnabled(enabled: Boolean) =
        updateField("error_alerts_enabled", enabled) { emitSettings() }

    fun updateDarkMode(mode: DarkMode) =
        updateField("dark_mode", mode.name) { emitSettings() }

    fun updateSelectedTestEndpoints(endpoints: List<String>) {
        mmkv.encode("selected_test_endpoints", encodeStringList(endpoints))
        emitSettings()
    }

    fun updateLastSelectedProxyId(proxyId: String?) {
        if (proxyId != null) {
            mmkv.encode("last_selected_proxy_id", proxyId)
        } else {
            mmkv.removeValueForKey("last_selected_proxy_id")
        }
    }

    fun getLastSelectedProxyId(): String? {
        return mmkv.decodeString("last_selected_proxy_id", null)
    }

    fun updateVpnEnabled(enabled: Boolean) =
        updateField("vpn_enabled", enabled) { emitSettings() }

    fun updateAllowBypass(allow: Boolean) {
        mmkv.encode("allow_bypass", allow)
        emitAppRouting()
    }

    // =========================================================================
    // DNS config update methods
    // =========================================================================

    fun updateDnsConfig(config: DnsConfig) {
        updateField("custom_dns_enabled", config.customDnsEnabled) { }
        updateField("primary_dns", config.primaryDns) { }
        updateField("secondary_dns", config.secondaryDns) { emitSettings() }
    }

    fun updateCustomDnsEnabled(enabled: Boolean) =
        updateField("custom_dns_enabled", enabled) { emitSettings() }

    fun updatePrimaryDns(dns: String) =
        updateField("primary_dns", dns) { emitSettings() }

    fun updateSecondaryDns(dns: String) =
        updateField("secondary_dns", dns) { emitSettings() }

    // =========================================================================
    // App routing update methods (Issue #27: JSON serialization)
    // =========================================================================

    fun updateAppRoutingConfig(config: AppRoutingConfig) {
        mmkv.encode("included_apps", encodeStringList(config.includedApps))
        mmkv.encode("excluded_apps", encodeStringList(config.excludedApps))
        mmkv.encode("is_include_mode", config.isIncludeMode)
        emitAppRouting()
    }

    fun addIncludedApp(packageName: String) {
        val current = decodeStringList(mmkv.decodeString("included_apps")).toMutableList()
        if (!current.contains(packageName)) {
            current.add(packageName)
        }
        mmkv.encode("included_apps", encodeStringList(current))
        emitAppRouting()
    }

    fun removeIncludedApp(packageName: String) {
        val current = decodeStringList(mmkv.decodeString("included_apps")).toMutableList()
        current.remove(packageName)
        mmkv.encode("included_apps", encodeStringList(current))
        emitAppRouting()
    }

    fun addExcludedApp(packageName: String) {
        val current = decodeStringList(mmkv.decodeString("excluded_apps")).toMutableList()
        if (!current.contains(packageName)) {
            current.add(packageName)
        }
        mmkv.encode("excluded_apps", encodeStringList(current))
        emitAppRouting()
    }

    fun removeExcludedApp(packageName: String) {
        val current = decodeStringList(mmkv.decodeString("excluded_apps")).toMutableList()
        current.remove(packageName)
        mmkv.encode("excluded_apps", encodeStringList(current))
        emitAppRouting()
    }

    fun updateIncludeMode(isIncludeMode: Boolean) {
        mmkv.encode("is_include_mode", isIncludeMode)
        emitAppRouting()
    }

    fun updateSettings(settings: AppSettings) {
        updateField("auto_connect_on_start", settings.autoConnectOnStart) { }
        updateField("auto_reconnect", settings.autoReconnect) { }
        updateField("failover_enabled", settings.failoverEnabled) { }
        updateField("kill_switch_enabled", settings.killSwitchEnabled) { }
        updateField("vpn_enabled", settings.vpnEnabled) { }
        updateField("auto_rotate_enabled", settings.autoRotateEnabled) { }
        updateField("auto_rotate_interval", settings.autoRotateIntervalMinutes) { }
        updateField("rotation_strategy", settings.rotationStrategy.name) { }
        updateField("connection_timeout", settings.connectionTimeout) { }
        updateField("health_check_interval", settings.healthCheckIntervalSeconds) { }
        updateField("notifications_enabled", settings.notificationsEnabled) { }
        updateField("error_alerts_enabled", settings.errorAlertsEnabled) { }
        updateField("dark_mode", settings.darkMode.name) { }
        updateField("selected_test_endpoints", encodeStringList(settings.selectedTestEndpoints)) { }
        updateField("custom_dns_enabled", settings.customDnsEnabled) { }
        updateField("primary_dns", settings.primaryDns) { }
        updateField("secondary_dns", settings.secondaryDns) { }
        emitSettings()
    }

    // =========================================================================
    // Notification preferences update methods
    // =========================================================================

    fun updateNotificationPreferences(prefs: NotificationPreferences) {
        updateField("connection_notifications", prefs.connectionNotifications) { }
        updateField("error_alerts", prefs.errorAlerts) { }
        updateField("sound_enabled", prefs.soundEnabled) { }
        updateField("vibration_enabled", prefs.vibrationEnabled) { }
        if (prefs.soundUri != null) {
            mmkv.encode("sound_uri", prefs.soundUri)
        } else {
            mmkv.removeValueForKey("sound_uri")
        }
        updateField("vibration_pattern", encodeLongList(prefs.vibrationPattern)) { }
        emitNotificationPreferences()
    }

    fun updateConnectionNotifications(enabled: Boolean) =
        updateField("connection_notifications", enabled) { emitNotificationPreferences() }

    fun updateErrorAlerts(enabled: Boolean) =
        updateField("error_alerts", enabled) { emitNotificationPreferences() }

    fun updateSoundEnabled(enabled: Boolean) =
        updateField("sound_enabled", enabled) { emitNotificationPreferences() }

    fun updateVibrationEnabled(enabled: Boolean) =
        updateField("vibration_enabled", enabled) { emitNotificationPreferences() }

    fun updateSoundUri(uri: String?) {
        if (uri != null) {
            mmkv.encode("sound_uri", uri)
        } else {
            mmkv.removeValueForKey("sound_uri")
        }
        emitNotificationPreferences()
    }

    fun updateVibrationPattern(pattern: List<Long>) {
        mmkv.encode("vibration_pattern", encodeLongList(pattern))
        emitNotificationPreferences()
    }

    // =========================================================================
    // Language
    // =========================================================================

    fun updateLanguage(language: String) {
        mmkv.encode("language", language)
        _languageFlow.value = language
    }

    // =========================================================================
    // Split tunnel mode
    // =========================================================================

    fun updateSplitTunnelMode(mode: com.peasyproxy.app.domain.model.SplitTunnelMode) {
        mmkv.encode("split_tunnel_mode", mode.name)
        _splitTunnelModeFlow.value = mode
    }
}
