package com.peasyproxy.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.peasyproxy.app.domain.model.ProxyProtocol

@Entity(tableName = "proxies")
data class ProxyEntity(
    @PrimaryKey
    val id: String,
    val host: String,
    val port: Int,
    val protocol: String,
    val username: String?,
    val password: String?,
    val country: String?,
    val countryCode: String?,
    val latency: Long,
    val reliability: Float,
    val trustScore: Int,
    val lastChecked: Long,
    val isFavorite: Boolean,
    val responseTime: Long,
    val useCount: Int = 0,
    val lastUsed: Long? = null
)

@Entity(tableName = "connection_logs")
data class ConnectionLogEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val proxyId: String,
    val proxyHost: String,
    val connectedAt: Long,
    val disconnectedAt: Long?,
    val bytesReceived: Long,
    val bytesSent: Long,
    val wasSuccessful: Boolean,
    val errorMessage: String?
)

@Entity(tableName = "statistics")
data class StatisticsEntity(
    @PrimaryKey
    val id: Int = 1,
    val totalConnections: Int = 0,
    val totalDataReceived: Long = 0,
    val totalDataSent: Long = 0,
    val totalBytesTransferred: Long = 0,
    val averageLatency: Long = 0,
    val successCount: Int = 0,
    val failureCount: Int = 0,
    val lastUpdated: Long = 0
)