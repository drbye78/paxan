package com.proxymania.app.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.proxymania.app.data.repository.SettingsRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject
    lateinit var settingsRepository: SettingsRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            scope.launch {
                try {
                    val settings = settingsRepository.settingsFlow.first()
                    
                    if (settings.autoConnectOnStart) {
                        val vpnIntent = Intent(context, VpnService::class.java).apply {
                            action = VpnService.ACTION_CONNECT
                        }
                        
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            context.startForegroundService(vpnIntent)
                        } else {
                            context.startService(vpnIntent)
                        }
                    }
                } catch (e: Exception) {
                    // Handle error silently
                }
            }
        }
    }
}