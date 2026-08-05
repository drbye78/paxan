package com.peasyproxy.app.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import com.peasyproxy.app.R
import com.peasyproxy.app.data.repository.ProxyRepository
import com.peasyproxy.app.data.repository.SettingsRepository
import com.peasyproxy.app.data.repository.VpnStateRepository
import com.peasyproxy.app.domain.model.ConnectionConfig
import com.peasyproxy.app.domain.model.ConnectionInfo
import com.peasyproxy.app.domain.model.ConnectionState
import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.ProxyProtocol
import com.peasyproxy.app.ui.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import okhttp3.OkHttpClient
import okhttp3.Request
import timber.log.Timber
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.InetSocketAddress
import java.net.Proxy as JavaProxy
import java.util.concurrent.TimeUnit
import javax.inject.Inject

@AndroidEntryPoint
class VpnService : VpnService() {

    @Inject
    lateinit var vpnController: VpnController

    @Inject
    lateinit var settingsRepository: SettingsRepository

    @Inject
    lateinit var vpnStateRepository: VpnStateRepository

    @Inject
    lateinit var okHttpClient: OkHttpClient

    @Inject
    lateinit var splitTunnelManager: SplitTunnelManager

    @Inject
    lateinit var proxyRepository: ProxyRepository

    private var vpnInterface: ParcelFileDescriptor? = null
    private var isRunning = false
    private var connectionJob: Job? = null
    private var packetProcessingJob: Job? = null
    private var healthPollingJob: Job? = null
    private var failoverAttempt = 0
    private val maxFailoverAttempts = 3
    
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val _connectionInfo = MutableStateFlow(ConnectionInfo())
    val connectionInfo: StateFlow<ConnectionInfo> = _connectionInfo

