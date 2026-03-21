package com.peasyproxy.app.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.peasyproxy.app.data.repository.SettingsRepository
import com.peasyproxy.app.domain.model.AppSettings
import com.peasyproxy.app.domain.model.AutoRotateInterval
import com.peasyproxy.app.domain.model.DarkMode
import com.peasyproxy.app.domain.model.RotationStrategy
import com.peasyproxy.app.domain.model.SplitTunnelMode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    val settings: StateFlow<AppSettings> = settingsRepository.settingsFlow
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = AppSettings()
        )

    val splitTunnelMode: StateFlow<SplitTunnelMode> = settingsRepository.splitTunnelModeFlow
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = SplitTunnelMode.DISABLED
        )

    val language: StateFlow<String> = settingsRepository.languageFlow
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = "en"
        )

    fun updateAutoConnectOnStart(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateAutoConnectOnStart(enabled)
        }
    }

    fun updateAutoReconnect(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateAutoReconnect(enabled)
        }
    }

    fun updateFailoverEnabled(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateFailoverEnabled(enabled)
        }
    }

    fun updateKillSwitchEnabled(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateKillSwitchEnabled(enabled)
        }
    }

    fun updateAutoRotateEnabled(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateAutoRotateEnabled(enabled)
        }
    }

    fun updateAutoRotateInterval(interval: AutoRotateInterval) {
        viewModelScope.launch {
            settingsRepository.updateAutoRotateInterval(interval)
        }
    }

    fun updateRotationStrategy(strategy: RotationStrategy) {
        viewModelScope.launch {
            settingsRepository.updateRotationStrategy(strategy)
        }
    }

    fun updateConnectionTimeout(timeout: Int) {
        viewModelScope.launch {
            settingsRepository.updateConnectionTimeout(timeout)
        }
    }

    fun updateNotificationsEnabled(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateNotificationsEnabled(enabled)
        }
    }

    fun updateDarkMode(mode: DarkMode) {
        viewModelScope.launch {
            settingsRepository.updateDarkMode(mode)
        }
    }

    fun updateSplitTunnelMode(mode: SplitTunnelMode) {
        viewModelScope.launch {
            settingsRepository.updateSplitTunnelMode(mode)
        }
    }

    fun updateLanguage(language: String) {
        viewModelScope.launch {
            settingsRepository.updateLanguage(language)
        }
    }
}