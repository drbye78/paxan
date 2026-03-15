package com.proxymania.app.data.local.dao

import androidx.room.*
import com.proxymania.app.data.local.entity.StatisticsEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface StatisticsDao {
    @Query("SELECT * FROM statistics WHERE id = 1")
    fun getStatistics(): Flow<StatisticsEntity?>

    @Query("SELECT * FROM statistics WHERE id = 1")
    suspend fun getStatisticsSync(): StatisticsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(statistics: StatisticsEntity)

    @Query("UPDATE statistics SET totalConnections = totalConnections + 1, lastUpdated = :timestamp WHERE id = 1")
    suspend fun incrementConnectionCount(timestamp: Long)

    @Query("UPDATE statistics SET totalDataReceived = totalDataReceived + :bytes, totalBytesTransferred = totalBytesTransferred + :bytes, lastUpdated = :timestamp WHERE id = 1")
    suspend fun addDataReceived(bytes: Long, timestamp: Long)

    @Query("UPDATE statistics SET totalDataSent = totalDataSent + :bytes, totalBytesTransferred = totalBytesTransferred + :bytes, lastUpdated = :timestamp WHERE id = 1")
    suspend fun addDataSent(bytes: Long, timestamp: Long)

    @Query("UPDATE statistics SET successCount = successCount + 1, lastUpdated = :timestamp WHERE id = 1")
    suspend fun incrementSuccessCount(timestamp: Long)

    @Query("UPDATE statistics SET failureCount = failureCount + 1, lastUpdated = :timestamp WHERE id = 1")
    suspend fun incrementFailureCount(timestamp: Long)

    @Query("UPDATE statistics SET averageLatency = :latency, lastUpdated = :timestamp WHERE id = 1")
    suspend fun updateAverageLatency(latency: Long, timestamp: Long)

    @Query("DELETE FROM statistics")
    suspend fun clearStatistics()
}