package com.proxymania.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.proxymania.app.R
import com.proxymania.app.ui.MainActivity

class ProxyManiaWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        // Widget enabled
    }

    override fun onDisabled(context: Context) {
        // Widget disabled
    }

    companion object {
        const val ACTION_CONNECT = "com.proxymania.app.WIDGET_CONNECT"
        const val ACTION_DISCONNECT = "com.proxymania.app.WIDGET_DISCONNECT"

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            isConnected: Boolean = false,
            proxyHost: String? = null,
            downloadSpeed: Long = 0,
            uploadSpeed: Long = 0
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_layout)

            // Set click intent
            val intent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

            // Update status text
            val statusText = if (isConnected) "Connected" else "Tap to connect"
            views.setTextViewText(R.id.widget_status, statusText)

            // Update proxy info
            if (isConnected && proxyHost != null) {
                views.setTextViewText(R.id.widget_proxy, proxyHost)
                views.setViewVisibility(R.id.widget_proxy, android.view.View.VISIBLE)
                views.setViewVisibility(R.id.widget_stats, android.view.View.VISIBLE)
                
                // Update speeds
                views.setTextViewText(R.id.widget_download, "↓ ${formatSpeed(downloadSpeed)}")
                views.setTextViewText(R.id.widget_upload, "↑ ${formatSpeed(uploadSpeed)}")
            } else {
                views.setViewVisibility(R.id.widget_proxy, android.view.View.GONE)
                views.setViewVisibility(R.id.widget_stats, android.view.View.GONE)
            }

            // Update background based on state
            val backgroundColor = if (isConnected) "#1E1E1E" else "#121212"
            views.setInt(R.id.widget_container, "setBackgroundColor", android.graphics.Color.parseColor(backgroundColor))

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun updateAllWidgets(
            context: Context,
            isConnected: Boolean,
            proxyHost: String?,
            downloadSpeed: Long,
            uploadSpeed: Long
        ) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, ProxyManiaWidgetProvider::class.java)
            )

            for (appWidgetId in appWidgetIds) {
                updateAppWidget(
                    context,
                    appWidgetManager,
                    appWidgetId,
                    isConnected,
                    proxyHost,
                    downloadSpeed,
                    uploadSpeed
                )
            }
        }

        private fun formatSpeed(bytesPerSecond: Long): String {
            return when {
                bytesPerSecond < 1024 -> "$bytesPerSecond B/s"
                bytesPerSecond < 1024 * 1024 -> "${bytesPerSecond / 1024} KB/s"
                else -> String.format("%.1f MB/s", bytesPerSecond / (1024.0 * 1024.0))
            }
        }
    }
}