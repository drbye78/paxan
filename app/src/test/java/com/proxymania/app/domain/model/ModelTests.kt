package com.proxymania.app.domain.model

import org.junit.Assert.*
import org.junit.Test

class ProxyTest {

    @Test
    fun testProxy_displayName() {
        val proxy = Proxy(
            id = "test1",
            host = "192.168.1.1",
            port = 8080
        )

        assertEquals("192.168.1.1:8080", proxy.displayName)
    }

    @Test
    fun testProxy_trustLevel_trusted() {
        val proxy = Proxy(
            id = "test1",
            host = "test.com",
            port = 80,
            trustScore = 80
        )

        assertEquals(TrustLevel.TRUSTED, proxy.trustLevel)
    }

    @Test
    fun testProxy_trustLevel_unverified() {
        val proxy = Proxy(
            id = "test2",
            host = "test.com",
            port = 80,
            trustScore = 50
        )

        assertEquals(TrustLevel.UNVERIFIED, proxy.trustLevel)
    }

    @Test
    fun testProxy_trustLevel_risky() {
        val proxy = Proxy(
            id = "test3",
            host = "test.com",
            port = 80,
            trustScore = 20
        )

        assertEquals(TrustLevel.RISKY, proxy.trustLevel)
    }
}

class AppSettingsTest {

    @Test
    fun testDefaultTestEndpoints() {
        val settings = AppSettings()

        assertTrue(settings.selectedTestEndpoints.isNotEmpty())
        assertTrue(settings.selectedTestEndpoints.any { it.contains("google") })
    }

    @Test
    fun testAppSettings_defaults() {
        val settings = AppSettings()

        assertFalse(settings.autoConnectOnStart)
        assertTrue(settings.autoReconnect)
        assertTrue(settings.failoverEnabled)
        assertFalse(settings.killSwitchEnabled)
        assertFalse(settings.autoRotateEnabled)
        assertEquals(15, settings.autoRotateIntervalMinutes)
        assertEquals(5000, settings.connectionTimeout)
    }
}

class ConnectionStateTest {

    @Test
    fun testConnectionState_allStates() {
        val states = ConnectionState.entries

        assertTrue(states.contains(ConnectionState.DISCONNECTED))
        assertTrue(states.contains(ConnectionState.CONNECTING))
        assertTrue(states.contains(ConnectionState.CONNECTED))
        assertTrue(states.contains(ConnectionState.DISCONNECTING))
        assertTrue(states.contains(ConnectionState.ERROR))
    }
}

class AutoRotateIntervalTest {

    @Test
    fun testAutoRotateInterval_values() {
        assertEquals(0, AutoRotateInterval.OFF.minutes)
        assertEquals(5, AutoRotateInterval.FIVE_MINUTES.minutes)
        assertEquals(15, AutoRotateInterval.FIFTEEN_MINUTES.minutes)
        assertEquals(30, AutoRotateInterval.THIRTY_MINUTES.minutes)
        assertEquals(60, AutoRotateInterval.ONE_HOUR.minutes)
    }

    @Test
    fun testAutoRotateInterval_display() {
        assertEquals("Off", AutoRotateInterval.OFF.display)
        assertEquals("5 minutes", AutoRotateInterval.FIVE_MINUTES.display)
    }
}