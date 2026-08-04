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

    @Volatile
    private var currentProxy: Proxy? = null

    // Protocol handler interface for strategy dispatch
    private interface ProtocolHandler {
        suspend fun connect(proxy: Proxy, testTarget: String, testPort: Int): Boolean
        suspend fun sendPacket(data: ByteArray): Boolean
        suspend fun receivePacket(): ByteArray?
        suspend fun disconnect()
        fun clearBuffer()
    }

    private val handlers: Map<ProxyProtocol, ProtocolHandler> = mapOf(
        ProxyProtocol.HTTP to object : ProtocolHandler {
            override suspend fun connect(proxy: Proxy, testTarget: String, testPort: Int) =
                httpTunnelHandler.connect(proxy, testTarget, testPort)
            override suspend fun sendPacket(data: ByteArray) = httpTunnelHandler.sendPacket(data)
            override suspend fun receivePacket() = httpTunnelHandler.receivePacket()
            override suspend fun disconnect() { httpTunnelHandler.disconnect() }
            override fun clearBuffer() { httpTunnelHandler.clearBuffer() }
        },
        ProxyProtocol.HTTPS to object : ProtocolHandler {
            override suspend fun connect(proxy: Proxy, testTarget: String, testPort: Int) =
                httpTunnelHandler.connect(proxy, testTarget, testPort)
            override suspend fun sendPacket(data: ByteArray) = httpTunnelHandler.sendPacket(data)
            override suspend fun receivePacket() = httpTunnelHandler.receivePacket()
            override suspend fun disconnect() { httpTunnelHandler.disconnect() }
            override fun clearBuffer() { httpTunnelHandler.clearBuffer() }
        },
        ProxyProtocol.SOCKS5 to object : ProtocolHandler {
            override suspend fun connect(proxy: Proxy, testTarget: String, testPort: Int) =
                socks5Handler.connect(proxy, testTarget, testPort)
            override suspend fun sendPacket(data: ByteArray) = socks5Handler.sendPacket(data)
            override suspend fun receivePacket() = socks5Handler.receivePacket()
            override suspend fun disconnect() { socks5Handler.disconnect() }
            override fun clearBuffer() { socks5Handler.clearBuffer() }
        },
        ProxyProtocol.SOCKS4 to object : ProtocolHandler {
            override suspend fun connect(proxy: Proxy, testTarget: String, testPort: Int) =
                socks4Handler.connect(proxy, testTarget, testPort)
            override suspend fun sendPacket(data: ByteArray) = socks4Handler.sendPacket(data)
            override suspend fun receivePacket() = socks4Handler.receivePacket()
            override suspend fun disconnect() { socks4Handler.disconnect() }
            override fun clearBuffer() { socks4Handler.clearBuffer() }
        }
    )

    private fun handlerFor(proxy: Proxy): ProtocolHandler {
        return handlers[proxy.protocol]
            ?: throw IllegalArgumentException("Unsupported protocol: ${proxy.protocol}")
    }

    suspend fun connect(proxy: Proxy, config: ConnectionConfig? = null, testTarget: String = "httpbin.org", testPort: Int = 443): Boolean = withContext(Dispatchers.IO) {
        try {
            disconnect()

            currentProxy = proxy

            val connectionConfig = config ?: ConnectionConfig(
                proxy = proxy,
                routeAllTraffic = true
            )
            _connectionConfig.value = connectionConfig

            val handler = handlerFor(proxy)
            val success = handler.connect(proxy, testTarget, testPort)

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
            handlerFor(proxy).sendPacket(data)
        } catch (e: Exception) {
            _isConnected.value = false
            false
        }
    }

    suspend fun receivePacket(): ByteArray? {
        if (!_isConnected.value) return null

        val proxy = currentProxy ?: return null

        return try {
            val data = handlerFor(proxy).receivePacket()

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
            handlers.values.forEach { it.disconnect() }
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
        packetProcessor.clearBuffers()
        handlers.values.forEach { it.clearBuffer() }
        _isConnected.value = false
    }

    fun getCurrentProxy(): Proxy? = currentProxy

    fun getPacketProcessor(): PacketProcessor = packetProcessor
}