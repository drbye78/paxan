package com.proxymania.app.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.proxymania.app.domain.model.AppRoutingConfig
import com.proxymania.app.domain.model.AppSettings
import com.proxymania.app.domain.model.AutoRotateInterval
import com.proxymania.app.domain.model.DarkMode
import com.proxymania.app.domain.model.DnsConfig
import com.proxymania.app.domain.model.NotificationPreferences
import com.proxymania.app.domain.model.RotationStrategy
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

@Singleton
class SettingsRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private object PreferencesKeys {
        val AUTO_CONNECT_ON_START = booleanPreferencesKey("auto_connect_on_start")
        val AUTO_RECONNECT = booleanPreferencesKey("auto_reconnect")
        val FAILOVER_ENABLED = booleanPreferencesKey("failover_enabled")
        val KILL_SWITCH_ENABLED = booleanPreferencesKey("kill_switch_enabled")
        val AUTO_ROTATE_ENABLED = booleanPreferencesKey("auto_rotate_enabled")
        val AUTO_ROTATE_INTERVAL = intPreferencesKey("auto_rotate_interval")
        val ROTATION_STRATEGY = stringPreferencesKey("rotation_strategy")
        val CONNECTION_TIMEOUT = intPreferencesKey("connection_timeout")
        val HEALTH_CHECK_INTERVAL = intPreferencesKey("health_check_interval")
        val NOTIFICATIONS_ENABLED = booleanPreferencesKey("notifications_enabled")
        val ERROR_ALERTS_ENABLED = booleanPreferencesKey("error_alerts_enabled")
        val DARK_MODE = stringPreferencesKey("dark_mode")
        val SELECTED_TEST_ENDPOINTS = stringPreferencesKey("selected_test_endpoints")
        val LAST_SELECTED_PROXY_ID = stringPreferencesKey("last_selected_proxy_id")
        val VPN_ENABLED = booleanPreferencesKey("vpn_enabled")
        val ALLOW_BYPASS = booleanPreferencesKey("allow_bypass")
        
        // DNS Config
        val CUSTOM_DNS_ENABLED = booleanPreferencesKey("custom_dns_enabled")
        val PRIMARY_DNS = stringPreferencesKey("primary_dns")
        val SECONDARY_DNS = stringPreferencesKey("secondary_dns")
        
        // App Routing
        val INCLUDED_APPS = stringPreferencesKey("included_apps")
        val EXCLUDED_APPS = stringPreferencesKey("excluded_apps")
        val IS_INCLUDE_MODE = booleanPreferencesKey("is_include_mode")
        
        // Notification Preferences
        val CONNECTION_NOTIFICATIONS = booleanPreferencesKey("connection_notifications")
        val ERROR_ALERTS = booleanPreferencesKey("error_alerts")
        val SOUND_ENABLED = booleanPreferencesKey("sound_enabled")
        val VIBRATION_ENABLED = booleanPreferencesKey("vibration_enabled")
        val SOUND_URI = stringPreferencesKey("sound_uri")
        val VIBRATION_PATTERN = stringPreferencesKey("vibration_pattern")

        // Language
        val LANGUAGE = stringPreferencesKey("language")

