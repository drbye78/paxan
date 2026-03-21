package com.peasyproxy.app.domain.model

/**
 * Sealed class representing all possible VPN states.
 * 
 * States:
 * - Idle: VPN is not connected and not attempting to connect
 * - Connecting: VPN is attempting to connect to a proxy
 * - Connected: VPN is actively connected and routing traffic
 * - Disconnecting: VPN is in the process of disconnecting
 * - Error: VPN encountered an error
 */
sealed class VpnState {
    object Idle : VpnState()
    data class Connecting(val proxy: Proxy) : VpnState()
    data class Connected(
        val proxy: Proxy,
        val connectedSince: Long,
        val bytesReceived: Long = 0L,
        val bytesSent: Long = 0L
    ) : VpnState()
    object Disconnecting : VpnState()
    data class Error(val message: String?) : VpnState()
    
    val isConnected: Boolean
        get() = this is Connected
    
    val isConnecting: Boolean
        get() = this is Connecting
    
    val currentProxy: Proxy?
        get() = when (this) {
            is Connected -> proxy
            is Connecting -> proxy
            else -> null
        }
    
    val errorMessage: String?
        get() = (this as? Error)?.message
}

data class ConnectionConfig(
    val proxy: Proxy,
    val dnsPrimary: String = "8.8.8.8",
    val dnsSecondary: String = "8.8.4.4",
    val routeAllTraffic: Boolean = true,
    val excludedApps: List<String> = emptyList(),
    val includedApps: List<String> = emptyList()
)

sealed class ConnectionResult {
    data class Success(val config: ConnectionConfig) : ConnectionResult()
    data class Failure(val error: String, val exception: Throwable? = null) : ConnectionResult()
}

enum class TunnelState {
    IDLE,
    CONNECTING,
    CONNECTED,
    DISCONNECTING,
    ERROR
}

data class PacketInfo(
    val size: Int,
    val isOutgoing: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)