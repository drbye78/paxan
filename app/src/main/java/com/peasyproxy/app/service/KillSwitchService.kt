package com.peasyproxy.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.peasyproxy.app.R
import com.peasyproxy.app.data.repository.SettingsRepository
import com.peasyproxy.app.data.repository.VpnStateRepository
import com.peasyproxy.app.domain.model.VpnState
import com.peasyproxy.app.ui.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

@AndroidEntryPoint
class KillSwitchService : Service() {

    @Inject
    lateinit var settingsRepository: SettingsRepository

    @Inject
    lateinit var vpnStateRepository: VpnStateRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var isKillSwitchActive = false
    private var shouldBlockTraffic = false

    companion object {
        const val CHANNEL_ID = "kill_switch_channel"
        const val NOTIFICATION_ID = 1001
        
        const val ACTION_BLOCK_TRAFFIC = "com.peasyproxy.app.BLOCK_TRAFFIC"
        const val ACTION_ALLOW_TRAFFIC = "com.peasyproxy.app.ALLOW_TRAFFIC"
        const val ACTION_ENABLE = "com.peasyproxy.app.ENABLE_KILL_SWITCH"
        const val ACTION_DISABLE = "com.peasyproxy.app.DISABLE_KILL_SWITCH"

        private const val TAG = "KillSwitchService"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        Timber.d("KillSwitchService created")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_ENABLE -> {
                Timber.d("Kill switch enabled")
                scope.launch { enableKillSwitch() }
            }
            ACTION_DISABLE -> {
                Timber.d("Kill switch disabled")
                scope.launch { disableKillSwitch() }
            }
            ACTION_BLOCK_TRAFFIC -> {
                Timber.d("Kill switch blocking traffic")
                startForeground(NOTIFICATION_ID, buildNotification(true))
                shouldBlockTraffic = true
            }
            ACTION_ALLOW_TRAFFIC -> {
                Timber.d("Kill switch allowing traffic")
                shouldBlockTraffic = false
                stopForeground(STOP_FOREGROUND_REMOVE)
            }
        }
        return START_STICKY
    }

    private suspend fun enableKillSwitch() {
        if (isKillSwitchActive) return
        
        val settings = settingsRepository.settingsFlow.first()
        if (!settings.killSwitchEnabled) {
            Timber.d("Kill switch is disabled in settings")
            return
        }

        isKillSwitchActive = true
        startForeground(NOTIFICATION_ID, buildNotification(false))
        registerNetworkCallback()
        
        Timber.i("Kill switch enabled")
    }

    private suspend fun disableKillSwitch() {
        if (!isKillSwitchActive) return
        
        isKillSwitchActive = false
        shouldBlockTraffic = false
        unregisterNetworkCallback()
        stopForeground(STOP_FOREGROUND_REMOVE)
        
        Timber.i("Kill switch disabled")
    }

    private fun registerNetworkCallback() {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Timber.d("Network available: $network")
                scope.launch { checkAndHandleNetworkState() }
            }

            override fun onLost(network: Network) {
                Timber.d("Network lost: $network")
                scope.launch { checkAndHandleNetworkState() }
            }

            override fun onCapabilitiesChanged(
                network: Network,
                networkCapabilities: NetworkCapabilities
            ) {
                val hasInternet = networkCapabilities.hasCapability(
                    NetworkCapabilities.NET_CAPABILITY_INTERNET
                )
                Timber.d("Network capabilities changed, hasInternet: $hasInternet")
                scope.launch { checkAndHandleNetworkState() }
            }
        }

        try {
            connectivityManager.registerNetworkCallback(networkRequest, networkCallback!!)
            Timber.d("Network callback registered")
        } catch (e: Exception) {
            Timber.e(e, "Failed to register network callback")
        }
    }

    private fun unregisterNetworkCallback() {
        networkCallback?.let { callback ->
            try {
                val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                connectivityManager.unregisterNetworkCallback(callback)
                Timber.d("Network callback unregistered")
            } catch (e: Exception) {
                Timber.e(e, "Failed to unregister network callback")
            }
        }
        networkCallback = null
    }

    private suspend fun checkAndHandleNetworkState() {
        if (!isKillSwitchActive) return

        val vpnState = vpnStateRepository.state.first()
        val isVpnConnected = vpnState is VpnState.Connected
        
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork
        val capabilities = network?.let { connectivityManager.getNetworkCapabilities(it) }
        val hasInternet = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true

        Timber.d("VPN state: $isVpnConnected, hasInternet: $hasInternet")

        if (!isVpnConnected && hasInternet && shouldBlockTraffic) {
            Timber.w("VPN disconnected but internet available - kill switch should block")
            // The actual blocking is handled by the VPN service
            // This is a monitoring/notification service
        }

        if (isVpnConnected) {
            shouldBlockTraffic = false
            updateNotification(false)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.kill_switch_notification_channel),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Kill Switch Status"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(blocking: Boolean): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val (title, text) = if (blocking) {
            Pair(
                getString(R.string.kill_switch_blocking_title),
                getString(R.string.kill_switch_blocking_text)
            )
        } else {
            Pair(
                getString(R.string.kill_switch_active_title),
                getString(R.string.kill_switch_active_text)
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pendingIntent)
            .setOngoing(blocking)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun updateNotification(blocking: Boolean) {
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, buildNotification(blocking))
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.launch { disableKillSwitch() }
        Timber.d("KillSwitchService destroyed")
    }
}
