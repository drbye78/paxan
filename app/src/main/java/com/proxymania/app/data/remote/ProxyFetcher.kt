package com.proxymania.app.data.remote

import com.proxymania.app.domain.model.Proxy
import com.proxymania.app.domain.model.ProxyProtocol
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProxyFetcher @Inject constructor(
    private val okHttpClient: OkHttpClient
) {
    private var lastFetchTime: Long = 0
    private var cachedProxies: List<Proxy> = emptyList()
    private val cacheValidityMs = 5 * 60 * 1000L // 5 minutes

    suspend fun fetchAllProxies(forceRefresh: Boolean = false): Result<List<Proxy>> = withContext(Dispatchers.IO) {
        if (!forceRefresh && System.currentTimeMillis() - lastFetchTime < cacheValidityMs && cachedProxies.isNotEmpty()) {
            return@withContext Result.success(cachedProxies)
        }

        try {
            val peasyProxyProxies = fetchPeasyProxy()
            val proxyScrapeProxies = fetchProxyScrape()

            val allProxies = (peasyProxyProxies + proxyScrapeProxies).distinctBy { "${it.host}:${it.port}" }
            
            lastFetchTime = System.currentTimeMillis()
            cachedProxies = allProxies

            Result.success(allProxies)
        } catch (e: Exception) {
            if (cachedProxies.isNotEmpty()) {
                Result.success(cachedProxies)
            } else {
                Result.failure(e)
            }
        }
    }

    private suspend fun fetchPeasyProxy(): List<Proxy> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("https://proxymania.su/proxylist/")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .build()

            val response = okHttpClient.newCall(request).execute()
            val html = response.body?.string() ?: return@withContext emptyList()

            parsePeasyProxyHtml(html)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun parsePeasyProxyHtml(html: String): List<Proxy> {
        val proxies = mutableListOf<Proxy>()
        
        try {
            val document = Jsoup.parse(html)
            val table = document.select("table").firstOrNull() ?: return proxies
            val rows = table.select("tbody tr")

            for (row in rows) {
                val cells = row.select("td")
                if (cells.size >= 4) {
                    val host = cells[0].text().trim()
                    val port = cells[1].text().trim().toIntOrNull() ?: continue
                    val country = cells[2].text().trim()
                    val protocolText = cells[3].text().trim().uppercase()

                    val protocol = when {
                        protocolText.contains("HTTPS") -> ProxyProtocol.HTTPS
                        protocolText.contains("SOCKS5") -> ProxyProtocol.SOCKS5
                        protocolText.contains("SOCKS4") -> ProxyProtocol.SOCKS4
                        else -> ProxyProtocol.HTTP
                    }

                    val proxy = Proxy(
                        id = "${host}:${port}:$protocol",
                        host = host,
                        port = port,
                        protocol = protocol,
                        country = country,
                        countryCode = getCountryCode(country),
                        lastChecked = System.currentTimeMillis()
                    )
                    proxies.add(proxy)
                }
            }
        } catch (e: Exception) {
            // Handle parsing errors silently
        }

        return proxies
    }

    suspend fun fetchProxyScrape(
        username: String? = null,
        password: String? = null,
        proxyType: String = "http",
        timeout: Int = 5000
    ): List<Proxy> = withContext(Dispatchers.IO) {
        try {
            val urlBuilder = StringBuilder("https://api.proxyscrape.com/v2/account/get?")
            username?.let { urlBuilder.append("user=$it&") }
            password?.let { urlBuilder.append("pass=$it&") }
            urlBuilder.append("list=$proxyType&timeout=$timeout")

            val request = Request.Builder()
                .url(urlBuilder.toString())
                .build()

            val response = okHttpClient.newCall(request).execute()
            val text = response.body?.string() ?: return@withContext emptyList()

            parseProxyScrapeResponse(text)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun parseProxyScrapeResponse(text: String): List<Proxy> {
        val proxies = mutableListOf<Proxy>()
        
        try {
            val lines = text.lines().filter { it.isNotBlank() && !it.startsWith("#") }
            
            for (line in lines) {
                val parts = line.split(":")
                if (parts.size >= 2) {
                    val host = parts[0].trim()
                    val port = parts[1].trim().toIntOrNull() ?: continue

                    val protocol = if (parts.size >= 3) {
                        when (parts[2].trim().lowercase()) {
                            "socks5" -> ProxyProtocol.SOCKS5
                            "socks4" -> ProxyProtocol.SOCKS4
                            "https" -> ProxyProtocol.HTTPS
                            else -> ProxyProtocol.HTTP
                        }
                    } else ProxyProtocol.HTTP

                    val proxy = Proxy(
                        id = "${host}:${port}:$protocol",
                        host = host,
                        port = port,
                        protocol = protocol,
                        lastChecked = System.currentTimeMillis()
                    )
                    proxies.add(proxy)
                }
            }
        } catch (e: Exception) {
            // Handle parsing errors silently
        }

        return proxies
    }

    private fun getCountryCode(country: String): String? {
        return countryCodeMap[country.uppercase()]
    }

    companion object {
        private val countryCodeMap = mapOf(
            "UNITED STATES" to "US",
            "UNITED KINGDOM" to "GB",
            "GERMANY" to "DE",
            "FRANCE" to "FR",
            "CANADA" to "CA",
            "JAPAN" to "JP",
            "AUSTRALIA" to "AU",
            "BRAZIL" to "BR",
            "INDIA" to "IN",
            "RUSSIA" to "RU",
            "CHINA" to "CN",
            "NETHERLANDS" to "NL",
            "SWEDEN" to "SE",
            "NORWAY" to "NO",
            "FINLAND" to "FI",
            "SPAIN" to "ES",
            "ITALY" to "IT",
            "POLAND" to "PL",
            "UKRAINE" to "UA",
            "SOUTH KOREA" to "KR"
        )
    }
}