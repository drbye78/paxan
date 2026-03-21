package com.peasyproxy.app.service

import com.peasyproxy.app.domain.model.Proxy
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
class Socks5Handler @Inject constructor() {
    
    private var socket: Socket? = null
    private var remoteSocket: Socket? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    private var authMethod: AuthMethod = AuthMethod.NO_AUTH

    enum class AuthMethod {
        NO_AUTH,
        USERNAME_PASSWORD,
        NONE,
        UNSUPPORTED
    }

    suspend fun connect(proxy: Proxy, targetHost: String, targetPort: Int): Boolean = withContext(Dispatchers.IO) {
        try {
            disconnect()

            socket = Socket().apply {
                connect(InetSocketAddress(proxy.host, proxy.port), 30000)
                soTimeout = 30000
            }

            if (!performHandshake(proxy)) {
                return@withContext false
            }

            if (!performConnection(targetHost, targetPort)) {
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

    private suspend fun performHandshake(proxy: Proxy): Boolean = withContext(Dispatchers.IO) {
        val socket = this@Socks5Handler.socket ?: return@withContext false

        val methods = mutableListOf<Byte>(0x00)
        if (!proxy.username.isNullOrEmpty() && !proxy.password.isNullOrEmpty()) {
            methods.add(0x02)
            authMethod = AuthMethod.USERNAME_PASSWORD
        } else {
            authMethod = AuthMethod.NO_AUTH
        }

        val greeting = byteArrayOf(0x05, methods.size.toByte()) + methods.toByteArray()
        socket.outputStream.write(greeting)

        val response = ByteArray(2)
        socket.inputStream.read(response)

        if (response[0] != 0x05.toByte()) {
            throw IOException("SOCKS version mismatch")
        }

        val method = response[1].toInt()
        
        when (method) {
            0x00 -> {
                authMethod = AuthMethod.NO_AUTH
            }
            0x02 -> {
                if (!performAuth(proxy)) {
                    throw IOException("SOCKS5 authentication failed")
                }
            }
            0xFF -> {
                throw IOException("No acceptable authentication method")
            }
            else -> {
                throw IOException("Unknown authentication method: $method")
            }
        }

        true
    }

    private suspend fun performAuth(proxy: Proxy): Boolean = withContext(Dispatchers.IO) {
        val socket = this@Socks5Handler.socket ?: return@withContext false

        val username = proxy.username ?: return@withContext false
        val password = proxy.password ?: return@withContext false

        val authPacket = byteArrayOf(0x01) +
            byteArrayOf(username.length.toByte()) + username.toByteArray() +
            byteArrayOf(password.length.toByte()) + password.toByteArray()

        socket.outputStream.write(authPacket)

        val response = ByteArray(2)
        socket.inputStream.read(response)

        response[1].toInt() == 0x00
    }

    private suspend fun performConnection(targetHost: String, targetPort: Int): Boolean = withContext(Dispatchers.IO) {
        val socket = this@Socks5Handler.socket ?: return@withContext false

        val addressType: Byte = when {
            targetHost.matches(Regex("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$")) -> 0x01
            targetHost.contains(":") -> 0x04
            else -> 0x03
        }

        val connectRequest = buildConnectRequest(addressType, targetHost, targetPort)
        socket.outputStream.write(connectRequest)

        val response = ByteArray(10)
        socket.inputStream.read(response)

        if (response[0] != 0x05.toByte()) {
            throw IOException("SOCKS version mismatch in response")
        }

        if (response[1].toInt() != 0x00) {
            val error = getSocksError(response[1].toInt())
            throw IOException("SOCKS5 connection failed: $error")
        }

        true
    }

    private fun buildConnectRequest(addressType: Byte, host: String, port: Int): ByteArray {
        val request = mutableListOf<Byte>()
        
        request.add(0x05) // Version
        request.add(0x01) // Connect command
        request.add(0x00) // Reserved

        request.add(addressType)

        when (addressType.toInt()) {
            0x01 -> { // IPv4
                val ipParts = host.split(".")
                ipParts.forEach { request.add(it.toInt().toByte()) }
            }
            0x03 -> { // Domain
                request.add(host.length.toByte())
                request.addAll(host.toByteArray().toList())
            }
            0x04 -> { // IPv6 - simplified
                request.addAll(ByteArray(16).toList())
            }
        }

        request.add((port shr 8).toByte())
        request.add((port and 0xFF).toByte())

        return request.toByteArray()
    }

    private fun getSocksError(error: Int): String {
        return when (error) {
            0x01 -> "General SOCKS server failure"
            0x02 -> "Connection not allowed by ruleset"
            0x03 -> "Network unreachable"
            0x04 -> "Host unreachable"
            0x05 -> "Connection refused"
            0x06 -> "TTL expired"
            0x07 -> "Command not supported"
            0x08 -> "Address type not supported"
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
            remoteSocket?.close()
        } catch (e: Exception) {
            // Ignore
        }
        socket = null
        remoteSocket = null
        _isConnected.value = false
    }

    /**
     * Clears internal buffers.
     * Called by kill switch for immediate traffic blocking.
     */
    fun clearBuffer() {
        // Socks5Handler doesn't maintain internal buffers
        // This is a no-op but required for interface consistency
    }
}