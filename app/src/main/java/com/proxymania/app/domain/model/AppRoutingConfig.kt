package com.proxymania.app.domain.model

data class AppRoutingConfig(
    val mode: Mode = Mode.DISABLED,
    val includedApps: Set<String> = emptySet(),
    val excludedApps: Set<String> = emptySet(),
    val isIncludeMode: Boolean = true,
    val allowBypass: Boolean = false
) {
    enum class Mode {
        DISABLED,
        INCLUDE,
        EXCLUDE
    }
}

data class DnsConfig(
    val customDnsEnabled: Boolean = false,
    val primaryDns: String = "8.8.8.8",
    val secondaryDns: String = "8.8.4.4"
)