        // Split Tunnel
        val SPLIT_TUNNEL_MODE = stringPreferencesKey("split_tunnel_mode")
    }

    private val _dnsConfigFlow = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            DnsConfig(
                customDnsEnabled = preferences[PreferencesKeys.CUSTOM_DNS_ENABLED] ?: false,
                primaryDns = preferences[PreferencesKeys.PRIMARY_DNS] ?: "8.8.8.8",
                secondaryDns = preferences[PreferencesKeys.SECONDARY_DNS] ?: "8.8.4.4"
            )
        }

    val dnsConfigFlow: Flow<DnsConfig> = _dnsConfigFlow

    private val _appRoutingFlow = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            AppRoutingConfig(
                includedApps = preferences[PreferencesKeys.INCLUDED_APPS]
                    ?.split(",")
                    ?.filter { it.isNotBlank() }
                    ?.toSet() ?: emptySet(),
                excludedApps = preferences[PreferencesKeys.EXCLUDED_APPS]
                    ?.split(",")
                    ?.filter { it.isNotBlank() }
                    ?.toSet() ?: emptySet(),
                isIncludeMode = preferences[PreferencesKeys.IS_INCLUDE_MODE] ?: true,
                allowBypass = preferences[PreferencesKeys.ALLOW_BYPASS] ?: false
            )
        }

    val appRoutingFlow: Flow<AppRoutingConfig> = _appRoutingFlow

    private val _notificationPreferencesFlow = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            NotificationPreferences(
                connectionNotifications = preferences[PreferencesKeys.CONNECTION_NOTIFICATIONS] ?: true,
                errorAlerts = preferences[PreferencesKeys.ERROR_ALERTS] ?: true,
                soundEnabled = preferences[PreferencesKeys.SOUND_ENABLED] ?: true,
                vibrationEnabled = preferences[PreferencesKeys.VIBRATION_ENABLED] ?: true,
                soundUri = preferences[PreferencesKeys.SOUND_URI],
                vibrationPattern = preferences[PreferencesKeys.VIBRATION_PATTERN]
                    ?.split(",")
                    ?.map { it.toLong() }
                    ?.toLongArray() ?: longArrayOf(0, 250, 250, 250)
            )
        }

    val notificationPreferencesFlow: Flow<NotificationPreferences> = _notificationPreferencesFlow

    private val _languageFlow = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            preferences[PreferencesKeys.LANGUAGE] ?: "en"
        }

    val languageFlow: Flow<String> = _languageFlow

    private val _splitTunnelModeFlow = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            try {
                com.proxymania.app.domain.model.SplitTunnelMode.valueOf(
                    preferences[PreferencesKeys.SPLIT_TUNNEL_MODE] ?: "DISABLED"
                )
            } catch (e: Exception) {
                com.proxymania.app.domain.model.SplitTunnelMode.DISABLED
            }
        }

    val splitTunnelModeFlow: Flow<com.proxymania.app.domain.model.SplitTunnelMode> = _splitTunnelModeFlow

    val settingsFlow: Flow<AppSettings> = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            mapToSettings(preferences)
        }

    suspend fun updateAutoConnectOnStart(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.AUTO_CONNECT_ON_START] = enabled
        }
    }

    suspend fun updateAutoReconnect(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.AUTO_RECONNECT] = enabled
        }
    }

    suspend fun updateFailoverEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.FAILOVER_ENABLED] = enabled
        }
    }

    suspend fun updateKillSwitchEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.KILL_SWITCH_ENABLED] = enabled
        }
    }

    suspend fun updateAutoRotateEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.AUTO_ROTATE_ENABLED] = enabled
        }
    }

    suspend fun updateAutoRotateInterval(interval: AutoRotateInterval) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.AUTO_ROTATE_INTERVAL] = interval.minutes
        }
    }

    suspend fun updateRotationStrategy(strategy: RotationStrategy) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.ROTATION_STRATEGY] = strategy.name
        }
    }

    suspend fun updateConnectionTimeout(timeout: Int) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.CONNECTION_TIMEOUT] = timeout
        }
    }

    suspend fun updateHealthCheckInterval(interval: Int) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.HEALTH_CHECK_INTERVAL] = interval
        }
    }

    suspend fun updateNotificationsEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.NOTIFICATIONS_ENABLED] = enabled
        }
    }

    suspend fun updateErrorAlertsEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.ERROR_ALERTS_ENABLED] = enabled
        }
    }

    suspend fun updateDarkMode(mode: DarkMode) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.DARK_MODE] = mode.name
        }
    }

    suspend fun updateSelectedTestEndpoints(endpoints: List<String>) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.SELECTED_TEST_ENDPOINTS] = endpoints.joinToString(",")
        }
    }

    suspend fun updateLastSelectedProxyId(proxyId: String?) {
        context.dataStore.edit { preferences ->
            if (proxyId != null) {
                preferences[PreferencesKeys.LAST_SELECTED_PROXY_ID] = proxyId
            } else {
                preferences.remove(PreferencesKeys.LAST_SELECTED_PROXY_ID)
            }
        }
    }

    suspend fun updateVpnEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.VPN_ENABLED] = enabled
        }
    }

    suspend fun updateAllowBypass(allow: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.ALLOW_BYPASS] = allow
        }
    }

    suspend fun updateDnsConfig(config: DnsConfig) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.CUSTOM_DNS_ENABLED] = config.customDnsEnabled
            preferences[PreferencesKeys.PRIMARY_DNS] = config.primaryDns
            preferences[PreferencesKeys.SECONDARY_DNS] = config.secondaryDns
        }
    }

    suspend fun updateCustomDnsEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.CUSTOM_DNS_ENABLED] = enabled
        }
    }

    suspend fun updatePrimaryDns(dns: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.PRIMARY_DNS] = dns
        }
    }

    suspend fun updateSecondaryDns(dns: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.SECONDARY_DNS] = dns
        }
    }

    suspend fun updateAppRoutingConfig(config: AppRoutingConfig) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.INCLUDED_APPS] = config.includedApps.joinToString(",")
            preferences[PreferencesKeys.EXCLUDED_APPS] = config.excludedApps.joinToString(",")
            preferences[PreferencesKeys.IS_INCLUDE_MODE] = config.isIncludeMode
        }
    }

    suspend fun addIncludedApp(packageName: String) {
        context.dataStore.edit { preferences ->
            val current = preferences[PreferencesKeys.INCLUDED_APPS]
                ?.split(",")
                ?.filter { it.isNotBlank() }
                ?.toMutableSet() ?: mutableSetOf()
            current.add(packageName)
            preferences[PreferencesKeys.INCLUDED_APPS] = current.joinToString(",")
        }
    }

    suspend fun removeIncludedApp(packageName: String) {
        context.dataStore.edit { preferences ->
            val current = preferences[PreferencesKeys.INCLUDED_APPS]
                ?.split(",")
                ?.filter { it.isNotBlank() }
                ?.toMutableSet() ?: mutableSetOf()
            current.remove(packageName)
            preferences[PreferencesKeys.INCLUDED_APPS] = current.joinToString(",")
        }
    }

    suspend fun addExcludedApp(packageName: String) {
        context.dataStore.edit { preferences ->
            val current = preferences[PreferencesKeys.EXCLUDED_APPS]
                ?.split(",")
                ?.filter { it.isNotBlank() }
                ?.toMutableSet() ?: mutableSetOf()
            current.add(packageName)
            preferences[PreferencesKeys.EXCLUDED_APPS] = current.joinToString(",")
        }
    }

    suspend fun removeExcludedApp(packageName: String) {
        context.dataStore.edit { preferences ->
            val current = preferences[PreferencesKeys.EXCLUDED_APPS]
                ?.split(",")
                ?.filter { it.isNotBlank() }
                ?.toMutableSet() ?: mutableSetOf()
            current.remove(packageName)
            preferences[PreferencesKeys.EXCLUDED_APPS] = current.joinToString(",")
        }
    }

    suspend fun updateIncludeMode(isIncludeMode: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.IS_INCLUDE_MODE] = isIncludeMode
        }
    }

    suspend fun updateSettings(settings: AppSettings) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.AUTO_CONNECT_ON_START] = settings.autoConnectOnStart
            preferences[PreferencesKeys.AUTO_RECONNECT] = settings.autoReconnect
            preferences[PreferencesKeys.FAILOVER_ENABLED] = settings.failoverEnabled
            preferences[PreferencesKeys.KILL_SWITCH_ENABLED] = settings.killSwitchEnabled
            preferences[PreferencesKeys.AUTO_ROTATE_ENABLED] = settings.autoRotateEnabled
            preferences[PreferencesKeys.AUTO_ROTATE_INTERVAL] = settings.autoRotateIntervalMinutes
            preferences[PreferencesKeys.ROTATION_STRATEGY] = settings.rotationStrategy.name
            preferences[PreferencesKeys.CONNECTION_TIMEOUT] = settings.connectionTimeout
            preferences[PreferencesKeys.HEALTH_CHECK_INTERVAL] = settings.healthCheckIntervalSeconds
            preferences[PreferencesKeys.NOTIFICATIONS_ENABLED] = settings.notificationsEnabled
            preferences[PreferencesKeys.ERROR_ALERTS_ENABLED] = settings.errorAlertsEnabled
            preferences[PreferencesKeys.DARK_MODE] = settings.darkMode.name
            preferences[PreferencesKeys.SELECTED_TEST_ENDPOINTS] = settings.selectedTestEndpoints.joinToString(",")
        }
    }

    private fun mapToSettings(preferences: Preferences): AppSettings {
        return AppSettings(
            autoConnectOnStart = preferences[PreferencesKeys.AUTO_CONNECT_ON_START] ?: false,
            autoReconnect = preferences[PreferencesKeys.AUTO_RECONNECT] ?: true,
            failoverEnabled = preferences[PreferencesKeys.FAILOVER_ENABLED] ?: true,
            killSwitchEnabled = preferences[PreferencesKeys.KILL_SWITCH_ENABLED] ?: false,
            autoRotateEnabled = preferences[PreferencesKeys.AUTO_ROTATE_ENABLED] ?: false,
            autoRotateIntervalMinutes = preferences[PreferencesKeys.AUTO_ROTATE_INTERVAL] ?: 15,
            rotationStrategy = try {
                RotationStrategy.valueOf(preferences[PreferencesKeys.ROTATION_STRATEGY] ?: "FASTEST")
            } catch (e: Exception) {
                RotationStrategy.FASTEST
            },
            connectionTimeout = preferences[PreferencesKeys.CONNECTION_TIMEOUT] ?: 5000,
            healthCheckIntervalSeconds = preferences[PreferencesKeys.HEALTH_CHECK_INTERVAL] ?: 30,
            notificationsEnabled = preferences[PreferencesKeys.NOTIFICATIONS_ENABLED] ?: true,
            errorAlertsEnabled = preferences[PreferencesKeys.ERROR_ALERTS_ENABLED] ?: true,
            darkMode = try {
                DarkMode.valueOf(preferences[PreferencesKeys.DARK_MODE] ?: "SYSTEM")
            } catch (e: Exception) {
                DarkMode.SYSTEM
            },
            selectedTestEndpoints = preferences[PreferencesKeys.SELECTED_TEST_ENDPOINTS]
                ?.split(",")
                ?.filter { it.isNotBlank() }
                ?: AppSettings.DEFAULT_TEST_ENDPOINTS
        )
    }

    suspend fun updateNotificationPreferences(prefs: NotificationPreferences) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.CONNECTION_NOTIFICATIONS] = prefs.connectionNotifications
            preferences[PreferencesKeys.ERROR_ALERTS] = prefs.errorAlerts
            preferences[PreferencesKeys.SOUND_ENABLED] = prefs.soundEnabled
            preferences[PreferencesKeys.VIBRATION_ENABLED] = prefs.vibrationEnabled
            prefs.soundUri?.let { preferences[PreferencesKeys.SOUND_URI] = it }
            preferences[PreferencesKeys.VIBRATION_PATTERN] = prefs.vibrationPattern.joinToString(",")
        }
    }

    suspend fun updateConnectionNotifications(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.CONNECTION_NOTIFICATIONS] = enabled
        }
    }

    suspend fun updateErrorAlerts(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.ERROR_ALERTS] = enabled
        }
    }

    suspend fun updateSoundEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.SOUND_ENABLED] = enabled
        }
    }

    suspend fun updateVibrationEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.VIBRATION_ENABLED] = enabled
        }
    }

    suspend fun updateSoundUri(uri: String?) {
        context.dataStore.edit { preferences ->
            if (uri != null) {
                preferences[PreferencesKeys.SOUND_URI] = uri
            } else {
                preferences.remove(PreferencesKeys.SOUND_URI)
            }
        }
    }

    suspend fun updateVibrationPattern(pattern: LongArray) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.VIBRATION_PATTERN] = pattern.joinToString(",")
        }
    }

    suspend fun updateLanguage(language: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.LANGUAGE] = language
        }
    }

    suspend fun updateSplitTunnelMode(mode: com.proxymania.app.domain.model.SplitTunnelMode) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.SPLIT_TUNNEL_MODE] = mode.name
        }
    }
}