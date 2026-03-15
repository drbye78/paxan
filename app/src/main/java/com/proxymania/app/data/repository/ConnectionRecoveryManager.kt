package com.proxymania.app.data.repository

import android.content.Context
import com.proxymania.app.data.remote.ProxyFetcher
import com.proxymania.app.data.remote.ProxyTester
import com.proxymania.app.domain.model.Proxy
import com.proxymania.app.domain.model.ProxyTestResult
import com.proxymania.app.service.VpnService
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ConnectionRecoveryManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val vpnStateRepository: VpnStateRepository,
    private val proxyRepository: ProxyRepository,
    private val settingsRepository: SettingsRepository,
    private val proxyFetcher: ProxyFetcher,
    private val proxyTester: ProxyTester
) {
    private var isReconnecting = false
    private var maxRetries = 3
    private var baseDelayMs = 1000L

    suspend fun handleDisconnect(error: String?) {
        val settings = settingsRepository.settingsFlow.first()
        
        if (!settings.autoReconnect || isReconnecting) {
            return
        }

        isReconnecting = true
        
        try {
            vpnStateRepository.setError(error)
            
            for (attempt in 1..maxRetries) {
                val lastState = vpnStateRepository.state.first()
                val lastProxy = lastState.currentProxy
                
                if (lastProxy == null) {
                    break
                }

                val testResult = testProxy(lastProxy)
                
                if (testResult.isReachable) {
                    reconnect(lastProxy)
                    break
                } else {
                    if (attempt < maxRetries) {
                        val delayMs = baseDelayMs * (2 shl (attempt - 1))
                        delay(delayMs)
                    }
                }
            }

            if (!isConnectionRestored()) {
                tryFallbackProxies()
            }
        } finally {
            isReconnecting = false
        }
    }

    private suspend fun testProxy(proxy: Proxy): ProxyTestResult {
        return try {
            proxyTester.testMultipleEndpoints(proxy)
        } catch (e: Exception) {
            ProxyTestResult(proxy, false, 0, e.message)
        }
    }

    private suspend fun reconnect(proxy: Proxy) {
        val intent = android.content.Intent(context, VpnService::class.java).apply {
            action = VpnService.ACTION_CONNECT
            putExtra(VpnService.EXTRA_PROXY_HOST, proxy.host)
            putExtra(VpnService.EXTRA_PROXY_PORT, proxy.port)
            putExtra(VpnService.EXTRA_PROXY_PROTOCOL, proxy.protocol.name)
            proxy.username?.let { putExtra(VpnService.EXTRA_PROXY_USERNAME, it) }
            proxy.password?.let { putExtra(VpnService.EXTRA_PROXY_PASSWORD, it) }
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    private suspend fun isConnectionRestored(): Boolean {
        val state = vpnStateRepository.state.first()
        return state.isConnected
    }

    private suspend fun tryFallbackProxies() {
        val settings = settingsRepository.settingsFlow.first()
        
        if (!settings.failoverEnabled) {
            return
        }

        try {
            val proxies = proxyRepository.getFastestProxies(10)
            
            for (proxy in proxies) {
                val testResult = testProxy(proxy)
                
                if (testResult.isReachable) {
                    reconnect(proxy)
                    return
                }
            }
        } catch (e: Exception) {
            // No fallback proxies available
        }
    }

    fun cancelReconnect() {
        isReconnecting = false
    }

    fun setMaxRetries(max: Int) {
        maxRetries = max
    }

    fun setBaseDelay(delayMs: Long) {
        baseDelayMs = delayMs
    }
}