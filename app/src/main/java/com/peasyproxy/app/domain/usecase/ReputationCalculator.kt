package com.peasyproxy.app.domain.usecase

import com.peasyproxy.app.domain.model.Proxy
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReputationCalculator @Inject constructor() {
    
    companion object {
        private const val SPEED_WEIGHT = 0.40f
        private const val RELIABILITY_WEIGHT = 0.35f
        private const val TRUST_WEIGHT = 0.25f
        private const val FRESHNESS_WEIGHT = 0.10f

        private const val LATENCY_EXCELLENT_MS = 100
        private const val LATENCY_GOOD_MS = 300
        private const val LATENCY_FAIR_MS = 1000

        private const val FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000L // 5 minutes
    }

    fun calculateTrustScore(proxy: Proxy): Int {
        val speedScore = calculateSpeedScore(proxy.latency)
        val reliabilityScore = calculateReliabilityScore(proxy.reliability)
        val trustScore = calculateBaseTrustScore(proxy)
        val freshnessScore = calculateFreshnessScore(proxy.lastChecked)

        val weightedScore = (
            speedScore * SPEED_WEIGHT +
            reliabilityScore * RELIABILITY_WEIGHT +
            trustScore * TRUST_WEIGHT +
            freshnessScore * FRESHNESS_WEIGHT
        )

        return weightedScore.toInt().coerceIn(0, 100)
    }

    private fun calculateSpeedScore(latency: Long): Float {
        return when {
            latency < LATENCY_EXCELLENT_MS -> 100f
            latency < LATENCY_GOOD_MS -> 80f + (20f * (1f - (latency - LATENCY_EXCELLENT_MS).toFloat() / (LATENCY_GOOD_MS - LATENCY_EXCELLENT_MS)))
            latency < LATENCY_FAIR_MS -> 50f + (30f * (1f - (latency - LATENCY_GOOD_MS).toFloat() / (LATENCY_FAIR_MS - LATENCY_GOOD_MS)))
            else -> 50f * (1f - ((latency - LATENCY_FAIR_MS).toFloat() / latency.coerceAtLeast(1)))
        }.coerceIn(0f, 100f)
    }

    private fun calculateReliabilityScore(reliability: Float): Float {
        return reliability.coerceIn(0f, 100f)
    }

    private fun calculateBaseTrustScore(proxy: Proxy): Float {
        var score = 50f

        if (proxy.countryCode != null) {
            score += 10f
        }

        if (!proxy.username.isNullOrEmpty() && !proxy.password.isNullOrEmpty()) {
            score += 15f
        }

        when (proxy.protocol) {
            com.peasyproxy.app.domain.model.ProxyProtocol.HTTPS -> score += 10f
            com.peasyproxy.app.domain.model.ProxyProtocol.SOCKS5 -> score += 5f
            com.peasyproxy.app.domain.model.ProxyProtocol.SOCKS4 -> score += 5f
            else -> {}
        }

        return score.coerceIn(0f, 100f)
    }

    private fun calculateFreshnessScore(lastChecked: Long): Float {
        if (lastChecked == 0L) return 50f

        val age = System.currentTimeMillis() - lastChecked
        
        return when {
            age < FRESHNESS_THRESHOLD_MS -> 100f
            age < FRESHNESS_THRESHOLD_MS * 2 -> 80f
            age < FRESHNESS_THRESHOLD_MS * 4 -> 60f
            age < FRESHNESS_THRESHOLD_MS * 10 -> 40f
            else -> 20f
        }
    }

    fun rankProxies(proxies: List<Proxy>): List<Proxy> {
        return proxies
            .map { it.copy(trustScore = calculateTrustScore(it)) }
            .sortedByDescending { it.trustScore }
    }

    fun getTopProxies(proxies: List<Proxy>, count: Int = 4): List<Proxy> {
        return rankProxies(proxies).take(count)
    }

    fun getConnectionQuality(latency: Long): ConnectionQuality {
        return when {
            latency < LATENCY_EXCELLENT_MS -> ConnectionQuality.EXCELLENT
            latency < LATENCY_GOOD_MS -> ConnectionQuality.GOOD
            latency < LATENCY_FAIR_MS -> ConnectionQuality.FAIR
            else -> ConnectionQuality.POOR
        }
    }

    enum class ConnectionQuality {
        EXCELLENT,
        GOOD,
        FAIR,
        POOR
    }
}