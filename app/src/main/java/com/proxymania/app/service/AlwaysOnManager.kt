package com.proxymania.app.service

import android.content.Context
import android.content.Intent
import android.os.Build
import com.proxymania.app.data.repository.SettingsRepository
import com.proxymania.app.data.repository.VpnStateRepository
import com.proxymania.app.domain.model.AppRoutingConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AlwaysOnManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settingsRepository: SettingsRepository,
    private val vpnStateRepository: VpnStateRepository
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    suspend fun isAlwaysOnEnabled(): Boolean {
        val settings = settingsRepository.settingsFlow.first()
        return settings.autoConnectOnStart
    }

    suspend fun enableAlwaysOn(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return false
        }
        return isAlwaysOnEnabled()
    }

    suspend fun disableAlwaysOn(): Boolean {
        return true
    }

    suspend fun prepareAlwaysOnConnection() {
        val state = vpnStateRepository.state.first()
        
        if (state.isConnected || state.currentProxy != null) {
            return
        }

        val lastProxy = state.currentProxy
        if (lastProxy != null && isAlwaysOnEnabled()) {
            startConnection(lastProxy)
        }
    }

    private fun startConnection(proxy: com.proxymania.app.domain.model.Proxy) {
        val intent = Intent(context, VpnService::class.java).apply {
            action = VpnService.ACTION_CONNECT
            putExtra(VpnService.EXTRA_PROXY_HOST, proxy.host)
            putExtra(VpnService.EXTRA_PROXY_PORT, proxy.port)
            putExtra(VpnService.EXTRA_PROXY_PROTOCOL, proxy.protocol.name)
            proxy.username?.let { putExtra(VpnService.EXTRA_PROXY_USERNAME, it) }
            proxy.password?.let { putExtra(VpnService.EXTRA_PROXY_PASSWORD, it) }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    suspend fun handleAlwaysOnTrigger() {
        val settings = settingsRepository.settingsFlow.first()
        if (!settings.autoConnectOnStart) {
            return
        }

        val state = vpnStateRepository.state.first()
        val proxy = state.currentProxy

        if (proxy != null) {
            startConnection(proxy)
        }
    }
}