package com.peasyproxy.app.domain.model

data class SplitTunnelConfig(
    val mode: SplitTunnelMode = SplitTunnelMode.DISABLED,
    val includedApps: Set<String> = emptySet(),
    val excludedApps: Set<String> = emptySet(),
    val appBundles: Map<AppCategory, Set<String>> = emptyMap()
)

enum class SplitTunnelMode {
    DISABLED,
    INCLUDE,      // Only selected apps use VPN
    EXCLUDE,      // Selected apps bypass VPN
    BYPASS        // All traffic through VPN except selected
}

enum class AppCategory(val displayName: String) {
    STREAMING("Streaming"),
    SOCIAL("Social Media"),
    GAMING("Gaming"),
    MESSAGING("Messaging"),
    BANKING("Banking"),
    SHOPPING("Shopping"),
    NEWS("News"),
    WORK("Work"),
    CUSTOM("Custom")
}

data class ProxyLocation(
    val proxyId: String,
    val host: String,
    val country: String,
    val countryCode: String,
    val latitude: Double?,
    val longitude: Double?,
    val latency: Long,
    val isActive: Boolean = false
)

data class AppBundle(
    val name: String,
    val packages: Set<String>
) {
    companion object {
        val STREAMING = AppBundle(
            "Streaming",
            setOf(
                "com.netflix.mediaclient",
                "com.google.android.youtube",
                "com.spotify.music",
                "com.amazon.music",
                "com.disney.disneyplus",
                "com.hbo.hbonow",
                "tv.twitch"
            )
        )

        val SOCIAL = AppBundle(
            "Social Media",
            setOf(
                "com.facebook.katana",
                "com.instagram.android",
                "com.twitter.android",
                "com.snapchat.android",
                "com.zhiliaoapp.musically",
                "org.telegram.messenger"
            )
        )

        val MESSAGING = AppBundle(
            "Messaging",
            setOf(
                "org.telegram.messenger",
                "com.whatsapp",
                "com.facebook.orca",
                "com.viber.voip",
                "jp.naver.line.android"
            )
        )

        val BANKING = AppBundle(
            "Banking",
            setOf(
                "com.chase.sig.android",
                "com.bankofamerica.bac",
                "com.wells Fargo.mobile",
                "com.citi.mobile",
                "com.usbank.mobile"
            )
        )

        fun getDefaults(): Map<AppCategory, Set<String>> {
            return mapOf(
                AppCategory.STREAMING to STREAMING.packages,
                AppCategory.SOCIAL to SOCIAL.packages,
                AppCategory.MESSAGING to MESSAGING.packages,
                AppCategory.BANKING to BANKING.packages
            )
        }
    }
}