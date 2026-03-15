package com.proxymania.app.service

import com.proxymania.app.domain.model.Proxy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class Socks4Handler @Inject constructor() {

    private var socket: Socket? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    suspend fun connect(proxy: Proxy, targetHost: String, targetPort: Int): Boolean = withContext(Dispatchers.IO) {
        try {
            disconnect()

            socket = Socket().apply {
                connect(InetSocketAddress(proxy.host, proxy.port), 30000)
                soTimeout = 30000
            }

            if (!performConnection(targetHost, targetPort, proxy)) {
                return@withContext false
            }

            _isConnected.value = true
            true
        } catch (e: Exception) {
            _isConnected.value = false
            disconnect()
            throw e
        }
    }

    private suspend fun performConnection(targetHost: String, targetPort: Int, proxy: Proxy): Boolean = withContext(Dispatchers.IO) {
        val socket = this@Socks4Handler.socket ?: return@withContext false

        val request = buildConnectRequest(targetHost, targetPort, proxy)
        socket.outputStream.write(request)

        val response = ByteArray(8)
        socket.inputStream.read(response)

        if (response[0] != 0x00.toByte()) {
            throw IOException("SOCKS4 protocol error")
        }

        if (response[1].toInt() != 0x5A) { // 0x5A = request granted
            val error = getSocks4Error(response[1].toInt())
            throw IOException("SOCKS4 connection failed: $error")
        }

        true
    }

    private fun buildConnectRequest(host: String, port: Int, proxy: Proxy): ByteArray {
        val request = mutableListOf<Byte>()

        request.add(0x04) // SOCKS version
        request.add(0x01) // Connect command

        request.add((port shr 8).toByte())
        request.add((port and 0xFF).toByte())

        // For SOCKS4a, use 0.0.0.1 and append domain
        val isDomain = !host.matches(Regex("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"))
        
        if (isDomain) {
            // IPv4 placeholder - will be ignored for SOCKS4a
            request.addAll(listOf(0x00, 0x00, 0x00, 0x01))
        } else {
            val ipParts = host.split(".")
            ipParts.forEach { request.add(it.toInt().toByte()) }
        }

        val userId = proxy.username ?: ""
        request.addAll(userId.toByteArray().toList())
        request.add(0x00) // Null terminator

        // SOCKS4a: append destination domain
        if (isDomain) {
            request.addAll(host.toByteArray().toList())
            request.add(0x00)
        }

        return request.toByteArray()
    }

    private fun getSocks4Error(error: Int): String {
        return when (error) {
            0x5B -> "Request rejected or failed"
            0x5C -> "Client not identifiable"
            0x5D -> "Failed - client not authorized"
            else -> "Unknown error ($error)"
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
            val buffer = ByteArray(4096)
            val bytesRead = socket?.inputStream?.read(buffer) ?: -1
            if (bytesRead > 0) {
                buffer.copyOf(bytesRead)
            } else {
                null
            }
        } catch (e: Exception) {
            _isConnected.value = false
            null
        }
    }

    suspend fun disconnect() = withContext(Dispatchers.IO) {
        try {
            socket?.close()
        } catch (e: Exception) {
            // Ignore
        }
        socket = null
        _isConnected.value = false
    }

    /**
     * Clears internal buffers.
     * Called by kill switch for immediate traffic blocking.
     */
    fun clearBuffer() {
        // Socks4Handler doesn't maintain internal buffers
        // This is a no-op but required for interface consistency
    }
}