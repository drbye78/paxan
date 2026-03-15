package com.proxymania.app.domain.model

data class NotificationPreferences(
    val connectionNotifications: Boolean = true,
    val errorAlerts: Boolean = true,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val soundUri: String? = null,
    val vibrationPattern: LongArray = longArrayOf(0, 250, 250, 250)
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as NotificationPreferences

        if (connectionNotifications != other.connectionNotifications) return false
        if (errorAlerts != other.errorAlerts) return false
        if (soundEnabled != other.soundEnabled) return false
        if (vibrationEnabled != other.vibrationEnabled) return false
        if (soundUri != other.soundUri) return false
        if (!vibrationPattern.contentEquals(other.vibrationPattern)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = connectionNotifications.hashCode()
        result = 31 * result + errorAlerts.hashCode()
        result = 31 * result + soundEnabled.hashCode()
        result = 31 * result + vibrationEnabled.hashCode()
        result = 31 * result + (soundUri?.hashCode() ?: 0)
        result = 31 * result + vibrationPattern.contentHashCode()
        return result
    }
}

enum class VibrationPattern(val pattern: LongArray, val displayName: String) {
    DEFAULT(longArrayOf(0, 250, 250, 250), "Default"),
    SHORT(longArrayOf(0, 100), "Short"),
    LONG(longArrayOf(0, 500, 200, 500), "Long"),
    DOUBLE(longArrayOf(0, 200, 100, 200), "Double"),
    NONE(longArrayOf(0), "None")
}