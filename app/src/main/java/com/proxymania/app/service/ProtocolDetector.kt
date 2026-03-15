package com.proxymania.app.service

import com.proxymania.app.domain.model.Proxy
import com.proxymania.app.domain.model.ProxyProtocol
import com.proxymania.app.domain.model.ProxyTestResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProtocolDetector @Inject constructor(
    private val okHttpClient: OkHttpClient
) {
    
    data class ProtocolCapabilities(
        val supportsHttp: Boolean = false,
        val supportsHttps: Boolean = false,
        val supportsSocks4: Boolean = false,
        val supportsSocks5: Boolean = false,
        val latency: Long = 0,
        val bestProtocol: ProxyProtocol = ProxyProtocol.HTTP
    )

    suspend fun detectCapabilities(proxy: Proxy, timeoutMs: Int = 5000): ProtocolCapabilities = withContext(Dispatchers.IO) {
        val results = mutableListOf<ProtocolTestResult>()

        // Test HTTP
        results.add(testProtocol(proxy, ProxyProtocol.HTTP, timeoutMs))
        
        // Test HTTPS
        results.add(testProtocol(proxy, ProxyProtocol.HTTPS, timeoutMs))
        
        // Test SOCKS5
        results.add(testProtocol(proxy, ProxyProtocol.SOCKS5, timeoutMs))
        
        // Test SOCKS4
        results.add(testProtocol(proxy, ProxyProtocol.SOCKS4, timeoutMs))

        val successfulTests = results.filter { it.success }
        
        if (successfulTests.isEmpty()) {
            return@withContext ProtocolCapabilities()
        }

        val bestResult = successfulTests.minByOrNull { it.latency }!!

        ProtocolCapabilities(
            supportsHttp = results.find { it.protocol == ProxyProtocol.HTTP }?.success == true,
            supportsHttps = results.find { it.protocol == ProxyProtocol.HTTPS }?.success == true,
            supportsSocks4 = results.find { it.protocol == ProxyProtocol.SOCKS4 }?.success == true,
            supportsSocks5 = results.find { it.protocol == ProxyProtocol.SOCKS5 }?.success == true,
            latency = bestResult.latency,
            bestProtocol = bestResult.protocol
        )
    }

    private suspend fun testProtocol(
        proxy: Proxy,
        protocol: ProxyProtocol,
        timeoutMs: Int
    ): ProtocolTestResult {
        val startTime = System.currentTimeMillis()
        
        return try {
            when (protocol) {
                ProxyProtocol.HTTP, ProxyProtocol.HTTPS -> testHttpProxy(proxy, protocol, timeoutMs)
                ProxyProtocol.SOCKS5 -> testSocks5Proxy(proxy, timeoutMs)
                ProxyProtocol.SOCKS4 -> testSocks4Proxy(proxy, timeoutMs)
            }
        } catch (e: Exception) {
            ProtocolTestResult(protocol, false, 0, e.message)
        }
    }

    private suspend fun testHttpProxy(
        proxy: Proxy,
        protocol: ProxyProtocol,
        timeoutMs: Int
    ): ProtocolTestResult = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
        
        try {
            val javaProxy = java.net.Proxy(
                java.net.Proxy.Type.HTTP,
                InetSocketAddress(proxy.host, proxy.port)
            )

            val client = okHttpClient.newBuilder()
                .connectTimeout(timeoutMs.toLong(), TimeUnit.MILLISECONDS)
                .readTimeout(timeoutMs.toLong(), TimeUnit.MILLISECONDS)
                .proxy(javaProxy)
                .build()

            val url = if (protocol == ProxyProtocol.HTTPS) "https://www.google.com" else "http://www.google.com"
            val request = Request.Builder()
                .url(url)
                .head()
                .build()

            val response = client.newCall(request).execute()
            val latency = System.currentTimeMillis() - startTime
            
            response.close()
            
            ProtocolTestResult(
                protocol = protocol,
                success = response.isSuccessful || response.code == 405, // 405 = method not allowed but proxy works
                latency = latency,
                error = null
            )
        } catch (e: Exception) {
            ProtocolTestResult(
                protocol = protocol,
                success = false,
                latency = timeoutMs.toLong(),
                error = e.message
            )
        }
    }

    private suspend fun testSocks5Proxy(
        proxy: Proxy,
        timeoutMs: Int
    ): ProtocolTestResult = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
        
        try {
            val socket = Socket()
            socket.connect(InetSocketAddress(proxy.host, proxy.port), timeoutMs)
            socket.soTimeout = timeoutMs

            // SOCKS5 greeting
            val greeting = byteArrayOf(0x05, 0x01, 0x00)
            socket.outputStream.write(greeting)

            val response = ByteArray(2)
            socket.inputStream.read(response)

            socket.close()

            val latency = System.currentTimeMillis() - startTime

            if (response[0] == 0x05.toByte() && response[1] == 0x00.toByte()) {
                ProtocolTestResult(ProxyProtocol.SOCKS5, true, latency, null)
            } else {
                ProtocolTestResult(ProxyProtocol.SOCKS5, false, latency, "SOCKS5 not supported")
            }
        } catch (e: Exception) {
            ProtocolTestResult(
                protocol = ProxyProtocol.SOCKS5,
                success = false,
                latency = timeoutMs.toLong(),
                error = e.message
            )
        }
    }

    private suspend fun testSocks4Proxy(
        proxy: Proxy,
        timeoutMs: Int
    ): ProtocolTestResult = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
        
        try {
            val socket = Socket()
            socket.connect(InetSocketAddress(proxy.host, proxy.port), timeoutMs)
            socket.soTimeout = timeoutMs

            // SOCKS4 greeting - connect to 0.0.0.0:0 (just test connectivity)
            val request = byteArrayOf(
                0x04, // SOCKS version
                0x01, // Connect command
                0x00, 0x00, // port
                0x00, 0x00, 0x00, 0x00, // IP
                0x00 // user id
            )
            socket.outputStream.write(request)

            val response = ByteArray(8)
            socket.inputStream.read(response)

            socket.close()

            val latency = System.currentTimeMillis() - startTime

            if (response[0] == 0x00.toByte() && response[1] == 0x5A.toByte()) {
                ProtocolTestResult(ProxyProtocol.SOCKS4, true, latency, null)
            } else {
                ProtocolTestResult(ProxyProtocol.SOCKS4, false, latency, "SOCKS4 not supported")
            }
        } catch (e: Exception) {
            ProtocolTestResult(
                protocol = ProxyProtocol.SOCKS4,
                success = false,
                latency = timeoutMs.toLong(),
                error = e.message
            )
        }
    }

    fun getBestProtocol(capabilities: ProtocolCapabilities): ProxyProtocol {
        return capabilities.bestProtocol
    }

    fun getFallbackProtocol(currentProtocol: ProxyProtocol, capabilities: ProtocolCapabilities): ProxyProtocol? {
        return when (currentProtocol) {
            ProxyProtocol.HTTPS -> if (capabilities.supportsHttp) ProxyProtocol.HTTP else getNextFallback(ProxyProtocol.HTTP, capabilities)
            ProxyProtocol.HTTP -> getNextFallback(ProxyProtocol.HTTP, capabilities)
            ProxyProtocol.SOCKS5 -> if (capabilities.supportsHttp) ProxyProtocol.HTTP else getNextFallback(ProxyProtocol.HTTP, capabilities)
            ProxyProtocol.SOCKS4 -> if (capabilities.supportsSocks5) ProxyProtocol.SOCKS5 else if (capabilities.supportsHttp) ProxyProtocol.HTTP else null
        }
    }

    private fun getNextFallback(protocol: ProxyProtocol, capabilities: ProtocolCapabilities): ProxyProtocol? {
        return when (protocol) {
            ProxyProtocol.HTTP -> if (capabilities.supportsSocks5) ProxyProtocol.SOCKS5 else if (capabilities.supportsSocks4) ProxyProtocol.SOCKS4 else null
            ProxyProtocol.SOCKS5 -> if (capabilities.supportsSocks4) ProxyProtocol.SOCKS4 else if (capabilities.supportsHttp) ProxyProtocol.HTTP else null
            else -> null
        }
    }

    data class ProtocolTestResult(
        val protocol: ProxyProtocol,
        val success: Boolean,
        val latency: Long,
        val error: String?
    )
}