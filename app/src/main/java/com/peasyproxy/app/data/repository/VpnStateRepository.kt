package com.peasyproxy.app.data.repository

import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.VpnState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VpnStateRepository @Inject constructor() {

    private val _state = MutableStateFlow<VpnState>(VpnState.Idle)
    val state: StateFlow<VpnState> = _state.asStateFlow()

    private var connectionStartTime: Long = 0
    private var totalConnections: Int = 0
    private var totalBytesReceived: Long = 0
    private var totalBytesSent: Long = 0

    fun getState(): VpnState = _state.value

    fun setConnected(proxy: Proxy) {
        Timber.d("VPN connected to ${proxy.host}:${proxy.port}")
        
        connectionStartTime = System.currentTimeMillis()
        totalConnections++
        
        _state.value = VpnState.Connected(
            proxy = proxy,
            connectedSince = connectionStartTime,
            bytesReceived = 0L,
            bytesSent = 0L
        )
    }

    fun setDisconnected() {
        Timber.d("VPN disconnected")
        
        val previousState = _state.value
        if (previousState is VpnState.Connected) {
            totalBytesReceived += previousState.bytesReceived
            totalBytesSent += previousState.bytesSent
        }
        
        _state.value = VpnState.Idle
    }

    fun setConnecting(proxy: Proxy) {
        Timber.d("VPN connecting to ${proxy.host}:${proxy.port}")
        _state.value = VpnState.Connecting(proxy)
    }

    fun setError(errorMessage: String?) {
        Timber.e("VPN error: $errorMessage")
        
        val previousState = _state.value
        if (previousState is VpnState.Connected) {
            totalBytesReceived += previousState.bytesReceived
            totalBytesSent += previousState.bytesSent
        }
        
        _state.value = VpnState.Error(errorMessage)
    }

    fun updateStats(bytesReceived: Long, bytesSent: Long) {
        val currentState = _state.value
        if (currentState is VpnState.Connected) {
            _state.value = currentState.copy(
                bytesReceived = bytesReceived,
                bytesSent = bytesSent
            )
        }
    }

    fun getConnectionStats(): ConnectionStats {
        val currentState = _state.value
        val currentSessionDuration = if (currentState is VpnState.Connected) {
            System.currentTimeMillis() - currentState.connectedSince
        } else {
            0L
        }

        return ConnectionStats(
            totalConnections = totalConnections,
            totalBytesReceived = totalBytesReceived,
            totalBytesSent = totalBytesSent,
            currentSessionDuration = currentSessionDuration,
            isConnected = currentState.isConnected
        )
    }

    fun resetStats() {
        totalConnections = 0
        totalBytesReceived = 0L
        totalBytesSent = 0L
        Timber.d("VPN statistics reset")
    }

    fun isConnected(): Boolean = _state.value is VpnState.Connected

    fun getCurrentProxy(): Proxy? {
        return (_state.value as? VpnState.Connected)?.proxy
    }

    fun getConnectionDurationSeconds(): Long {
        val currentState = _state.value
        return if (currentState is VpnState.Connected) {
            (System.currentTimeMillis() - currentState.connectedSince) / 1000
        } else {
            0L
        }
    }
}

data class ConnectionStats(
    val totalConnections: Int,
    val totalBytesReceived: Long,
    val totalBytesSent: Long,
    val currentSessionDuration: Long,
    val isConnected: Boolean
)