    companion object {
        const val CHANNEL_ID = "vpn_service_channel"
        const val NOTIFICATION_ID = 1
        
        const val ACTION_CONNECT = "com.peasyproxy.app.CONNECT"
        const val ACTION_DISCONNECT = "com.peasyproxy.app.DISCONNECT"
        const val EXTRA_PROXY_HOST = "proxy_host"
        const val EXTRA_PROXY_PORT = "proxy_port"
        const val EXTRA_PROXY_PROTOCOL = "proxy_protocol"
        const val EXTRA_PROXY_USERNAME = "proxy_username"
        const val EXTRA_PROXY_PASSWORD = "proxy_password"

        private const val VPN_ADDRESS = "10.0.0.2"
        private const val VPN_ROUTE = "0.0.0.0"
        private const val VPN_MTU = 1500
        private const val DNS_SERVER = "8.8.8.8"
        private const val HEALTH_CHECK_INTERVAL = 30_000L
        private const val TEST_CONNECTIVITY_URL = "https://httpbin.org/ip"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CONNECT -> {
                val host = intent.getStringExtra(EXTRA_PROXY_HOST)
                val port = intent.getIntExtra(EXTRA_PROXY_PORT, 0)
                val protocol = intent.getStringExtra(EXTRA_PROXY_PROTOCOL) ?: "HTTP"
                val username = intent.getStringExtra(EXTRA_PROXY_USERNAME)
                val password = intent.getStringExtra(EXTRA_PROXY_PASSWORD)

                if (host != null && port > 0) {
                    val proxy = Proxy(
                        id = "${host}:${port}:$protocol",
                        host = host,
                        port = port,
                        protocol = try { ProxyProtocol.valueOf(protocol) } catch (e: IllegalArgumentException) { ProxyProtocol.HTTP },
                        username = username,
                        password = password
                    )
                    startVpn(proxy)
                }
            }
            ACTION_DISCONNECT -> {
                stopVpn()
            }
        }
        return START_STICKY
    }

    private fun startVpn(proxy: Proxy) {
        if (isRunning) {
            stopVpn()
        }

        _connectionInfo.value = ConnectionInfo(
            state = ConnectionState.CONNECTING,
            currentProxy = proxy
        )

        connectionJob = serviceScope.launch {
            try {
                vpnStateRepository.setConnecting(proxy)

                val config = ConnectionConfig(
                    proxy = proxy,
                    dnsPrimary = "8.8.8.8",
                    dnsSecondary = "8.8.4.4",
                    routeAllTraffic = true
                )

                val connected = vpnController.connect(proxy, config)
                
                if (connected) {
                    setupVpnInterface(config)
                    startForeground(NOTIFICATION_ID, buildNotification(proxy, true))
                    startPacketProcessing()

                    // Probe connectivity through proxy before declaring CONNECTED
                    val probeOk = probeProxyConnectivity(proxy)
                    if (!probeOk) {
                        throw Exception("Proxy connectivity probe failed")
                    }

                    failoverAttempt = 0 // reset on successful connect
                    
                    _connectionInfo.value = _connectionInfo.value.copy(
                        state = ConnectionState.CONNECTED,
                        connectedSince = System.currentTimeMillis()
                    )
                    vpnStateRepository.setConnected(proxy)
                    startHealthPolling()
                } else {
                    throw Exception("Failed to connect to proxy")
                }
                
            } catch (e: Exception) {
                _connectionInfo.value = _connectionInfo.value.copy(
                    state = ConnectionState.ERROR,
                    errorMessage = e.message
                )
                vpnStateRepository.setError(e.message)
                stopVpn()
            }
        }
    }

    private suspend fun setupVpnInterface(config: ConnectionConfig) {
        val builder = Builder()
            .setSession("PeasyProxy")
            .setMtu(VPN_MTU)
            .addAddress(VPN_ADDRESS, 32)
            .addRoute(VPN_ROUTE, 0)
            .addDnsServer(config.dnsPrimary)
            
        if (config.dnsSecondary.isNotEmpty()) {
            builder.addDnsServer(config.dnsSecondary)
        }

        builder.setBlocking(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            splitTunnelManager.applyConfig(builder)
        }

        vpnInterface = builder.establish()
        
        if (vpnInterface == null) {
            throw Exception("Failed to establish VPN interface")
        }
    }

    private fun startPacketProcessing() {
        isRunning = true
        packetProcessingJob = serviceScope.launch(Dispatchers.IO) {
            processPackets()
        }
    }

    private suspend fun processPackets() {
        val vpnFd = vpnInterface?.fileDescriptor ?: return

        FileInputStream(vpnFd).use { inputStream ->
            FileOutputStream(vpnFd).use { outputStream ->
                // Use two long-lived coroutines instead of spawning new ones per iteration
                val readJob = serviceScope.launch(Dispatchers.IO) {
                    try {
                        val packet = ByteArray(VPN_MTU)
                        while (isRunning && isActive) {
                            val bytesRead = inputStream.read(packet)
                            if (bytesRead > 0) {
                                val packetData = packet.copyOf(bytesRead)
                                vpnController.sendPacket(packetData)
                            }
                        }
                    } catch (e: Exception) {
                        if (isRunning) {
                            handleConnectionError(e)
                        }
                    }
                }

                val writeJob = serviceScope.launch(Dispatchers.IO) {
                    try {
                        while (isRunning && isActive) {
                            val packet = vpnController.receivePacket()
                            if (packet != null && packet.isNotEmpty()) {
                                outputStream.write(packet)
                                outputStream.flush()
                            }
                        }
                    } catch (e: Exception) {
                        if (isRunning) {
                            handleConnectionError(e)
                        }
                    }
                }

                readJob.join()
                writeJob.join()
            }
        }
    }

    private suspend fun probeProxyConnectivity(proxy: Proxy): Boolean = withContext(Dispatchers.IO) {
        try {
            val client = okHttpClient.newBuilder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .proxy(JavaProxy(
                    when (proxy.protocol) {
                        ProxyProtocol.SOCKS4, ProxyProtocol.SOCKS5 -> JavaProxy.Type.SOCKS
                        else -> JavaProxy.Type.HTTP
                    },
                    InetSocketAddress(proxy.host, proxy.port)
                ))
                .build()

            try {
                val request = Request.Builder()
                    .url(TEST_CONNECTIVITY_URL)
                    .head()
                    .build()

                val response = client.newCall(request).execute()
                response.close()
                response.isSuccessful
            } catch (e: Exception) {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun startHealthPolling() {
        healthPollingJob?.cancel()
        healthPollingJob = serviceScope.launch {
            while (isActive) {
                delay(HEALTH_CHECK_INTERVAL)
                try {
                    val proxy = vpnController.getCurrentProxy()
                    if (proxy != null) {
                        val result = probeProxyConnectivity(proxy)
                        if (!result) {
                            _connectionInfo.value = _connectionInfo.value.copy(
                                state = ConnectionState.UNSTABLE
                            )
                            vpnStateRepository.setUnstable("Proxy health check failed")
                        } else {
                            // Recover: reset back to Connected if previously Unstable
                            vpnStateRepository.recoverFromUnstable(
                                proxy,
                                _connectionInfo.value.connectedSince ?: System.currentTimeMillis()
                            )
                        }
                    }
                } catch (e: Exception) {
                    // Log and continue
                }
            }
        }
    }

    private suspend fun handleConnectionError(error: Throwable) {
        val settings = settingsRepository.settingsFlow.first()
        
        if (settings.failoverEnabled) {
            performFailover()
        } else {
            _connectionInfo.value = _connectionInfo.value.copy(
                state = ConnectionState.ERROR,
                errorMessage = error.message
            )
            stopVpn()
        }
    }

    private suspend fun performFailover() {
        failoverAttempt++
        if (failoverAttempt > maxFailoverAttempts) {
            Timber.w("Max failover attempts ($maxFailoverAttempts) reached, giving up")
            _connectionInfo.value = _connectionInfo.value.copy(
                state = ConnectionState.ERROR,
                errorMessage = "Failover exhausted: tried $maxFailoverAttempts alternatives"
            )
            vpnStateRepository.setError("Failover exhausted")
            stopVpn()
            return
        }

        val failedProxy = vpnController.getCurrentProxy()
        val currentInfo = _connectionInfo.value

        _connectionInfo.value = currentInfo.copy(
            state = ConnectionState.UNSTABLE,
            errorMessage = "Attempting failover..."
        )
        vpnStateRepository.setUnstable("Failover in progress")

        try {
            // Disconnect from failed proxy
            vpnController.disconnect()

            // Get alternative proxies (favorites first, then trusted, then all)
            val alternatives = mutableListOf<Proxy>()
            try {
                proxyRepository.getFavoriteProxies().first().let { favorites ->
                    alternatives.addAll(favorites.filter { it.id != failedProxy?.id })
                }
            } catch (_: Exception) { /* fall through */ }

            if (alternatives.isEmpty()) {
                try {
                    proxyRepository.getTrustedProxies().first().let { trusted ->
                        alternatives.addAll(trusted.filter { it.id != failedProxy?.id })
                    }
                } catch (_: Exception) { /* fall through */ }
            }

            if (alternatives.isEmpty()) {
                try {
                    proxyRepository.getAllProxies().first().let { all ->
                        alternatives.addAll(all.filter { it.id != failedProxy?.id })
                    }
                } catch (_: Exception) { /* fall through */ }
            }

            if (alternatives.isEmpty()) {
                throw Exception("No alternative proxies available for failover")
            }

            // Pick the best alternative: prefer lower latency, higher trust
            val bestAlternative = alternatives.maxByOrNull { it.trustScore * 1000 - it.latency }
                ?: alternatives.first()

            Timber.d("Failover: switching from ${failedProxy?.host} to ${bestAlternative.host}")

            // Connect to new proxy
            val config = ConnectionConfig(
                proxy = bestAlternative,
                dnsPrimary = "8.8.8.8",
                dnsSecondary = "8.8.4.4",
                routeAllTraffic = true
            )

            val connected = vpnController.connect(bestAlternative, config)

            if (connected) {
                val probeOk = probeProxyConnectivity(bestAlternative)
                if (!probeOk) {
                    // Recursive: try next alternative or give up
                    performFailover()
                    return
                }

                _connectionInfo.value = _connectionInfo.value.copy(
                    state = ConnectionState.CONNECTED,
                    currentProxy = bestAlternative,
                    connectedSince = System.currentTimeMillis()
                )
                vpnStateRepository.setConnected(bestAlternative)
            } else {
                throw Exception("Failed to connect to failover proxy ${bestAlternative.host}")
            }

        } catch (e: Exception) {
            Timber.e(e, "Failover failed")
            _connectionInfo.value = _connectionInfo.value.copy(
                state = ConnectionState.ERROR,
                errorMessage = "Failover failed: ${e.message}"
            )
            vpnStateRepository.setError("Failover failed: ${e.message}")
            stopVpn()
        }
    }

    private fun stopVpn() {
        isRunning = false
        connectionJob?.cancel()
        packetProcessingJob?.cancel()
        healthPollingJob?.cancel()
        healthPollingJob = null
        
        serviceScope.launch {
            try {
                vpnController.disconnect()
            } catch (e: Exception) {
                // Ignore disconnect errors
            }
        }

        try {
            vpnInterface?.close()
            vpnInterface = null
        } catch (e: Exception) {
            // Ignore close errors
        }

        _connectionInfo.value = ConnectionInfo(state = ConnectionState.DISCONNECTED)
        vpnStateRepository.setDisconnected()
        
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopVpn()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onRevoke() {
        stopVpn()
        super.onRevoke()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.vpn_notification_channel),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "VPN Service Status"
                setShowBadge(false)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(proxy: Proxy, connected: Boolean): android.app.Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val disconnectIntent = Intent(this, VpnService::class.java).apply {
            action = ACTION_DISCONNECT
        }
        val disconnectPendingIntent = PendingIntent.getService(
            this, 1, disconnectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val statusText = if (connected) {
            "Connected to ${proxy.host}:${proxy.port}"
        } else {
            getString(R.string.vpn_disconnected)
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.vpn_notification_title))
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pendingIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                getString(R.string.action_disconnect),
                disconnectPendingIntent
            )
            .setOngoing(connected)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    fun updateNotification(proxy: Proxy, connected: Boolean) {
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, buildNotification(proxy, connected))
    }

    fun getPacketProcessor() = vpnController.getPacketProcessor()
}