package com.peasyproxy.app.domain.model

import androidx.compose.runtime.Immutable

@Immutable
data class AppRoutingConfig(
    val mode: Mode = Mode.DISABLED,
    val includedApps: Set<String> = emptySet(),
    val excludedApps: Set<String> = emptySet(),
    val allowBypass: Boolean = false
) {
    val isIncludeMode: Boolean get() = mode == Mode.INCLUDE

    enum class Mode {
        DISABLED,
        INCLUDE,
        EXCLUDE
    }
}

@Immutable
data class DnsConfig(
    val customDnsEnabled: Boolean = false,
    val primaryDns: String = "8.8.8.8",
    val secondaryDns: String = "8.8.4.4"
)