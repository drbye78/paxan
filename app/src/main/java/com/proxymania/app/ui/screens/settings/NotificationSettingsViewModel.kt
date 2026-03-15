package com.proxymania.app.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.proxymania.app.data.repository.SettingsRepository
import com.proxymania.app.domain.model.NotificationPreferences
import com.proxymania.app.domain.model.VibrationPattern
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NotificationSettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    val notificationPreferences: StateFlow<NotificationPreferences> = 
        settingsRepository.notificationPreferencesFlow
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5000),
                initialValue = NotificationPreferences()
            )

    fun updateConnectionNotifications(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateConnectionNotifications(enabled)
        }
    }

    fun updateErrorAlerts(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateErrorAlerts(enabled)
        }
    }

    fun updateSoundEnabled(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateSoundEnabled(enabled)
        }
    }

    fun updateVibrationEnabled(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateVibrationEnabled(enabled)
        }
    }

    fun updateSoundUri(uri: String?) {
        viewModelScope.launch {
            settingsRepository.updateSoundUri(uri)
        }
    }

    fun updateVibrationPattern(pattern: VibrationPattern) {
        viewModelScope.launch {
            settingsRepository.updateVibrationPattern(pattern.pattern)
        }
    }

    fun resetToDefaults() {
        viewModelScope.launch {
            settingsRepository.updateNotificationPreferences(NotificationPreferences())
        }
    }

    val availableVibrationPatterns = VibrationPattern.entries.toList()
}
