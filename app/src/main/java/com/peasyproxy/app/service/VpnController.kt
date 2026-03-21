package com.peasyproxy.app.service

import com.peasyproxy.app.domain.model.ConnectionConfig
import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.ProxyProtocol
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VpnController @Inject constructor(
    private val httpTunnelHandler: HttpTunnelHandler,
    private val socks5Handler: Socks5Handler,
    private val socks4Handler: Socks4Handler,
    private val packetProcessor: PacketProcessor
) {
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val _connectionConfig = MutableStateFlow<ConnectionConfig?>(null)
    val connectionConfig: StateFlow<ConnectionConfig?> = _connectionConfig.asStateFlow()

    private var currentProxy: Proxy? = null

    suspend fun connect(proxy: Proxy, config: ConnectionConfig? = null): Boolean = withContext(Dispatchers.IO) {
        try {
            disconnect()

            currentProxy = proxy

            val connectionConfig = config ?: ConnectionConfig(
                proxy = proxy,
                routeAllTraffic = true
            )
            _connectionConfig.value = connectionConfig

            val success = when (proxy.protocol) {
                ProxyProtocol.HTTP, ProxyProtocol.HTTPS -> {
                    httpTunnelHandler.connect(proxy, "www.google.com", 443)
                }
                ProxyProtocol.SOCKS5 -> {
                    socks5Handler.connect(proxy, "www.google.com", 443)
                }
                ProxyProtocol.SOCKS4 -> {
                    socks4Handler.connect(proxy, "www.google.com", 443)
                }
            }

            if (success) {
                _isConnected.value = true
                packetProcessor.start()
            }

            success
        } catch (e: Exception) {
            _isConnected.value = false
            throw e
        }
    }

    suspend fun sendPacket(data: ByteArray): Boolean {
        if (!_isConnected.value) return false

        packetProcessor.enqueueOutgoingPacket(data)

        val proxy = currentProxy ?: return false

        return try {
            when (proxy.protocol) {
                ProxyProtocol.HTTP, ProxyProtocol.HTTPS -> {
                    httpTunnelHandler.sendPacket(data)
                }
                ProxyProtocol.SOCKS5 -> {
                    socks5Handler.sendPacket(data)
                }
                ProxyProtocol.SOCKS4 -> {
                    socks4Handler.sendPacket(data)
                }
            }
        } catch (e: Exception) {
            _isConnected.value = false
            false
        }
    }

    suspend fun receivePacket(): ByteArray? {
        if (!_isConnected.value) return null

        val proxy = currentProxy ?: return null

        return try {
            val data = when (proxy.protocol) {
                ProxyProtocol.HTTP, ProxyProtocol.HTTPS -> {
                    httpTunnelHandler.receivePacket()
                }
                ProxyProtocol.SOCKS5 -> {
                    socks5Handler.receivePacket()
                }
                ProxyProtocol.SOCKS4 -> {
                    socks4Handler.receivePacket()
                }
            }

            data?.let {
                packetProcessor.enqueueIncomingPacket(it)
            }

            data
        } catch (e: Exception) {
            _isConnected.value = false
            null
        }
    }

    suspend fun disconnect() = withContext(Dispatchers.IO) {
        try {
            httpTunnelHandler.disconnect()
            socks5Handler.disconnect()
            socks4Handler.disconnect()
        } catch (e: Exception) {
            Timber.e(e, "Error during disconnect")
        }

        packetProcessor.stop()
        _isConnected.value = false
        currentProxy = null
        _connectionConfig.value = null
    }

    /**
     * Clears all buffers and closes active connections.
     * Called by kill switch for immediate traffic blocking.
     */
    fun clearBuffers() {
        Timber.d("Clearing VPN controller buffers")
        
        // Clear packet processor buffers
        packetProcessor.clearBuffers()
        
        // Clear handler buffers
        httpTunnelHandler.clearBuffer()
        socks5Handler.clearBuffer()
        socks4Handler.clearBuffer()
        
        // Reset connection state temporarily (will be restored on reconnect)
        _isConnected.value = false
    }

    fun getCurrentProxy(): Proxy? = currentProxy

    fun getPacketProcessor(): PacketProcessor = packetProcessor
}