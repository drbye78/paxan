package com.peasyproxy.app.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyFactory
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Security manager for encrypting sensitive data using Android Keystore.
 * 
 * Features:
 * - Hardware-backed encryption when available
 * - AES-256-GCM for authenticated encryption
 * - Automatic key generation and storage
 * - Proxy credential encryption/decryption
 * - Database passphrase generation
 */
class SecurityManager(private val context: Context) {
    
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply {
        load(null)
    }
    
    private val masterKeyName = "peasyproxy_master_key"
    
    // GCM parameters
    companion object {
        private const val GCM_IV_LENGTH = 12 // bytes
        private const val GCM_TAG_LENGTH = 128 // bits
        private const val ENCRYPTION_BUFFER_SIZE = 1024
    }
    
    init {
        ensureMasterKeyExists()
    }
    
    /**
     * Ensures the master encryption key exists in the Keystore.
     * If not, generates a new AES-256 key.
     */
    private fun ensureMasterKeyExists() {
        if (!keyStore.containsAlias(masterKeyName)) {
            generateMasterKey()
        }
    }
    
    /**
     * Generates a new AES-256-GCM key in the Android Keystore.
     */
    private fun generateMasterKey() {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )
        
        val spec = KeyGenParameterSpec.Builder(
            masterKeyName,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false)
            .setRandomizedEncryptionRequired(true)
            .build()
        
        keyGenerator.init(spec)
        keyGenerator.generateKey()
    }
    
    /**
     * Retrieves the master key from the Keystore.
     */
    private fun getMasterKey(): SecretKey {
        return (keyStore.getEntry(masterKeyName, null) as KeyStore.SecretKeyEntry).secretKey
    }
    
    /**
     * Encrypts plaintext using AES-256-GCM.
     * 
     * @param plaintext The string to encrypt
     * @return Base64-encoded ciphertext (IV + encrypted data)
     * @throws EncryptionException if encryption fails
     */
    fun encrypt(plaintext: String): String {
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, getMasterKey())
            
            val iv = cipher.iv
            require(iv.size == GCM_IV_LENGTH) { "Invalid IV length: ${iv.size}" }
            
            val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
            
            // Combine IV and ciphertext for storage
            val combined = ByteArray(iv.size + ciphertext.size)
            System.arraycopy(iv, 0, combined, 0, iv.size)
            System.arraycopy(ciphertext, 0, combined, iv.size, ciphertext.size)
            
            Base64.encodeToString(combined, Base64.NO_WRAP)
        } catch (e: Exception) {
            throw EncryptionException("Failed to encrypt data", e)
        }
    }
    
    /**
     * Decrypts ciphertext using AES-256-GCM.
     * 
     * @param ciphertext Base64-encoded ciphertext (IV + encrypted data)
     * @return Decrypted plaintext string
     * @throws EncryptionException if decryption fails
     */
    fun decrypt(ciphertext: String): String {
        return try {
            val combined = Base64.decode(ciphertext, Base64.NO_WRAP)
            
            require(combined.size > GCM_IV_LENGTH) { "Ciphertext too short" }
            
            // Extract IV and ciphertext
            val iv = combined.copyOf(GCM_IV_LENGTH)
            val actualCiphertext = combined.copyOfRange(GCM_IV_LENGTH, combined.size)
            
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, getMasterKey(), spec)
            
            val plaintext = cipher.doFinal(actualCiphertext)
            String(plaintext, Charsets.UTF_8)
        } catch (e: Exception) {
            throw EncryptionException("Failed to decrypt data", e)
        }
    }
    
    /**
     * Generates a deterministic database passphrase from the master key
     * using HKDF-SHA256. This ensures the same passphrase is used across
     * app restarts without relying on non-deterministic AES/GCM encryption.
     */
    fun getDatabasePassphrase(): ByteArray {
        return deriveHkdfKey(
            masterKey = getMasterKey(),
            salt = "peasyproxy_db_v1".toByteArray(),
            info = "sqlcipher_key".toByteArray(),
            keyLength = 32
        )
    }

    /**
     * Derives a key using HKDF-SHA256 (RFC 5869).
     *
     * @param masterKey The input keying material (master key from Keystore)
     * @param salt Optional salt value (non-secret)
     * @param info Optional context and application specific information
     * @param keyLength Desired output key length in bytes
     * @return Derived key of the requested length
     */
    private fun deriveHkdfKey(
        masterKey: SecretKey,
        salt: ByteArray,
        info: ByteArray,
        keyLength: Int
    ): ByteArray {
        // HKDF-Extract: PRK = HMAC-SHA256(salt, masterKey)
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(salt, "HmacSHA256"))
        val prk = mac.doFinal(masterKey.encoded)

        // HKDF-Expand: T = HMAC-SHA256(PRK, T_prev || info || counter)
        val okm = ByteArray(keyLength)
        var t = ByteArray(0)
        var counter = 1
        var offset = 0
        while (offset < keyLength) {
            mac.init(SecretKeySpec(prk, "HmacSHA256"))
            mac.update(t)
            mac.update(info)
            mac.update(counter.toByte())
            t = mac.doFinal()
            val copyLen = minOf(t.size, keyLength - offset)
            System.arraycopy(t, 0, okm, offset, copyLen)
            offset += copyLen
            counter++
        }
        return okm
    }

    private fun generateFallbackPassphrase(): String {
        val prefs = context.getSharedPreferences("security_prefs", Context.MODE_PRIVATE)
        val existingKey = prefs.getString("fallback_passphrase", null)
        if (existingKey != null) {
            return existingKey
        }
        
        // Generate new random passphrase
        val random = java.security.SecureRandom()
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        val passphrase = Base64.encodeToString(bytes, Base64.NO_WRAP)
        
        prefs.edit().putString("fallback_passphrase", passphrase).apply()
        return passphrase
    }
    
    /**
     * Encrypts proxy credentials.
     * 
     * @param username Proxy username (nullable)
     * @param password Proxy password (nullable)
     * @return Encrypted credentials object
     */
    fun encryptProxyCredentials(username: String?, password: String?): EncryptedCredentials {
        return EncryptedCredentials(
            username = username?.let { encrypt(it) },
            password = password?.let { encrypt(it) }
        )
    }
    
    /**
     * Decrypts proxy credentials.
     * 
     * @param encrypted The encrypted credentials object
     * @return Pair of (username, password), both nullable
     */
    fun decryptProxyCredentials(encrypted: EncryptedCredentials): Pair<String?, String?> {
        return Pair(
            first = encrypted.username?.let { 
                try { decrypt(it) } catch (e: EncryptionException) { null }
            },
            second = encrypted.password?.let { 
                try { decrypt(it) } catch (e: EncryptionException) { null }
            }
        )
    }
    
    /**
     * Checks if hardware-backed keystore is available by querying
     * actual KeyInfo from the Keystore entry.
     */
    fun isHardwareBacked(): Boolean {
        return try {
            val entry = keyStore.getEntry(masterKeyName, null)
            val secretKey = (entry as KeyStore.SecretKeyEntry).secretKey
            val factory = KeyFactory.getInstance(secretKey.algorithm, "AndroidKeyStore")
            val keyInfo = factory.getKeySpec(secretKey, KeyInfo::class.java)
            keyInfo.isInsideSecureHardware
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * Deletes the master key. Use with caution - this will make all 
     * previously encrypted data unrecoverable.
     */
    fun deleteMasterKey() {
        keyStore.deleteEntry(masterKeyName)
    }
}

/**
 * Exception thrown when encryption or decryption operations fail.
 */
class EncryptionException(message: String, cause: Throwable? = null) : Exception(message, cause)
