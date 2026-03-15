package com.proxymania.app.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.proxymania.app.data.repository.SettingsRepository
import com.proxymania.app.domain.model.AppSettings
import com.proxymania.app.domain.model.RotationStrategy
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AdvancedSettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    val settings: StateFlow<AppSettings> = settingsRepository.settingsFlow
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = AppSettings()
        )

    fun updateConnectionTimeout(timeout: Int) {
        viewModelScope.launch {
            settingsRepository.updateConnectionTimeout(timeout)
        }
    }

    fun updateHealthCheckInterval(interval: Int) {
        viewModelScope.launch {
            settingsRepository.updateHealthCheckInterval(interval)
        }
    }

    fun updateRotationStrategy(strategy: RotationStrategy) {
        viewModelScope.launch {
            settingsRepository.updateRotationStrategy(strategy)
        }
    }
}