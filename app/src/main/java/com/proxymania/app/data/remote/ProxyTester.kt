package com.proxymania.app.data.remote

import com.proxymania.app.domain.model.Proxy
import com.proxymania.app.domain.model.ProxyTestResult
import com.proxymania.app.domain.model.ProxyProtocol
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withContext
import okhttp3.Authenticator
import okhttp3.Credentials
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Proxy as JavaProxy
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProxyTester @Inject constructor(
    private val okHttpClient: OkHttpClient
) {
    private val testEndpoints = listOf(
        "https://www.google.com",
        "https://httpbin.org/ip",
        "https://connectivitycheck.gstatic.com/generate_204"
    )

    private val testTimeout = 5000L

    suspend fun testProxy(proxy: Proxy, endpoint: String? = null): ProxyTestResult = withContext(Dispatchers.IO) {
        val testUrl = endpoint ?: testEndpoints.first()
        
        try {
            val startTime = System.currentTimeMillis()
            
            val result = testWithHttpConnect(proxy, testUrl)
            val latency = System.currentTimeMillis() - startTime

            ProxyTestResult(
                proxy = proxy.copy(
                    latency = latency,
                    lastChecked = System.currentTimeMillis()
                ),
                isReachable = result.isSuccess,
                latency = latency,
                errorMessage = result.exceptionOrNull()?.message
            )
        } catch (e: Exception) {
            ProxyTestResult(
                proxy = proxy,
                isReachable = false,
                latency = testTimeout.toLong(),
                errorMessage = e.message
            )
        }
    }

    private fun testWithHttpConnect(proxy: Proxy, url: String): Result<String> {
        return try {
            val javaProxy = when (proxy.protocol) {
                ProxyProtocol.SOCKS4, ProxyProtocol.SOCKS5 -> {
                    JavaProxy(JavaProxy.Type.SOCKS, InetSocketAddress(proxy.host, proxy.port))
                }
                else -> {
                    JavaProxy(JavaProxy.Type.HTTP, InetSocketAddress(proxy.host, proxy.port))
                }
            }

            val clientBuilder = okHttpClient.newBuilder()
                .connectTimeout(testTimeout, TimeUnit.MILLISECONDS)
                .readTimeout(testTimeout, TimeUnit.MILLISECONDS)
                .writeTimeout(testTimeout, TimeUnit.MILLISECONDS)
                .proxy(javaProxy)

            if (!proxy.username.isNullOrEmpty() && !proxy.password.isNullOrEmpty()) {
                clientBuilder.proxyAuthenticator { _, response ->
                    response.request.newBuilder()
                        .header("Proxy-Authorization", Credentials.basic(proxy.username, proxy.password))
                        .build()
                }
            }

            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "Mozilla/5.0")
                .build()

            val response = clientBuilder.build().newCall(request).execute()
            
            if (response.isSuccessful || response.code == 204) {
                Result.success(response.body?.string() ?: "")
            } else {
                Result.failure(IOException("HTTP ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun testProxiesParallel(
        proxies: List<Proxy>,
        maxConcurrent: Int = 10
    ): List<ProxyTestResult> = withContext(Dispatchers.IO) {
        proxies.chunked(maxConcurrent).flatMap { chunk ->
            chunk.map { proxy ->
                async {
                    testProxy(proxy)
                }
            }.awaitAll()
        }
    }

    suspend fun testMultipleEndpoints(proxy: Proxy): ProxyTestResult = withContext(Dispatchers.IO) {
        for (endpoint in testEndpoints) {
            val result = testProxy(proxy, endpoint)
            if (result.isReachable) {
                return@withContext result
            }
        }
        
        ProxyTestResult(
            proxy = proxy,
            isReachable = false,
            latency = testTimeout,
            errorMessage = "Failed all test endpoints"
        )
    }
}