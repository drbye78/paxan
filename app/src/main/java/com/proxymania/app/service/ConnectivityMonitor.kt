package com.proxymania.app.service

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.shareIn
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Monitors network connectivity and provides reactive flow of connection state.
 * 
 * Features:
 * - Real-time connectivity monitoring
 * - Flow-based reactive API
 * - Distinguishes between different network types
 * - Handles network validation state
 */
@Singleton
class ConnectivityMonitor @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val scope = CoroutineScope(SupervisorJob())
    
    private val _networkStateFlow = callbackFlow {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                super.onAvailable(network)
                Log.d(TAG, "Network available: $network")
                trySend(true)
            }

            override fun onLost(network: Network) {
                super.onLost(network)
                Log.w(TAG, "Network lost: $network")
                trySend(false)
            }

            override fun onCapabilitiesChanged(
                network: Network,
                networkCapabilities: NetworkCapabilities
            ) {
                super.onCapabilitiesChanged(network, networkCapabilities)
                val hasInternet = networkCapabilities.hasCapability(
                    NetworkCapabilities.NET_CAPABILITY_INTERNET
                )
                val isVerified = networkCapabilities.hasCapability(
                    NetworkCapabilities.NET_CAPABILITY_VALIDATED
                )
                
                Log.d(TAG, "Network capabilities changed: hasInternet=$hasInternet, isVerified=$isVerified")
                trySend(hasInternet)
            }

            override fun onUnavailable() {
                super.onUnavailable()
                Log.w(TAG, "Network unavailable")
                trySend(false)
            }
        }

        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
            .addTransportType(NetworkCapabilities.TRANSPORT_ETHERNET)
            .build()

        connectivityManager.registerNetworkCallback(networkRequest, callback)
        
        // Send initial state
        trySend(isConnected())

        awaitClose {
            connectivityManager.unregisterNetworkCallback(callback)
        }
    }
        .distinctUntilChanged()
        .shareIn(scope, started = SharingStarted.Eagerly, replay = 1)

    val networkStateFlow: Flow<Boolean> = _networkStateFlow

    /**
     * Checks if the device currently has an active internet connection.
     */
    fun isConnected(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
               capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    /**
     * Checks if the connection is metered (e.g., cellular data).
     */
    fun isMetered(): Boolean {
        return connectivityManager.isActiveNetworkMetered
    }

    /**
     * Gets the current network type.
     */
    fun getNetworkType(): NetworkType {
        val network = connectivityManager.activeNetwork ?: return NetworkType.NONE
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return NetworkType.NONE

        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> NetworkType.WIFI
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> NetworkType.CELLULAR
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> NetworkType.ETHERNET
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) -> NetworkType.BLUETOOTH
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> NetworkType.VPN
            else -> NetworkType.UNKNOWN
        }
    }

    /**
     * Checks if the network has sufficient bandwidth for the specified requirement.
     * 
     * @param minDownstreamKbps Minimum downstream bandwidth in kbps
     * @param minUpstreamKbps Minimum upstream bandwidth in kbps
     */
    fun hasSufficientBandwidth(minDownstreamKbps: Int = 500, minUpstreamKbps: Int = 100): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false

        val downlink = capabilities.linkDownstreamBandwidthKbps
        val uplink = capabilities.linkUpstreamBandwidthKbps

        return downlink >= minDownstreamKbps && uplink >= minUpstreamKbps
    }

    /**
     * Observes network state changes.
     * 
     * @param callback Function called with new connection state
     */
    @Deprecated("Use networkStateFlow instead", ReplaceWith("networkStateFlow.collect { callback(it) }"))
    fun observe(callback: (Boolean) -> Unit) {
        scope.launch {
            networkStateFlow.collect(callback)
        }
    }

    companion object {
        private const val TAG = "ConnectivityMonitor"
    }
}

/**
 * Enum representing different network types.
 */
enum class NetworkType {
    NONE,
    WIFI,
    CELLULAR,
    ETHERNET,
    BLUETOOTH,
    VPN,
    UNKNOWN
}
