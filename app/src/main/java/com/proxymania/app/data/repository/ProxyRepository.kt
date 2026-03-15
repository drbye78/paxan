package com.proxymania.app.data.repository

import com.proxymania.app.data.local.dao.ProxyDao
import com.proxymania.app.data.local.entity.ProxyEntity
import com.proxymania.app.data.remote.ProxyFetcher
import com.proxymania.app.data.remote.ProxyTester
import com.proxymania.app.domain.model.Proxy
import com.proxymania.app.domain.model.ProxyProtocol
import com.proxymania.app.domain.model.ProxyTestResult
import com.proxymania.app.security.EncryptedCredentials
import com.proxymania.app.security.SecurityManager
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProxyRepository @Inject constructor(
    private val proxyDao: ProxyDao,
    private val proxyFetcher: ProxyFetcher,
    private val proxyTester: ProxyTester,
    private val securityManager: SecurityManager
) {
    fun getAllProxies(): Flow<List<Proxy>> {
        return proxyDao.getAllProxies().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun getFavoriteProxies(): Flow<List<Proxy>> {
        return proxyDao.getFavoriteProxies().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun getTrustedProxies(): Flow<List<Proxy>> {
        return proxyDao.getTrustedProxies().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun getRecentlyUsedProxies(): Flow<List<Proxy>> {
        return proxyDao.getRecentlyUsedProxies().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    fun searchProxies(query: String): Flow<List<Proxy>> {
        return proxyDao.searchProxies(query).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    suspend fun getProxyById(id: String): Proxy? {
        return proxyDao.getProxyById(id)?.toDomain()
    }

    suspend fun fetchAndSaveProxies(forceRefresh: Boolean = false): Result<List<Proxy>> {
        return try {
            val fetchResult = proxyFetcher.fetchAllProxies(forceRefresh)
            
            if (fetchResult.isSuccess) {
                val proxies = fetchResult.getOrNull() ?: emptyList()
                val entities = proxies.map { it.toEntity() }
                proxyDao.insertProxies(entities)
                Result.success(proxies)
            } else {
                Result.failure(fetchResult.exceptionOrNull() ?: Exception("Unknown error"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun testProxy(proxy: Proxy): ProxyTestResult {
        return proxyTester.testMultipleEndpoints(proxy)
    }

    suspend fun testAndSaveProxy(proxy: Proxy): ProxyTestResult {
        val result = proxyTester.testMultipleEndpoints(proxy)
        
        if (result.isReachable) {
            proxyDao.updateProxyHealth(
                id = proxy.id,
                latency = result.latency,
                reliability = if (result.isReachable) 100f else 0f,
                lastChecked = System.currentTimeMillis()
            )
        }
        
        return result
    }

    suspend fun testTopProxies(count: Int = 20): List<ProxyTestResult> {
        val bestProxies = proxyDao.getBestProxies(count)
        return proxyTester.testProxiesParallel(bestProxies.map { it.toDomain() })
    }

    suspend fun getFastestProxies(limit: Int): List<Proxy> {
        return proxyDao.getFastestProxies(limit).map { it.toDomain() }
    }

    suspend fun getBestProxies(limit: Int): List<Proxy> {
        return proxyDao.getBestProxies(limit).map { it.toDomain() }
    }

    suspend fun toggleFavorite(proxyId: String, isFavorite: Boolean) {
        proxyDao.updateFavoriteStatus(proxyId, isFavorite)
    }

    suspend fun updateProxyUsage(proxyId: String) {
        proxyDao.incrementUsage(proxyId, System.currentTimeMillis())
    }

    suspend fun updateProxyHealth(proxy: Proxy) {
        proxyDao.updateProxyHealth(
            id = proxy.id,
            latency = proxy.latency,
            reliability = proxy.reliability,
            lastChecked = proxy.lastChecked
        )
    }

    suspend fun addCustomProxy(proxy: Proxy) {
        // Encrypt credentials before storing
        val encryptedCreds = securityManager.encryptProxyCredentials(
            proxy.username,
            proxy.password
        )
        
        val entity = proxy.toEntity().copy(
            username = encryptedCreds.username,
            password = encryptedCreds.password
        )
        
        proxyDao.insertProxy(entity)
        Timber.d("Added custom proxy with encrypted credentials")
    }

    suspend fun deleteProxy(proxy: Proxy) {
        proxyDao.deleteProxy(proxy.toEntity())
    }

    suspend fun clearAllProxies() {
        proxyDao.deleteAllProxies()
    }

    suspend fun getProxyCount(): Int {
        return proxyDao.getProxyCount()
    }

    fun exportProxies(): Flow<List<Proxy>> {
        return proxyDao.getAllProxies().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    suspend fun importProxies(proxies: List<Proxy>) {
        // Encrypt credentials for imported proxies
        val entities = proxies.map { proxy ->
            val encryptedCreds = securityManager.encryptProxyCredentials(
                proxy.username,
                proxy.password
            )
            proxy.toEntity().copy(
                username = encryptedCreds.username,
                password = encryptedCreds.password
            )
        }
        proxyDao.insertProxies(entities)
        Timber.d("Imported ${proxies.size} proxies with encrypted credentials")
    }

    /**
     * Converts database entity to domain model, decrypting credentials.
     */
    private fun ProxyEntity.toDomain(): Proxy {
        // Decrypt credentials when reading from database
        val decryptedCreds = try {
            securityManager.decryptProxyCredentials(
                EncryptedCredentials(username, password)
            )
        } catch (e: Exception) {
            Timber.e(e, "Failed to decrypt credentials for proxy $id")
            // Return null credentials on decryption failure
            Pair(null, null)
        }
        
        return Proxy(
            id = id,
            host = host,
            port = port,
            protocol = try {
                ProxyProtocol.valueOf(protocol)
            } catch (e: Exception) {
                ProxyProtocol.HTTP
            },
            username = decryptedCreds.first,
            password = decryptedCreds.second,
            country = country,
            countryCode = countryCode,
            latency = latency,
            reliability = reliability,
            trustScore = trustScore,
            lastChecked = lastChecked,
            isFavorite = isFavorite,
            responseTime = responseTime
        )
    }

    /**
     * Converts domain model to database entity.
     * Note: Credentials should already be encrypted by caller.
     */
    private fun Proxy.toEntity(): ProxyEntity {
        return ProxyEntity(
            id = id,
            host = host,
            port = port,
            protocol = protocol.name,
            username = username,  // Should be encrypted by caller
            password = password,  // Should be encrypted by caller
            country = country,
            countryCode = countryCode,
            latency = latency,
            reliability = reliability,
            trustScore = trustScore,
            lastChecked = lastChecked,
            isFavorite = isFavorite,
            responseTime = responseTime
        )
    }
}