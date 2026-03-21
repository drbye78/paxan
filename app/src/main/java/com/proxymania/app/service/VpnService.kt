package com.proxymania.app.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import com.proxymania.app.R
import com.proxymania.app.data.repository.SettingsRepository
import com.proxymania.app.domain.model.ConnectionConfig
import com.proxymania.app.domain.model.ConnectionInfo
import com.proxymania.app.domain.model.ConnectionState
import com.proxymania.app.domain.model.Proxy
import com.proxymania.app.domain.model.ProxyProtocol
import com.proxymania.app.ui.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import javax.inject.Inject

@AndroidEntryPoint
class VpnService : VpnService() {

    @Inject
    lateinit var vpnController: VpnController

    @Inject
    lateinit var settingsRepository: SettingsRepository

    private var vpnInterface: ParcelFileDescriptor? = null
    private var isRunning = false
    private var connectionJob: Job? = null
    private var packetProcessingJob: Job? = null
    
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val _connectionInfo = MutableStateFlow(ConnectionInfo())
    val connectionInfo: StateFlow<ConnectionInfo> = _connectionInfo

    companion object {
        const val CHANNEL_ID = "vpn_service_channel"
        const val NOTIFICATION_ID = 1
        
        const val ACTION_CONNECT = "com.proxymania.app.CONNECT"
        const val ACTION_DISCONNECT = "com.proxymania.app.DISCONNECT"
        const val EXTRA_PROXY_HOST = "proxy_host"
        const val EXTRA_PROXY_PORT = "proxy_port"
        const val EXTRA_PROXY_PROTOCOL = "proxy_protocol"
        const val EXTRA_PROXY_USERNAME = "proxy_username"
        const val EXTRA_PROXY_PASSWORD = "proxy_password"

        private const val VPN_ADDRESS = "10.0.0.2"
        private const val VPN_ROUTE = "0.0.0.0"
        private const val VPN_MTU = 1500
        private const val DNS_SERVER = "8.8.8.8"
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
                        protocol = try { ProxyProtocol.valueOf(protocol) } catch (e: Exception) { ProxyProtocol.HTTP },
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
                val settings = settingsRepository.settingsFlow.first()
                
                val config = ConnectionConfig(
                    proxy = proxy,
                    dnsPrimary = if (settings.selectedTestEndpoints.isNotEmpty()) "8.8.8.8" else settings.selectedTestEndpoints.firstOrNull() ?: "8.8.8.8",
                    routeAllTraffic = true
                )

                val connected = vpnController.connect(proxy, config)
                
                if (connected) {
                    setupVpnInterface(config)
                    startForeground(NOTIFICATION_ID, buildNotification(proxy, true))
                    startPacketProcessing()
                    
                    _connectionInfo.value = _connectionInfo.value.copy(
                        state = ConnectionState.CONNECTED,
                        connectedSince = System.currentTimeMillis()
                    )
                } else {
                    throw Exception("Failed to connect to proxy")
                }
                
            } catch (e: Exception) {
                _connectionInfo.value = _connectionInfo.value.copy(
                    state = ConnectionState.ERROR,
                    errorMessage = e.message
                )
                stopVpn()
            }
        }
    }

    private fun setupVpnInterface(config: ConnectionConfig) {
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
        
        while (isRunning && kotlinx.coroutines.currentCoroutineContext().isActive) {
            try {
                val buffer = ByteBuffer.allocate(VPN_MTU)
                
                val inputStream = FileInputStream(vpnFd)
                val outputStream = FileOutputStream(vpnFd)
                
                val readDispatcher = serviceScope.launch(Dispatchers.IO) {
                    try {
                        val packet = ByteArray(VPN_MTU)
                        val bytesRead = inputStream.read(packet)
                        
                        if (bytesRead > 0) {
                            val packetData = packet.copyOf(bytesRead)
                            
                            if (PacketParser.isDnsPacket(packetData)) {
                                // Handle DNS packets
                            }
                            
                            vpnController.sendPacket(packetData)
                        }
                    } catch (e: Exception) {
                        if (isRunning) {
                            handleConnectionError(e)
                        }
                    }
                }
                
                val writeJob = serviceScope.launch(Dispatchers.IO) {
                    try {
                        val packet = vpnController.receivePacket()
                        if (packet != null && packet.isNotEmpty()) {
                            outputStream.write(packet)
                            outputStream.flush()
                        }
                    } catch (e: Exception) {
                        if (isRunning) {
                            handleConnectionError(e)
                        }
                    }
                }
                
                readDispatcher.join()
                writeJob.join()
                
                delay(10)
                
            } catch (e: Exception) {
                if (isRunning) {
                    handleConnectionError(e)
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
        // Implementation of failover logic would go here
    }

    private fun stopVpn() {
        isRunning = false
        connectionJob?.cancel()
        packetProcessingJob?.cancel()
        
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