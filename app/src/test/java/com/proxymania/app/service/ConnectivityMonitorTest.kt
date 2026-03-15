package com.proxymania.app.service

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for ConnectivityMonitor.
 * 
 * Tests verify:
 * - Network state detection
 * - Network type identification
 * - Bandwidth checking
 * - Flow-based state updates
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ConnectivityMonitorTest {

    private lateinit var connectivityMonitor: ConnectivityMonitor
    private lateinit var mockContext: Context
    private lateinit var mockConnectivityManager: ConnectivityManager
    private lateinit var mockNetwork: Network
    private lateinit var mockNetworkCapabilities: NetworkCapabilities

    @Before
    fun setup() {
        mockContext = mockk()
        mockConnectivityManager = mockk()
        mockNetwork = mockk()
        mockNetworkCapabilities = mockk()

        mockkStatic(ConnectivityManager::class)
        every { mockContext.getSystemService(Context.CONNECTIVITY_SERVICE) } returns mockConnectivityManager
    }

    @Test
    fun `isConnected should return true when network is available and validated`() = runTest {
        // Given
        every { mockConnectivityManager.activeNetwork } returns mockNetwork
        every { mockConnectivityManager.getNetworkCapabilities(mockNetwork) } returns mockNetworkCapabilities
        every { mockNetworkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) } returns true
        every { mockNetworkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) } returns true

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val result = connectivityMonitor.isConnected()

        // Then
        assertTrue(result)
    }

    @Test
    fun `isConnected should return false when network is not validated`() = runTest {
        // Given
        every { mockConnectivityManager.activeNetwork } returns mockNetwork
        every { mockConnectivityManager.getNetworkCapabilities(mockNetwork) } returns mockNetworkCapabilities
        every { mockNetworkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) } returns true
        every { mockNetworkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) } returns false

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val result = connectivityMonitor.isConnected()

        // Then
        assertFalse(result)
    }

    @Test
    fun `isConnected should return false when no active network`() = runTest {
        // Given
        every { mockConnectivityManager.activeNetwork } returns null

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val result = connectivityMonitor.isConnected()

        // Then
        assertFalse(result)
    }

    @Test
    fun `getNetworkType should return WIFI when connected via WiFi`() = runTest {
        // Given
        every { mockConnectivityManager.activeNetwork } returns mockNetwork
        every { mockConnectivityManager.getNetworkCapabilities(mockNetwork) } returns mockNetworkCapabilities
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) } returns true
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) } returns false

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val networkType = connectivityMonitor.getNetworkType()

        // Then
        assertEquals(NetworkType.WIFI, networkType)
    }

    @Test
    fun `getNetworkType should return CELLULAR when connected via mobile data`() = runTest {
        // Given
        every { mockConnectivityManager.activeNetwork } returns mockNetwork
        every { mockConnectivityManager.getNetworkCapabilities(mockNetwork) } returns mockNetworkCapabilities
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) } returns true
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) } returns false

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val networkType = connectivityMonitor.getNetworkType()

        // Then
        assertEquals(NetworkType.CELLULAR, networkType)
    }

    @Test
    fun `getNetworkType should return VPN when connected via VPN`() = runTest {
        // Given
        every { mockConnectivityManager.activeNetwork } returns mockNetwork
        every { mockConnectivityManager.getNetworkCapabilities(mockNetwork) } returns mockNetworkCapabilities
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) } returns false
        every { mockNetworkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) } returns true

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val networkType = connectivityMonitor.getNetworkType()

        // Then
        assertEquals(NetworkType.VPN, networkType)
    }

    @Test
    fun `getNetworkType should return NONE when no network`() = runTest {
        // Given
        every { mockConnectivityManager.activeNetwork } returns null

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val networkType = connectivityMonitor.getNetworkType()

        // Then
        assertEquals(NetworkType.NONE, networkType)
    }

    @Test
    fun `isMetered should return true for cellular connection`() = runTest {
        // Given
        every { mockConnectivityManager.isActiveNetworkMetered } returns true

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val result = connectivityMonitor.isMetered()

        // Then
        assertTrue(result)
    }

    @Test
    fun `isMetered should return false for WiFi connection`() = runTest {
        // Given
        every { mockConnectivityManager.isActiveNetworkMetered } returns false

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val result = connectivityMonitor.isMetered()

        // Then
        assertFalse(result)
    }

    @Test
    fun `hasSufficientBandwidth should return true when bandwidth is adequate`() = runTest {
        // Given
        every { mockConnectivityManager.activeNetwork } returns mockNetwork
        every { mockConnectivityManager.getNetworkCapabilities(mockNetwork) } returns mockNetworkCapabilities
        every { mockNetworkCapabilities.linkDownstreamBandwidthKbps } returns 10000 // 10 Mbps
        every { mockNetworkCapabilities.linkUpstreamBandwidthKbps } returns 5000   // 5 Mbps

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val result = connectivityMonitor.hasSufficientBandwidth(500, 100)

        // Then
        assertTrue(result)
    }

    @Test
    fun `hasSufficientBandwidth should return false when bandwidth is insufficient`() = runTest {
        // Given
        every { mockConnectivityManager.activeNetwork } returns mockNetwork
        every { mockConnectivityManager.getNetworkCapabilities(mockNetwork) } returns mockNetworkCapabilities
        every { mockNetworkCapabilities.linkDownstreamBandwidthKbps } returns 100  // 100 kbps
        every { mockNetworkCapabilities.linkUpstreamBandwidthKbps } returns 50     // 50 kbps

        connectivityMonitor = ConnectivityMonitor(mockContext)

        // When
        val result = connectivityMonitor.hasSufficientBandwidth(500, 100)

        // Then
        assertFalse(result)
    }

    @Test
    fun `networkStateFlow should emit true when network becomes available`() = runTest {
        // This test verifies the flow emits values
        // In a real test, you would mock the callback behavior
        
        connectivityMonitor = ConnectivityMonitor(mockContext)
        
        // Given
        every { mockConnectivityManager.activeNetwork } returns mockNetwork
        every { mockConnectivityManager.getNetworkCapabilities(mockNetwork) } returns mockNetworkCapabilities
        every { mockNetworkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) } returns true
        every { mockNetworkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) } returns true

        // When
        val state = connectivityMonitor.networkStateFlow.first()

        // Then
        assertTrue(state)
    }

    @Test
    fun `networkStateFlow should emit false when network is unavailable`() = runTest {
        connectivityMonitor = ConnectivityMonitor(mockContext)
        
        // Given
        every { mockConnectivityManager.activeNetwork } returns null

        // When
        val state = connectivityMonitor.networkStateFlow.first()

        // Then
        assertFalse(state)
    }
}
