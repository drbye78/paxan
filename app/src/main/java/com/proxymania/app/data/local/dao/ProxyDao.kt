package com.proxymania.app.data.local.dao

import androidx.room.*
import com.proxymania.app.data.local.entity.ProxyEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ProxyDao {
    @Query("SELECT * FROM proxies ORDER BY trustScore DESC")
    fun getAllProxies(): Flow<List<ProxyEntity>>

    @Query("SELECT * FROM proxies WHERE isFavorite = 1 ORDER BY trustScore DESC")
    fun getFavoriteProxies(): Flow<List<ProxyEntity>>

    @Query("SELECT * FROM proxies WHERE trustScore >= 70 ORDER BY latency ASC LIMIT 10")
    fun getTrustedProxies(): Flow<List<ProxyEntity>>

    @Query("SELECT * FROM proxies WHERE lastUsed IS NOT NULL ORDER BY lastUsed DESC LIMIT 10")
    fun getRecentlyUsedProxies(): Flow<List<ProxyEntity>>

    @Query("SELECT * FROM proxies WHERE id = :id")
    suspend fun getProxyById(id: String): ProxyEntity?

    @Query("SELECT * FROM proxies WHERE host LIKE '%' || :query || '%' OR country LIKE '%' || :query || '%'")
    fun searchProxies(query: String): Flow<List<ProxyEntity>>

    @Query("SELECT * FROM proxies ORDER BY latency ASC LIMIT :limit")
    suspend fun getFastestProxies(limit: Int): List<ProxyEntity>

    @Query("SELECT * FROM proxies ORDER BY trustScore DESC LIMIT :limit")
    suspend fun getBestProxies(limit: Int): List<ProxyEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProxies(proxies: List<ProxyEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProxy(proxy: ProxyEntity)

    @Update
    suspend fun updateProxy(proxy: ProxyEntity)

    @Query("UPDATE proxies SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun updateFavoriteStatus(id: String, isFavorite: Boolean)

    @Query("UPDATE proxies SET latency = :latency, reliability = :reliability, lastChecked = :lastChecked WHERE id = :id")
    suspend fun updateProxyHealth(id: String, latency: Long, reliability: Float, lastChecked: Long)

    @Query("UPDATE proxies SET useCount = useCount + 1, lastUsed = :timestamp WHERE id = :id")
    suspend fun incrementUsage(id: String, timestamp: Long)

    @Delete
    suspend fun deleteProxy(proxy: ProxyEntity)

    @Query("DELETE FROM proxies")
    suspend fun deleteAllProxies()

    @Query("SELECT COUNT(*) FROM proxies")
    suspend fun getProxyCount(): Int
}