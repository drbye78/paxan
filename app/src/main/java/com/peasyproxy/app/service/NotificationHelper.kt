package com.peasyproxy.app.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import com.peasyproxy.app.R
import com.peasyproxy.app.domain.model.NotificationPreferences
import com.peasyproxy.app.ui.MainActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NotificationHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    companion object {
        const val CHANNEL_CONNECTION = "connection_channel"
        const val CHANNEL_ERROR = "error_channel"
        const val CHANNEL_STATUS = "status_channel"
        
        const val NOTIFICATION_ID_CONNECTION = 100
        const val NOTIFICATION_ID_ERROR = 101
        const val NOTIFICATION_ID_STATUS = 102
    }

    init {
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Connection channel
            val connectionChannel = NotificationChannel(
                CHANNEL_CONNECTION,
                "Connection",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "VPN connection notifications"
                enableVibration(true)
            }

            // Error channel
            val errorChannel = NotificationChannel(
                CHANNEL_ERROR,
                "Errors",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Error and alert notifications"
                enableVibration(true)
            }

            // Status channel
            val statusChannel = NotificationChannel(
                CHANNEL_STATUS,
                "Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "VPN status notifications"
            }

            notificationManager.createNotificationChannels(
                listOf(connectionChannel, errorChannel, statusChannel)
            )
        }
    }

    fun showConnectionNotification(
        isConnected: Boolean,
        proxyHost: String?,
        preferences: NotificationPreferences
    ) {
        if (!preferences.connectionNotifications) return

        val channelId = if (isConnected) CHANNEL_CONNECTION else CHANNEL_STATUS
        val title = if (isConnected) "VPN Connected" else "VPN Disconnected"
        val text = if (isConnected && proxyHost != null) {
            "Connected to $proxyHost"
        } else {
            "Tap to connect"
        }

        val intent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)

        if (preferences.soundEnabled) {
            val soundUri = preferences.soundUri?.let { Uri.parse(it) }
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            builder.setSound(soundUri)
        }

        if (preferences.vibrationEnabled) {
            builder.setVibrate(preferences.vibrationPattern)
        }

        notificationManager.notify(NOTIFICATION_ID_CONNECTION, builder.build())
    }

    fun showErrorNotification(
        errorMessage: String,
        preferences: NotificationPreferences
    ) {
        if (!preferences.errorAlerts) return

        val intent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ERROR)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("VPN Error")
            .setContentText(errorMessage)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        if (preferences.soundEnabled) {
            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            builder.setSound(soundUri)
        }

        if (preferences.vibrationEnabled) {
            vibrate(preferences.vibrationPattern)
        }

        notificationManager.notify(NOTIFICATION_ID_ERROR, builder.build())
    }

    private fun vibrate(pattern: LongArray) {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        } catch (e: Exception) {
            // Ignore vibration errors
        }
    }

    fun cancelConnectionNotification() {
        notificationManager.cancel(NOTIFICATION_ID_CONNECTION)
    }

    fun cancelErrorNotification() {
        notificationManager.cancel(NOTIFICATION_ID_ERROR)
    }

    fun cancelAllNotifications() {
        notificationManager.cancelAll()
    }

    fun updateNotificationPreferences(prefs: NotificationPreferences) {
        // Recreate channels with new settings
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val connectionChannel = notificationManager.getNotificationChannel(CHANNEL_CONNECTION)
            connectionChannel?.enableVibration(prefs.vibrationEnabled)

            val errorChannel = notificationManager.getNotificationChannel(CHANNEL_ERROR)
            errorChannel?.enableVibration(prefs.vibrationEnabled)
        }
    }
}