package com.proxymania.app.ui.screens.approuting

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.proxymania.app.data.repository.SettingsRepository
import com.proxymania.app.domain.model.AppRoutingConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AppInfo(
    val packageName: String,
    val appName: String,
    val isSystemApp: Boolean,
    val isSelected: Boolean
)

@HiltViewModel
class AppRoutingViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    private val _routingConfig = MutableStateFlow(AppRoutingConfig())
    val routingConfig: StateFlow<AppRoutingConfig> = _routingConfig.asStateFlow()

    private val _installedApps = MutableStateFlow<List<AppInfo>>(emptyList())
    val installedApps: StateFlow<List<AppInfo>> = _installedApps.asStateFlow()

    private val _mode = MutableStateFlow(com.proxymania.app.domain.model.SplitTunnelMode.INCLUDE) 
    val mode: StateFlow<com.proxymania.app.domain.model.SplitTunnelMode> = _mode.asStateFlow()

    private val _allowBypass = MutableStateFlow(false)
    val allowBypass: StateFlow<Boolean> = _allowBypass.asStateFlow()

    init {
        viewModelScope.launch {
            settingsRepository.appRoutingFlow.collect { config ->
                _routingConfig.value = config
                _mode.value = when {
                    !config.isIncludeMode && config.allowBypass -> com.proxymania.app.domain.model.SplitTunnelMode.BYPASS
                    !config.isIncludeMode -> com.proxymania.app.domain.model.SplitTunnelMode.EXCLUDE
                    else -> com.proxymania.app.domain.model.SplitTunnelMode.INCLUDE
                }
                _allowBypass.value = config.allowBypass
            }
        }
    }

    fun loadInstalledApps(apps: List<ApplicationInfo>) {
        val config = _routingConfig.value
        val currentMode = _mode.value
        val appList = apps.map { appInfo ->
            AppInfo(
                packageName = appInfo.packageName,
                appName = appInfo.packageName.substringAfterLast("."),
                isSystemApp = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0,
                isSelected = when (currentMode) {
                    com.proxymania.app.domain.model.SplitTunnelMode.INCLUDE,
                    com.proxymania.app.domain.model.SplitTunnelMode.BYPASS -> config.includedApps.contains(appInfo.packageName)
                    com.proxymania.app.domain.model.SplitTunnelMode.EXCLUDE,
                    com.proxymania.app.domain.model.SplitTunnelMode.DISABLED -> config.excludedApps.contains(appInfo.packageName)
                }
            )
        }.sortedWith(
            compareBy({ !it.isSelected }, { it.isSystemApp }, { it.appName })
        )
        
        _installedApps.value = appList
    }

    fun setMode(newMode: com.proxymania.app.domain.model.SplitTunnelMode) {
        _mode.value = newMode
        viewModelScope.launch {
            when (newMode) {
                com.proxymania.app.domain.model.SplitTunnelMode.INCLUDE -> {
                    settingsRepository.updateIncludeMode(true)
                    settingsRepository.updateAllowBypass(false)
                }
                com.proxymania.app.domain.model.SplitTunnelMode.EXCLUDE -> {
                    settingsRepository.updateIncludeMode(false)
                    settingsRepository.updateAllowBypass(false)
                }
                com.proxymania.app.domain.model.SplitTunnelMode.BYPASS -> {
                    settingsRepository.updateIncludeMode(false)
                    settingsRepository.updateAllowBypass(true)
                }
                com.proxymania.app.domain.model.SplitTunnelMode.DISABLED -> {
                    settingsRepository.updateIncludeMode(true)
                    settingsRepository.updateAllowBypass(false)
                }
            }
        }
    }

    fun toggleMode(isIncludeMode: Boolean) {
        setMode(if (isIncludeMode) com.proxymania.app.domain.model.SplitTunnelMode.INCLUDE else com.proxymania.app.domain.model.SplitTunnelMode.EXCLUDE)
    }

    fun toggleApp(packageName: String) {
        viewModelScope.launch {
            when (_mode.value) {
                com.proxymania.app.domain.model.SplitTunnelMode.INCLUDE,
                com.proxymania.app.domain.model.SplitTunnelMode.BYPASS -> {
                    if (_routingConfig.value.includedApps.contains(packageName)) {
                        settingsRepository.removeIncludedApp(packageName)
                    } else {
                        settingsRepository.addIncludedApp(packageName)
                    }
                }
                com.proxymania.app.domain.model.SplitTunnelMode.EXCLUDE -> {
                    if (_routingConfig.value.excludedApps.contains(packageName)) {
                        settingsRepository.removeExcludedApp(packageName)
                    } else {
                        settingsRepository.addExcludedApp(packageName)
                    }
                }
                com.proxymania.app.domain.model.SplitTunnelMode.DISABLED -> {}
            }
        }
    }

    fun clearSelection() {
        viewModelScope.launch {
            when (_mode.value) {
                com.proxymania.app.domain.model.SplitTunnelMode.INCLUDE,
                com.proxymania.app.domain.model.SplitTunnelMode.BYPASS -> {
                    settingsRepository.updateAppRoutingConfig(
                        _routingConfig.value.copy(includedApps = emptySet())
                    )
                }
                com.proxymania.app.domain.model.SplitTunnelMode.EXCLUDE -> {
                    settingsRepository.updateAppRoutingConfig(
                        _routingConfig.value.copy(excludedApps = emptySet())
                    )
                }
                com.proxymania.app.domain.model.SplitTunnelMode.DISABLED -> {}
            }
        }
    }
}