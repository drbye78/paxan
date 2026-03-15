package com.proxymania.app.data.remote

import com.google.gson.annotations.SerializedName

data class ProxyScrapeResponse(
    @SerializedName("proxies")
    val proxies: List<ProxyScrapeProxy>?
)

data class ProxyScrapeProxy(
    @SerializedName("ip")
    val ip: String,
    @SerializedName("port")
    val port: Int,
    @SerializedName("protocol")
    val protocol: String,
    @SerializedName("anonymity")
    val anonymity: String?,
    @SerializedName("country")
    val country: String?,
    @SerializedName("country_code")
    val countryCode: String?,
    @SerializedName("uptime")
    val uptime: Float?
)

data class ProxyManiaResponse(
    val html: String?
)

data class ProxyScrapeAccountInfo(
    @SerializedName("status")
    val status: String?,
    @SerializedName("remaining")
    val remaining: String?,
    @SerializedName("limit")
    val limit: String?
)