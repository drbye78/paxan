package com.peasyproxy.app.domain.usecase

import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.ProxyProtocol
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class ReputationCalculatorTest {

    private lateinit var calculator: ReputationCalculator

    @Before
    fun setup() {
        calculator = ReputationCalculator()
    }

    @Test
    fun testCalculateTrustScore_excellentLatency() {
        val proxy = Proxy(
            id = "test1",
            host = "192.168.1.1",
            port = 8080,
            protocol = ProxyProtocol.HTTPS,
            latency = 50,
            reliability = 100f,
            countryCode = "US",
            lastChecked = System.currentTimeMillis()
        )

        val score = calculator.calculateTrustScore(proxy)

        assertTrue("Score should be high for excellent latency", score >= 70)
    }

    @Test
    fun testCalculateTrustScore_poorLatency() {
        val proxy = Proxy(
            id = "test2",
            host = "192.168.1.2",
            port = 8080,
            protocol = ProxyProtocol.HTTP,
            latency = 5000,
            reliability = 50f,
            lastChecked = System.currentTimeMillis()
        )

        val score = calculator.calculateTrustScore(proxy)

        assertTrue("Score should be lower for poor latency", score < 60)
    }

    @Test
    fun testCalculateTrustScore_withCredentials() {
        val proxyWithCredentials = Proxy(
            id = "test3",
            host = "192.168.1.3",
            port = 8080,
            protocol = ProxyProtocol.HTTPS,
            username = "user",
            password = "pass",
            latency = 100,
            reliability = 100f
        )

        val proxyWithoutCredentials = proxyWithCredentials.copy(
            id = "test4",
            username = null,
            password = null
        )

        val scoreWithCredentials = calculator.calculateTrustScore(proxyWithCredentials)
        val scoreWithoutCredentials = calculator.calculateTrustScore(proxyWithoutCredentials)

        assertTrue("Proxy with credentials should have higher score", 
            scoreWithCredentials > scoreWithoutCredentials)
    }

    @Test
    fun testRankProxies() {
        val proxies = listOf(
            Proxy(id = "1", host = "a.com", port = 80, trustScore = 50),
            Proxy(id = "2", host = "b.com", port = 80, trustScore = 90),
            Proxy(id = "3", host = "c.com", port = 80, trustScore = 30)
        )

        val ranked = calculator.rankProxies(proxies)

        assertEquals("b.com", ranked[0].host)
        assertEquals("a.com", ranked[1].host)
        assertEquals("c.com", ranked[2].host)
    }

    @Test
    fun testGetTopProxies() {
        val proxies = (1..10).map { i ->
            Proxy(id = "$i", host = "proxy$i.com", port = 80, latency = i * 100L)
        }

        val top = calculator.getTopProxies(proxies, 3)

        assertEquals(3, top.size)
        assertTrue("Top proxies should have lowest latency", top[0].latency < top[1].latency)
    }

    @Test
    fun testConnectionQuality_excellent() {
        val quality = calculator.getConnectionQuality(50)
        assertEquals(ReputationCalculator.ConnectionQuality.EXCELLENT, quality)
    }

    @Test
    fun testConnectionQuality_good() {
        val quality = calculator.getConnectionQuality(200)
        assertEquals(ReputationCalculator.ConnectionQuality.GOOD, quality)
    }

    @Test
    fun testConnectionQuality_fair() {
        val quality = calculator.getConnectionQuality(500)
        assertEquals(ReputationCalculator.ConnectionQuality.FAIR, quality)
    }

    @Test
    fun testConnectionQuality_poor() {
        val quality = calculator.getConnectionQuality(2000)
        assertEquals(ReputationCalculator.ConnectionQuality.POOR, quality)
    }

    @Test
    fun testTrustScoreBounds() {
        val proxy = Proxy(
            id = "bounds",
            host = "test.com",
            port = 80,
            latency = 0,
            reliability = 0f,
            lastChecked = 0
        )

        val score = calculator.calculateTrustScore(proxy)

        assertTrue("Score should be between 0 and 100", score in 0..100)
    }
}