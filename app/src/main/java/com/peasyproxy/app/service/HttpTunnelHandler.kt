package com.peasyproxy.app.service

import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.ProxyProtocol
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HttpTunnelHandler @Inject constructor(
    private val okHttpClient: OkHttpClient
) {
    private var socket: Socket? = null
    private var localServer: LocalServer? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val incomingData = Channel<ByteArray>(Channel.BUFFERED)
    private val outgoingData = Channel<ByteArray>(Channel.BUFFERED)

    suspend fun connect(proxy: Proxy, targetHost: String = "www.google.com", targetPort: Int = 443): Boolean = withContext(Dispatchers.IO) {
        try {
            disconnect()

            socket = Socket().apply {
                connect(InetSocketAddress(proxy.host, proxy.port), 30000)
                soTimeout = 30000
                keepAlive = true
            }

            val connectRequest = buildConnectRequest(targetHost, targetPort, proxy)
            socket?.outputStream?.write(connectRequest.toByteArray())

            val response = readResponse(socket!!)

            if (response.contains("200") || response.contains("Connection established")) {
                _isConnected.value = true
                localServer = LocalServer(0)
                startForwarding()
                true
            } else {
                disconnect()
                false
            }
        } catch (e: Exception) {
            _isConnected.value = false
            throw e
        }
    }

    private fun buildConnectRequest(host: String, port: Int, proxy: Proxy): String {
        return buildString {
            append("CONNECT $host:$port HTTP/1.1\r\n")
            append("Host: $host:$port\r\n")
            append("User-Agent: PeasyProxy/1.0\r\n")
            append("Proxy-Connection: Keep-Alive\r\n")
            
            if (!proxy.username.isNullOrEmpty() && !proxy.password.isNullOrEmpty()) {
                val credentials = java.util.Base64.getEncoder()
                    .encodeToString("${proxy.username}:${proxy.password}".toByteArray())
                append("Proxy-Authorization: Basic $credentials\r\n")
            }
            
            append("\r\n")
        }
    }

    private fun readResponse(socket: Socket): String {
        val buffer = ByteArray(4096)
        val bytesRead = socket.inputStream.read(buffer)
        return if (bytesRead > 0) {
            String(buffer, 0, bytesRead)
        } else {
            ""
        }
    }

    suspend fun sendPacket(data: ByteArray): Boolean = withContext(Dispatchers.IO) {
        try {
            socket?.outputStream?.write(data)
            true
        } catch (e: Exception) {
            _isConnected.value = false
            false
        }
    }

    suspend fun receivePacket(): ByteArray? = withContext(Dispatchers.IO) {
        try {
            socket?.inputStream?.let { input ->
                val buffer = ByteArray(4096)
                val bytesRead = input.read(buffer)
                if (bytesRead > 0) {
                    buffer.copyOf(bytesRead)
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            _isConnected.value = false
            null
        }
    }

    private fun startForwarding() {
        // Local server would handle forwarding to VPN interface
    }

    suspend fun disconnect() = withContext(Dispatchers.IO) {
        try {
            socket?.close()
        } catch (e: Exception) {
            // Ignore
        }
        socket = null
        localServer?.close()
        localServer = null
        _isConnected.value = false
    }

    /**
     * Clears internal buffers.
     * Called by kill switch for immediate traffic blocking.
     */
    fun clearBuffer() {
        // Clear any pending data in channels
        incomingData.tryReceive()
        outgoingData.tryReceive()
    }

    fun getLocalPort(): Int = localServer?.localPort ?: 0

    private class LocalServer(port: Int) : java.net.ServerSocket(port) {
        init {
            soTimeout = 30000
        }
    }
}