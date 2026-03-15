package com.proxymania.app.ui.screens.home

import android.content.Context
import android.content.Intent
import android.net.VpnService as AndroidVpnService
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.proxymania.app.data.repository.ProxyRepository
import com.proxymania.app.data.repository.SettingsRepository
import com.proxymania.app.data.repository.StatisticsRepository
import com.proxymania.app.data.repository.VpnStateRepository
import com.proxymania.app.domain.model.AppSettings
import com.proxymania.app.domain.model.ConnectionInfo
import com.proxymania.app.domain.model.ConnectionState
import com.proxymania.app.domain.model.Proxy
import com.proxymania.app.domain.model.VpnState
import com.proxymania.app.domain.usecase.ReputationCalculator
import com.proxymania.app.service.VpnService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val proxyRepository: ProxyRepository,
    private val settingsRepository: SettingsRepository,
    private val statisticsRepository: StatisticsRepository,
    private val vpnStateRepository: VpnStateRepository,
    private val reputationCalculator: ReputationCalculator,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _connectionInfo = MutableStateFlow(ConnectionInfo())
    val connectionInfo: StateFlow<ConnectionInfo> = _connectionInfo.asStateFlow()

    private val _settings = MutableStateFlow(AppSettings())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    private val _selectedProxy = MutableStateFlow<Proxy?>(null)
    val selectedProxy: StateFlow<Proxy?> = _selectedProxy.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        viewModelScope.launch {
            settingsRepository.settingsFlow.collect { settings ->
                _settings.value = settings
            }
        }
        
        viewModelScope.launch {
            proxyRepository.getRecentlyUsedProxies().collect { recent ->
                val bestFromRecent = reputationCalculator.getTopProxies(recent, 1).firstOrNull()
                if (_selectedProxy.value == null && bestFromRecent != null) {
                    _selectedProxy.value = bestFromRecent
                }
            }
        }

        viewModelScope.launch {
            vpnStateRepository.state.collect { state ->
                when (state) {
                    is VpnState.Connected -> {
                        _connectionInfo.value = _connectionInfo.value.copy(
                            state = ConnectionState.CONNECTED,
                            currentProxy = state.proxy,
                            connectedSince = state.connectedSince,
                            bytesReceived = state.bytesReceived,
                            bytesSent = state.bytesSent
                        )
                    }
                    is VpnState.Connecting -> {
                        _connectionInfo.value = _connectionInfo.value.copy(
                            state = ConnectionState.CONNECTING,
                            currentProxy = state.proxy
                        )
                    }
                    is VpnState.Idle -> {
                        _connectionInfo.value = ConnectionInfo(state = ConnectionState.DISCONNECTED)
                    }
                    is VpnState.Error -> {
                        _connectionInfo.value = _connectionInfo.value.copy(
                            state = ConnectionState.ERROR,
                            errorMessage = state.message
                        )
                    }
                    else -> {}
                }
            }
        }
    }

    fun prepareVpn(): Intent? {
        return AndroidVpnService.prepare(context)
    }

    fun connect() {
        val proxy = _selectedProxy.value
        if (proxy == null) {
            _errorMessage.value = "No proxy selected"
            return
        }

        viewModelScope.launch {
            _connectionInfo.value = _connectionInfo.value.copy(state = ConnectionState.CONNECTING)
            
            try {
                proxyRepository.updateProxyUsage(proxy.id)
                statisticsRepository.recordConnection(proxy.id, proxy.host)
                
                val intent = Intent(context, VpnService::class.java).apply {
                    action = VpnService.ACTION_CONNECT
                    putExtra(VpnService.EXTRA_PROXY_HOST, proxy.host)
                    putExtra(VpnService.EXTRA_PROXY_PORT, proxy.port)
                    putExtra(VpnService.EXTRA_PROXY_PROTOCOL, proxy.protocol.name)
                    proxy.username?.let { putExtra(VpnService.EXTRA_PROXY_USERNAME, it) }
                    proxy.password?.let { putExtra(VpnService.EXTRA_PROXY_PASSWORD, it) }
                }
                
                context.startForegroundService(intent)
                
                _connectionInfo.value = _connectionInfo.value.copy(
                    state = ConnectionState.CONNECTED,
                    currentProxy = proxy,
                    connectedSince = System.currentTimeMillis()
                )
                
                settingsRepository.updateLastSelectedProxyId(proxy.id)
                
            } catch (e: Exception) {
                _connectionInfo.value = _connectionInfo.value.copy(
                    state = ConnectionState.ERROR,
                    errorMessage = e.message
                )
                _errorMessage.value = e.message
            }
        }
    }

    fun disconnect() {
        viewModelScope.launch {
            _connectionInfo.value = _connectionInfo.value.copy(state = ConnectionState.DISCONNECTING)
            
            try {
                val intent = Intent(context, VpnService::class.java).apply {
                    action = VpnService.ACTION_DISCONNECT
                }
                context.startService(intent)
                
                _connectionInfo.value = ConnectionInfo(state = ConnectionState.DISCONNECTED)
            } catch (e: Exception) {
                _errorMessage.value = e.message
            }
        }
    }

    fun quickConnect() {
        viewModelScope.launch {
            _isLoading.value = true
            
            try {
                val proxies = proxyRepository.getFastestProxies(4)
                val bestProxy = reputationCalculator.getTopProxies(proxies, 1).firstOrNull()
                
                if (bestProxy != null) {
                    _selectedProxy.value = bestProxy
                    connect()
                } else {
                    _errorMessage.value = "No proxies available"
                }
            } catch (e: Exception) {
                _errorMessage.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun selectProxy(proxy: Proxy) {
        _selectedProxy.value = proxy
    }

    fun clearError() {
        _errorMessage.value = null
    }

    fun refreshProxies() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                proxyRepository.fetchAndSaveProxies(forceRefresh = true)
            } catch (e: Exception) {
                _errorMessage.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }
}