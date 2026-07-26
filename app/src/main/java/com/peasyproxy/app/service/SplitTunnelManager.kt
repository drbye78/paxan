package com.peasyproxy.app.service

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import com.peasyproxy.app.data.repository.SettingsRepository
import com.peasyproxy.app.domain.model.AppBundle
import com.peasyproxy.app.domain.model.AppCategory
import com.peasyproxy.app.domain.model.SplitTunnelConfig
import com.peasyproxy.app.domain.model.SplitTunnelMode
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SplitTunnelManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settingsRepository: SettingsRepository
) {

    private var currentConfig: SplitTunnelConfig? = null
    @Volatile private var isEnabled: Boolean = false

    suspend fun getConfig(): SplitTunnelConfig {
        return currentConfig ?: loadConfig()
    }

    private suspend fun loadConfig(): SplitTunnelConfig {
        val appRoutingConfig = settingsRepository.appRoutingFlow.first()
        
        val mode = if (appRoutingConfig.isIncludeMode) {
            if (appRoutingConfig.includedApps.isNotEmpty()) {
                SplitTunnelMode.INCLUDE
            } else {
                SplitTunnelMode.DISABLED
            }
        } else {
            if (appRoutingConfig.excludedApps.isNotEmpty()) {
                SplitTunnelMode.EXCLUDE
            } else {
                SplitTunnelMode.DISABLED
            }
        }

        return SplitTunnelConfig(
            mode = mode,
            includedApps = appRoutingConfig.includedApps,
            excludedApps = appRoutingConfig.excludedApps,
            appBundles = AppBundle.getDefaults()
        ).also { currentConfig = it }
    }

    suspend fun applyConfig(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return false
        }

        val config = getConfig()
        
        if (config.mode == SplitTunnelMode.DISABLED) {
            return true // No restrictions
        }

        return try {
            isEnabled = true
            true
        } catch (e: Exception) {
            Timber.e(e, "Failed to apply split tunnel config")
            isEnabled = false
            false
        }
    }

    suspend fun applyConfig(builder: android.net.VpnService.Builder): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Timber.w("Split tunneling requires Android 10+")
            return false
        }

        val config = getConfig()
        
        if (config.mode == SplitTunnelMode.DISABLED) {
            Timber.d("Split tunneling is disabled")
            return true
        }

        try {
            when (config.mode) {
                SplitTunnelMode.INCLUDE -> {
                    val packages = getVerifiedPackages(config.includedApps)
                    if (packages.isEmpty()) {
                        Timber.w("Split tunnel INCLUDE mode selected but no verified packages found")
                        return true
                    }
                    packages.forEach { pkg ->
                        try {
                            builder.addAllowedApplication(pkg)
                            Timber.d("Split tunnel: allowed $pkg")
                        } catch (e: Exception) {
                            Timber.w(e, "Failed to add allowed application: $pkg")
                        }
                    }
                }
                SplitTunnelMode.EXCLUDE,
                SplitTunnelMode.BYPASS -> {
                    val packages = getVerifiedPackages(config.excludedApps)
                    packages.forEach { pkg ->
                        try {
                            builder.addDisallowedApplication(pkg)
                            Timber.d("Split tunnel: disallowed $pkg")
                        } catch (e: Exception) {
                            Timber.w(e, "Failed to add disallowed application: $pkg")
                        }
                    }
                }
                SplitTunnelMode.DISABLED -> { /* no routing */ }
            }

            Timber.d("Split tunnel config applied, mode: ${config.mode}")
            isEnabled = true
            return true
        } catch (e: Exception) {
            Timber.e(e, "Failed to apply split tunnel config")
            isEnabled = false
            return false
        }
    }

    private fun getVerifiedPackages(packageNames: Set<String>): List<String> {
        val packageManager = context.packageManager
        return packageNames.filter { packageName ->
            try {
                packageManager.getPackageInfo(packageName, 0)
                true
            } catch (e: PackageManager.NameNotFoundException) {
                false
            }
        }
    }

    fun isAppUsingVpn(packageName: String): Boolean {
        val config = currentConfig ?: return true

        return when (config.mode) {
            SplitTunnelMode.DISABLED -> true
            SplitTunnelMode.INCLUDE -> config.includedApps.contains(packageName)
            SplitTunnelMode.EXCLUDE -> !config.excludedApps.contains(packageName)
            SplitTunnelMode.BYPASS -> !config.excludedApps.contains(packageName)
        }
    }

    suspend fun enableCategory(category: AppCategory) {
        val bundle = AppBundle.getDefaults()[category] ?: return
        
        val config = getConfig()
        val currentMode = config.mode
        
        val updatedConfig = when (currentMode) {
            SplitTunnelMode.DISABLED -> config.copy(
                mode = SplitTunnelMode.INCLUDE,
                includedApps = bundle
            )
            SplitTunnelMode.INCLUDE -> config.copy(
                includedApps = config.includedApps + bundle
            )
            SplitTunnelMode.EXCLUDE -> config.copy(
                mode = SplitTunnelMode.INCLUDE,
                excludedApps = config.excludedApps - bundle,
                includedApps = bundle
            )
            SplitTunnelMode.BYPASS -> config.copy(
                excludedApps = config.excludedApps - bundle,
                includedApps = config.includedApps + bundle
            )
        }

        saveConfig(updatedConfig)
    }

    suspend fun disableCategory(category: AppCategory) {
        val bundle = AppBundle.getDefaults()[category] ?: return
        val config = getConfig()

        val updatedConfig = when (config.mode) {
            SplitTunnelMode.INCLUDE -> config.copy(
                includedApps = config.includedApps - bundle
            )
            SplitTunnelMode.EXCLUDE -> config.copy(
                excludedApps = config.excludedApps - bundle
            )
            else -> config
        }

        saveConfig(updatedConfig)
    }

    suspend fun setMode(mode: SplitTunnelMode) {
        val config = getConfig()
        saveConfig(config.copy(mode = mode))
    }

    suspend fun enableSplitTunnel(mode: SplitTunnelMode = SplitTunnelMode.INCLUDE) {
        currentConfig = currentConfig?.copy(mode = mode) ?: SplitTunnelConfig(mode = mode)
        isEnabled = true
    }

    suspend fun disableSplitTunnel() {
        currentConfig = currentConfig?.copy(mode = SplitTunnelMode.DISABLED)
            ?: SplitTunnelConfig(mode = SplitTunnelMode.DISABLED)
        isEnabled = false
    }

    fun isSplitTunnelEnabled(): Boolean = isEnabled

    private suspend fun saveConfig(config: SplitTunnelConfig) {
        // Save to settings repository
        when (config.mode) {
            SplitTunnelMode.INCLUDE -> {
                settingsRepository.updateAppRoutingConfig(
                    com.peasyproxy.app.domain.model.AppRoutingConfig(
                        mode = com.peasyproxy.app.domain.model.AppRoutingConfig.Mode.INCLUDE,
                        includedApps = config.includedApps,
                        excludedApps = emptySet()
                    )
                )
            }
            SplitTunnelMode.DISABLED -> {
                settingsRepository.updateAppRoutingConfig(
                    com.peasyproxy.app.domain.model.AppRoutingConfig(
                        mode = com.peasyproxy.app.domain.model.AppRoutingConfig.Mode.DISABLED,
                        includedApps = emptySet(),
                        excludedApps = emptySet()
                    )
                )
            }
            SplitTunnelMode.EXCLUDE, SplitTunnelMode.BYPASS -> {
                settingsRepository.updateAppRoutingConfig(
                    com.peasyproxy.app.domain.model.AppRoutingConfig(
                        mode = com.peasyproxy.app.domain.model.AppRoutingConfig.Mode.EXCLUDE,
                        includedApps = emptySet(),
                        excludedApps = config.excludedApps
                    )
                )
            }
        }
        currentConfig = config
    }

    fun getAllAppCategories(): List<AppCategory> = AppCategory.entries

    fun getEnabledCategories(): List<AppCategory> {
        val config = currentConfig ?: return emptyList()
        val enabledCategories = mutableListOf<AppCategory>()
        
        for (category in AppCategory.entries) {
            val bundlePackages = AppBundle.getDefaults()[category] ?: continue
            val hasAnyEnabled = bundlePackages.any { config.includedApps.contains(it) || config.excludedApps.contains(it) }
            if (hasAnyEnabled) {
                enabledCategories.add(category)
            }
        }
        
        return enabledCategories
    }
}