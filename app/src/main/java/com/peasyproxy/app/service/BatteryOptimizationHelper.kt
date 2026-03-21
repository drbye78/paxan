package com.peasyproxy.app.service

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BatteryOptimizationHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    fun isBatteryOptimizationDisabled(): Boolean {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun requestDisableBatteryOptimization(): Intent? {
        return Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
        }
    }

    fun openBatteryOptimizationSettings(): Intent {
        return Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
    }

    fun isDozeModeSupported(): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
    }

    fun getOptimizationRecommendations(): List<String> {
        val recommendations = mutableListOf<String>()
        
        if (!isBatteryOptimizationDisabled()) {
            recommendations.add("Disable battery optimization for reliable VPN connection")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            recommendations.add("Enable 'Data Saver' exception for this app")
        }

        recommendations.add("Lock app in recent apps to prevent memory killing")
        recommendations.add("Disable battery saver for this app")

        return recommendations
    }

    fun shouldShowBatteryOptimizationPrompt(): Boolean {
        // Show prompt if battery optimization is still enabled
        return !isBatteryOptimizationDisabled()
    }

    companion object {
        fun getAutoStartIntent(context: Context): Intent? {
            val manufacturer = Build.MANUFACTURER.lowercase()

            return when {
                manufacturer.contains("xiaomi") -> {
                    Intent().setClassName(
                        "com.miui.securitycenter",
                        "com.miui.permcenter.autostart.AutoStartManagementActivity"
                    )
                }
                manufacturer.contains("huawei") -> {
                    Intent().setClassName(
                        "com.huawei.systemmanager",
                        "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                    )
                }
                manufacturer.contains("samsung") -> {
                    Intent().setClassName(
                        "com.samsung.android.lool",
                        "com.samsung.android.sm.ui.battery.BatteryActivity"
                    )
                }
                manufacturer.contains("oppo") -> {
                    Intent().setClassName(
                        "com.coloros.safecenter",
                        "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                    )
                }
                manufacturer.contains("vivo") -> {
                    Intent().setClassName(
                        "com.vivo.permissionmanager",
                        "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                    )
                }
                manufacturer.contains("oneplus") -> {
                    Intent().setClassName(
                        "com.oneplus.security",
                        "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"
                    )
                }
                else -> null
            }
        }

        fun openAutoStartSettings(context: Context) {
            getAutoStartIntent(context)?.let { intent ->
                try {
                    context.startActivity(intent)
                } catch (e: Exception) {
                    // Fall back to general settings
                    context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:${context.packageName}")
                    })
                }
            }
        }
    }
}