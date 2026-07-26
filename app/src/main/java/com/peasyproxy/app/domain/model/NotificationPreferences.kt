package com.peasyproxy.app.domain.model

import androidx.compose.runtime.Immutable

@Immutable
data class NotificationPreferences(
    val connectionNotifications: Boolean = true,
    val errorAlerts: Boolean = true,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val soundUri: String? = null,
    val vibrationPattern: List<Long> = listOf(0, 250, 250, 250)
)

enum class VibrationPattern(val pattern: List<Long>, val displayName: String) {
    DEFAULT(listOf(0, 250, 250, 250), "Default"),
    SHORT(listOf(0, 100), "Short"),
    LONG(listOf(0, 500, 200, 500), "Long"),
    DOUBLE(listOf(0, 200, 100, 200), "Double"),
    NONE(listOf(0), "None")
}