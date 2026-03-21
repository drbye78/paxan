package com.peasyproxy.app.data.repository

import com.peasyproxy.app.data.local.dao.ConnectionLogDao
import com.peasyproxy.app.data.local.dao.StatisticsDao
import com.peasyproxy.app.data.local.entity.ConnectionLogEntity
import com.peasyproxy.app.data.local.entity.StatisticsEntity
import com.peasyproxy.app.domain.model.Statistics
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StatisticsRepository @Inject constructor(
    private val statisticsDao: StatisticsDao,
    private val connectionLogDao: ConnectionLogDao
) {
    fun getStatistics(): Flow<Statistics> {
        return statisticsDao.getStatistics().map { entity ->
            entity?.toDomain() ?: Statistics()
        }
    }

    suspend fun initializeStatistics() {
        val existing = statisticsDao.getStatisticsSync()
        if (existing == null) {
            statisticsDao.insertOrUpdate(StatisticsEntity())
        }
    }

    suspend fun recordConnection(proxyId: String, proxyHost: String): Long {
        val timestamp = System.currentTimeMillis()
        
        statisticsDao.incrementConnectionCount(timestamp)
        
        return connectionLogDao.insertLog(
            ConnectionLogEntity(
                proxyId = proxyId,
                proxyHost = proxyHost,
                connectedAt = timestamp,
                disconnectedAt = null,
                bytesReceived = 0,
                bytesSent = 0,
                wasSuccessful = false,
                errorMessage = null
            )
        )
    }

    suspend fun recordDisconnection(
        logId: Long,
        bytesReceived: Long,
        bytesSent: Long,
        wasSuccessful: Boolean,
        errorMessage: String?
    ) {
        val timestamp = System.currentTimeMillis()
        
        connectionLogDao.updateLogCompletion(
            id = logId,
            disconnectedAt = timestamp,
            bytesReceived = bytesReceived,
            bytesSent = bytesSent,
            wasSuccessful = wasSuccessful,
            errorMessage = errorMessage
        )

        if (wasSuccessful) {
            statisticsDao.incrementSuccessCount(timestamp)
        } else {
            statisticsDao.incrementFailureCount(timestamp)
        }

        statisticsDao.addDataReceived(bytesReceived, timestamp)
        statisticsDao.addDataSent(bytesSent, timestamp)
    }

    suspend fun updateAverageLatency(latency: Long) {
        statisticsDao.updateAverageLatency(latency, System.currentTimeMillis())
    }

    suspend fun clearStatistics() {
        statisticsDao.clearStatistics()
    }

    private fun StatisticsEntity.toDomain(): Statistics {
        val totalAttempts = successCount + failureCount
        val successRate = if (totalAttempts > 0) {
            (successCount.toFloat() / totalAttempts) * 100
        } else 0f

        return Statistics(
            totalConnections = totalConnections,
            totalDataReceived = totalDataReceived,
            totalDataSent = totalDataSent,
            averageLatency = averageLatency,
            successRate = successRate
        )
    }
}