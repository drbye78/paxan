package com.proxymania.app.service

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import com.proxymania.app.data.repository.SettingsRepository
import com.proxymania.app.domain.model.AppRoutingConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PerAppRoutingManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settingsRepository: SettingsRepository
) {

    suspend fun applyRoutingConfiguration(builder: android.net.VpnService.Builder): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Timber.w("Per-app routing requires Android 10+")
            return false
        }

        return try {
            val config = settingsRepository.appRoutingFlow.first()

            if (config.mode == AppRoutingConfig.Mode.DISABLED) {
                Timber.d("Per-app routing is disabled")
                return true
            }

            Timber.d("Per-app routing config applied, mode: ${config.mode}")
            true
        } catch (e: Exception) {
            Timber.e(e, "Failed to apply per-app routing configuration")
            false
        }
    }

    suspend fun isAppIncluded(packageName: String): Boolean {
        val config = settingsRepository.appRoutingFlow.first()
        return config.includedApps.contains(packageName)
    }

    suspend fun isAppExcluded(packageName: String): Boolean {
        val config = settingsRepository.appRoutingFlow.first()
        return config.excludedApps.contains(packageName)
    }

    suspend fun isAppUsingVpn(packageName: String): Boolean {
        val config = settingsRepository.appRoutingFlow.first()
        
        return when (config.mode) {
            AppRoutingConfig.Mode.INCLUDE -> config.includedApps.contains(packageName)
            AppRoutingConfig.Mode.EXCLUDE -> !config.excludedApps.contains(packageName)
            AppRoutingConfig.Mode.DISABLED -> true
        }
    }

    fun getAllInstalledPackages(includeSystemApps: Boolean = false): List<PackageInfo> {
        val packageManager = context.packageManager
        return packageManager.getInstalledApplications(PackageManager.GET_META_DATA)
            .filter { appInfo ->
                includeSystemApps || (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) == 0
            }
            .map { appInfo ->
                PackageInfo(
                    packageName = appInfo.packageName,
                    appName = packageManager.getApplicationLabel(appInfo).toString(),
                    isSystemApp = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
                )
            }
            .sortedWith(compareBy({ it.isSystemApp }, { it.appName.lowercase() }))
    }

    fun getUserInstalledPackages(): List<PackageInfo> = getAllInstalledPackages(false)

    private fun getVerifiedPackages(packageNames: Set<String>): List<String> {
        val packageManager = context.packageManager
        return packageNames.mapNotNull { packageName ->
            try {
                packageManager.getPackageInfo(packageName, 0)
                packageName
            } catch (e: PackageManager.NameNotFoundException) {
                Timber.w("Package not found: $packageName")
                null
            }
        }
    }

    suspend fun updateIncludedApps(packageNames: List<String>) {
        val currentConfig = settingsRepository.appRoutingFlow.first()
        settingsRepository.updateAppRoutingConfig(
            currentConfig.copy(
                includedApps = packageNames.toSet(),
                mode = AppRoutingConfig.Mode.INCLUDE
            )
        )
        Timber.d("Updated included apps: ${packageNames.size} packages")
    }

    suspend fun updateExcludedApps(packageNames: List<String>) {
        val currentConfig = settingsRepository.appRoutingFlow.first()
        settingsRepository.updateAppRoutingConfig(
            currentConfig.copy(
                excludedApps = packageNames.toSet(),
                mode = AppRoutingConfig.Mode.EXCLUDE
            )
        )
        Timber.d("Updated excluded apps: ${packageNames.size} packages")
    }

    suspend fun clearAppSelections() {
        settingsRepository.updateAppRoutingConfig(
            AppRoutingConfig(
                mode = AppRoutingConfig.Mode.DISABLED,
                includedApps = emptySet(),
                excludedApps = emptySet()
            )
        )
        Timber.d("Cleared app selections")
    }

    data class PackageInfo(
        val packageName: String,
        val appName: String,
        val isSystemApp: Boolean
    )
}
