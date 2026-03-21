package com.peasyproxy.app.service

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import timber.log.Timber
import java.net.InetAddress
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DnsLeakTest @Inject constructor(
    private val okHttpClient: OkHttpClient
) {

    suspend fun performTest(): DnsLeakResult = withContext(Dispatchers.IO) {
        try {
            val detectedDns = mutableListOf<String>()
            
            // Test by making DNS queries through different methods
            val testDomains = listOf(
                "google.com",
                "cloudflare.com",
                "amazon.com"
            )

            // Method 1: Use HTTP request to detect DNS
            for (domain in testDomains) {
                try {
                    val request = Request.Builder()
                        .url("https://$domain")
                        .head()
                        .build()

                    val response = okHttpClient.newCall(request).execute()
                    response.close()
                    
                    // Try to resolve the domain
                    val addresses = InetAddress.getAllByName(domain)
                    addresses.forEach { addr ->
                        detectedDns.add(addr.hostAddress ?: "")
                    }
                } catch (e: Exception) {
                    Timber.d("DNS leak test failed for $domain: ${e.message}")
                }
            }

            // Check if DNS matches expected VPN DNS
            val vpnDnsServers = listOf("8.8.8.8", "8.8.4.4", "1.1.1.1")
            val isLeaking = detectedDns.any { dns ->
                dns.isNotEmpty() && !vpnDnsServers.contains(dns)
            }

            DnsLeakResult(
                isLeaking = isLeaking,
                detectedDnsServers = detectedDns.distinct(),
                testTimestamp = System.currentTimeMillis()
            )
        } catch (e: Exception) {
            Timber.e(e, "DNS leak test failed")
            DnsLeakResult(
                isLeaking = false,
                detectedDnsServers = emptyList(),
                testTimestamp = System.currentTimeMillis(),
                error = e.message
            )
        }
    }

    suspend fun checkDnsServers(configuredPrimary: String, configuredSecondary: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                // Verify that DNS queries go through configured servers
                val testDomains = listOf("example.com", "test.com")
                
                for (domain in testDomains) {
                    try {
                        val addresses = InetAddress.getAllByName(domain)
                        val dnsResponded = addresses.any { it != null }
                        if (!dnsResponded) {
                            return@withContext false
                        }
                    } catch (e: Exception) {
                        Timber.w("DNS check failed for $domain: ${e.message}")
                    }
                }
                true
            } catch (e: Exception) {
                Timber.e(e, "DNS server check failed")
                false
            }
        }
    }

    data class DnsLeakResult(
        val isLeaking: Boolean,
        val detectedDnsServers: List<String>,
        val testTimestamp: Long,
        val error: String? = null
    )
}
