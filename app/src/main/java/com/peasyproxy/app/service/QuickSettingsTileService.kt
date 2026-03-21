package com.peasyproxy.app.service

import android.content.Intent
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import com.peasyproxy.app.R
import com.peasyproxy.app.data.repository.ProxyRepository
import com.peasyproxy.app.data.repository.VpnStateRepository
import com.peasyproxy.app.domain.model.ProxyProtocol
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class QuickSettingsTileService : TileService() {

    @Inject
    lateinit var vpnStateRepository: VpnStateRepository

    @Inject
    lateinit var proxyRepository: ProxyRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onStartListening() {
        super.onStartListening()
        updateTile()
    }

    override fun onClick() {
        super.onClick()

        scope.launch {
            val state = vpnStateRepository.state.first()

            if (state.isConnected) {
                disconnect()
            } else {
                connect()
            }

            updateTile()
        }
    }

    private fun connect() {
        scope.launch {
            try {
                val state = vpnStateRepository.state.first()
                val proxy = state.currentProxy ?: getDefaultProxy()

                if (proxy != null) {
                    val intent = Intent(this@QuickSettingsTileService, VpnService::class.java).apply {
                        action = com.peasyproxy.app.service.VpnService.ACTION_CONNECT
                        putExtra(com.peasyproxy.app.service.VpnService.EXTRA_PROXY_HOST, proxy.host)
                        putExtra(com.peasyproxy.app.service.VpnService.EXTRA_PROXY_PORT, proxy.port)
                        putExtra(com.peasyproxy.app.service.VpnService.EXTRA_PROXY_PROTOCOL, proxy.protocol.name)
                        proxy.username?.let { putExtra(com.peasyproxy.app.service.VpnService.EXTRA_PROXY_USERNAME, it) }
                        proxy.password?.let { putExtra(com.peasyproxy.app.service.VpnService.EXTRA_PROXY_PASSWORD, it) }
                    }

                    startForegroundService(intent)
                }
            } catch (e: Exception) {
                // Handle error
            }
        }
    }

    private fun disconnect() {
        val intent = Intent(this, VpnService::class.java).apply {
            action = com.peasyproxy.app.service.VpnService.ACTION_DISCONNECT
        }
        startService(intent)
    }

    private fun updateTile() {
        scope.launch {
            val state = vpnStateRepository.state.first()
            
            val tile = qsTile ?: return@launch

            if (state.isConnected) {
                tile.state = Tile.STATE_ACTIVE
                tile.label = "PeasyProxy"
                tile.subtitle = state.currentProxy?.displayName ?: "Connected"
            } else {
                tile.state = Tile.STATE_INACTIVE
                tile.label = "PeasyProxy"
                tile.subtitle = "Tap to connect"
            }

            tile.updateTile()
        }
    }

    private suspend fun getDefaultProxy(): com.peasyproxy.app.domain.model.Proxy? {
        return try {
            val proxies = proxyRepository.getFastestProxies(1)
            proxies.firstOrNull()
        } catch (e: Exception) {
            null
        }
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}