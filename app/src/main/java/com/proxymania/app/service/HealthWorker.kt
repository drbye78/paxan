package com.proxymania.app.service

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.proxymania.app.data.remote.ProxyTester
import com.proxymania.app.data.repository.ProxyRepository
import com.proxymania.app.data.repository.SettingsRepository
import com.proxymania.app.data.repository.StatisticsRepository
import com.proxymania.app.domain.model.Proxy
import com.proxymania.app.domain.model.ProxyTestResult
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first
import java.util.concurrent.TimeUnit

@HiltWorker
class HealthWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val proxyRepository: ProxyRepository,
    private val settingsRepository: SettingsRepository,
    private val statisticsRepository: StatisticsRepository,
    private val proxyTester: ProxyTester,
    private val vpnController: VpnController
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val settings = settingsRepository.settingsFlow.first()
            
            if (!vpnController.isConnected.value) {
                return Result.success()
            }

            val currentProxy = vpnController.getCurrentProxy()
            if (currentProxy == null) {
                return Result.success()
            }

            val testResult = testProxyHealth(currentProxy)
            
            updateStatistics(testResult)
            
            if (!testResult.isReachable && settings.failoverEnabled) {
                performFailover()
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private suspend fun testProxyHealth(proxy: Proxy): ProxyTestResult {
        return proxyTester.testMultipleEndpoints(proxy)
    }

    private suspend fun updateStatistics(result: ProxyTestResult) {
        if (result.isReachable) {
            statisticsRepository.updateAverageLatency(result.latency)
        }
    }

    private suspend fun performFailover() {
        val settings = settingsRepository.settingsFlow.first()
        val bestProxies = proxyRepository.getFastestProxies(10)
        
        val currentProxy = vpnController.getCurrentProxy()
        val nextProxy = bestProxies.firstOrNull { it.id != currentProxy?.id }
        
        if (nextProxy != null) {
            try {
                vpnController.connect(nextProxy)
                proxyRepository.updateProxyUsage(nextProxy.id)
            } catch (e: Exception) {
                // Failover failed
            }
        }
    }

    companion object {
        private const val WORK_NAME = "health_check_work"

        fun schedule(context: Context, intervalSeconds: Int = 30) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                .build()

            val workRequest = PeriodicWorkRequestBuilder<HealthWorker>(
                intervalSeconds.toLong(), TimeUnit.SECONDS
            )
                .setConstraints(constraints)
                .setInitialDelay(intervalSeconds.toLong(), TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.UPDATE,
                    workRequest
                )
        }

        fun scheduleOneTime(context: Context) {
            val workRequest = OneTimeWorkRequestBuilder<HealthWorker>()
                .build()

            WorkManager.getInstance(context).enqueue(workRequest)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}