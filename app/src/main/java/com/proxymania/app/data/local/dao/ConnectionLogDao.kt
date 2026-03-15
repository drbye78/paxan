package com.proxymania.app.data.local.dao

import androidx.room.*
import com.proxymania.app.data.local.entity.ConnectionLogEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ConnectionLogDao {
    @Query("SELECT * FROM connection_logs ORDER BY connectedAt DESC")
    fun getAllLogs(): Flow<List<ConnectionLogEntity>>

    @Query("SELECT * FROM connection_logs ORDER BY connectedAt DESC LIMIT :limit")
    fun getRecentLogs(limit: Int): Flow<List<ConnectionLogEntity>>

    @Query("SELECT * FROM connection_logs WHERE proxyId = :proxyId ORDER BY connectedAt DESC")
    fun getLogsForProxy(proxyId: String): Flow<List<ConnectionLogEntity>>

    @Query("SELECT * FROM connection_logs WHERE connectedAt >= :startTime ORDER BY connectedAt DESC")
    fun getLogsSince(startTime: Long): Flow<List<ConnectionLogEntity>>

    @Insert
    suspend fun insertLog(log: ConnectionLogEntity): Long

    @Update
    suspend fun updateLog(log: ConnectionLogEntity)

    @Query("UPDATE connection_logs SET disconnectedAt = :disconnectedAt, bytesReceived = :bytesReceived, bytesSent = :bytesSent, wasSuccessful = :wasSuccessful, errorMessage = :errorMessage WHERE id = :id")
    suspend fun updateLogCompletion(id: Long, disconnectedAt: Long, bytesReceived: Long, bytesSent: Long, wasSuccessful: Boolean, errorMessage: String?)

    @Query("DELETE FROM connection_logs WHERE connectedAt < :timestamp")
    suspend fun deleteOldLogs(timestamp: Long)

    @Query("SELECT COUNT(*) FROM connection_logs")
    suspend fun getLogCount(): Int
}