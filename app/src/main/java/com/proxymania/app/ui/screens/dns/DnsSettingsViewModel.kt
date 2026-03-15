package com.proxymania.app.ui.screens.dns

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.proxymania.app.data.repository.SettingsRepository
import com.proxymania.app.domain.model.DnsConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DnsSettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    val dnsConfig: StateFlow<DnsConfig> = settingsRepository.dnsConfigFlow
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = DnsConfig()
        )

    fun updateCustomDnsEnabled(enabled: Boolean) {
        viewModelScope.launch {
            settingsRepository.updateCustomDnsEnabled(enabled)
        }
    }

    fun updatePrimaryDns(dns: String) {
        viewModelScope.launch {
            settingsRepository.updatePrimaryDns(dns)
        }
    }

    fun updateSecondaryDns(dns: String) {
        viewModelScope.launch {
            settingsRepository.updateSecondaryDns(dns)
        }
    }
}