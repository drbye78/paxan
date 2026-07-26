package com.peasyproxy.app.domain.model

import androidx.compose.runtime.Immutable

enum class ProxyProtocol {
    HTTP,
    HTTPS,
    SOCKS4,
    SOCKS5
}

@Immutable
data class Proxy(
    val id: String,
    val host: String,
    val port: Int,
    val protocol: ProxyProtocol = ProxyProtocol.HTTP,
    val username: String? = null,
    val password: String? = null,
    val country: String? = null,
    val countryCode: String? = null,
    val latency: Long = 0,
    val reliability: Float = 0f,
    val trustScore: Int = 0,
    val lastChecked: Long = 0,
    val isFavorite: Boolean = false,
    val responseTime: Long = 0,
    val useCount: Int = 0,
    val lastUsed: Long? = null
) {
    init {
        require(port in 1..65535) { "Port must be 1-65535, was $port" }
        require(latency >= 0) { "Latency must be non-negative" }
        require(reliability in 0f..100f) { "Reliability must be 0-100" }
        require(trustScore in 0..100) { "Trust score must be 0-100" }
    }

    val displayName: String
        get() = "$host:$port"

    val trustLevel: TrustLevel
        get() = when {
            trustScore >= 70 -> TrustLevel.TRUSTED
            trustScore >= 40 -> TrustLevel.UNVERIFIED
            else -> TrustLevel.RISKY
        }
}

enum class TrustLevel {
    TRUSTED,
    UNVERIFIED,
    RISKY
}

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    UNSTABLE,
    DISCONNECTING,
    ERROR
}

@Immutable
data class ConnectionInfo(
    val state: ConnectionState = ConnectionState.DISCONNECTED,
    val currentProxy: Proxy? = null,
    val connectedSince: Long? = null,
    val bytesReceived: Long = 0,
    val bytesSent: Long = 0,
    val errorMessage: String? = null
)

@Immutable
data class ProxyTestResult(
    val proxy: Proxy,
    val isReachable: Boolean,
    val latency: Long,
    val errorMessage: String? = null
)

@Immutable
data class HealthStatus(
    val isHealthy: Boolean,
    val latency: Long,
    val lastChecked: Long,
    val failureCount: Int = 0
)

@Immutable
data class Statistics(
    val totalConnections: Int = 0,
    val totalDataReceived: Long = 0,
    val totalDataSent: Long = 0,
    val averageLatency: Long = 0,
    val successRate: Float = 0f
)