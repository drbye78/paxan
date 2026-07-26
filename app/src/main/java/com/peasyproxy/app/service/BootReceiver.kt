package com.peasyproxy.app.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import com.peasyproxy.app.data.repository.SettingsRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import timber.log.Timber
import java.util.concurrent.TimeUnit
import javax.inject.Inject

@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject
    lateinit var settingsRepository: SettingsRepository

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val settings = settingsRepository.settingsFlow.first()

                if (settings.autoConnectOnStart) {
                    try {
                        val vpnIntent = Intent(context, VpnService::class.java).apply {
                            action = VpnService.ACTION_CONNECT
                        }

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            context.startForegroundService(vpnIntent)
                        } else {
                            context.startService(vpnIntent)
                        }
                    } catch (e: Exception) {
                        Timber.e(e, "Failed to start VPN on boot")
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            // Fallback: schedule via WorkManager when direct start is blocked
                            val workRequest = OneTimeWorkRequestBuilder<HealthWorker>()
                                .setInitialDelay(10, TimeUnit.SECONDS)
                                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                                .build()
                            WorkManager.getInstance(context)
                                .enqueueUniqueWork(
                                    "boot_recovery_work",
                                    ExistingWorkPolicy.KEEP,
                                    workRequest
                                )
                        }
                    }
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}