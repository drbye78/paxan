package com.peasyproxy.app.data.repository

import android.content.Context
import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.VpnState
import com.tencent.mmkv.MMKV
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VpnStateRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val mmkv = MMKV.mmkvWithID("peasyproxy_vpn_state", MMKV.MULTI_PROCESS_MODE)

    private val _state = MutableStateFlow<VpnState>(VpnState.Idle)
    val state: StateFlow<VpnState> = _state.asStateFlow()

    @Volatile private var connectionStartTime: Long = 0
    @Volatile private var totalConnections: Int = 0
    @Volatile private var totalBytesReceived: Long = mmkv.decodeLong("total_bytes_rx", 0L)
    @Volatile private var totalBytesSent: Long = mmkv.decodeLong("total_bytes_tx", 0L)

    init {
        MMKV.initialize(context)
    }

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
            persistBytesStats()
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
            persistBytesStats()
        }
        
        _state.value = VpnState.Error(errorMessage)
    }

    fun setUnstable(message: String? = null) {
        if (_state.value is VpnState.Unstable) return
        Timber.w("VPN health check failed: $message")
        _state.value = VpnState.Unstable(message)
    }

    fun recoverFromUnstable(proxy: Proxy, connectedSince: Long) {
        val currentState = _state.value
        if (currentState !is VpnState.Unstable) {
            // Only recover if currently Unstable; otherwise fall through to normal setConnected
            setConnected(proxy)
            return
        }
        Timber.i("VPN health recovered from unstable")
        _state.value = VpnState.Connected(
            proxy = proxy,
            connectedSince = connectedSince,
            bytesReceived = 0L,
            bytesSent = 0L
        )
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
        mmkv.encode("total_bytes_rx", 0L)
        mmkv.encode("total_bytes_tx", 0L)
        Timber.d("VPN statistics reset")
    }

    private fun persistBytesStats() {
        mmkv.encode("total_bytes_rx", totalBytesReceived)
        mmkv.encode("total_bytes_tx", totalBytesSent)
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
