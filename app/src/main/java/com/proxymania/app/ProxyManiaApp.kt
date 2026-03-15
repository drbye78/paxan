package com.proxymania.app

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.LocaleList
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.proxymania.app.BuildConfig
import com.proxymania.app.service.HealthWorker
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber
import java.util.Locale
import javax.inject.Inject

@HiltAndroidApp
class ProxyManiaApp : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(updateLocale(base))
    }

    override fun onCreate() {
        super.onCreate()

        initLogging()
        initCrashReporting()

        HealthWorker.schedule(this, 30)
    }

    fun setLocale(languageCode: String) {
        val locale = when (languageCode) {
            "ru" -> Locale("ru")
            else -> Locale.ENGLISH
        }
        Locale.setDefault(locale)
        val config = resources.configuration
        config.setLocale(locale)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            config.setLocales(LocaleList(locale))
        }
        resources.updateConfiguration(config, resources.displayMetrics)
    }

    fun getCurrentLanguage(): String {
        return resources.configuration.locales[0].language
    }

    private fun initLogging() {
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        } else {
            Timber.plant(ReleaseTree())
        }
    }

    private fun initCrashReporting() {
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Timber.e(throwable, "Uncaught exception in thread $thread")
            throw throwable
        }
    }

    private class ReleaseTree : Timber.Tree() {
        override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
            if (priority >= android.util.Log.ERROR) {
                android.util.Log.e(tag, message, t)
            }
        }
    }

    fun logEvent(eventName: String, params: Map<String, Any>? = null) {
        Timber.d("Event: $eventName, params: $params")
    }

    fun setUserId(userId: String) {
        Timber.d("User ID set: $userId")
    }

    fun setCustomKey(key: String, value: String) {
        Timber.d("Custom key: $key = $value")
    }

    fun setCustomKey(key: String, value: Int) {
        Timber.d("Custom key: $key = $value")
    }

    fun recordNonFatalError(throwable: Throwable, context: String = "") {
        Timber.e(throwable, "Non-fatal error: $context")
    }

    fun resetAnalyticsData() {
        Timber.d("Resetting analytics data")
    }

    companion object {
        fun logEventStatic(eventName: String, params: Map<String, Any>? = null) {
            Timber.d("Event: $eventName")
        }

        fun updateLocale(context: Context): Context {
            val language = try {
                val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
                prefs.getString("language", "en") ?: "en"
            } catch (e: Exception) {
                "en"
            }
            
            val locale = when (language) {
                "ru" -> Locale("ru")
                else -> Locale.ENGLISH
            }
            
            Locale.setDefault(locale)
            
            val config = context.resources.configuration
            config.setLocale(locale)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                config.setLocales(LocaleList(locale))
            }
            
            return context.createConfigurationContext(config)
        }
    }
}
