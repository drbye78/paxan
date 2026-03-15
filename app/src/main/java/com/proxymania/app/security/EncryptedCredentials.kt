package com.proxymania.app.security

/**
 * Data class representing encrypted proxy credentials.
 * 
 * Used by SecurityManager to store and retrieve encrypted
 * proxy usernames and passwords.
 */
data class EncryptedCredentials(
    val username: String? = null,
    val password: String? = null
)
