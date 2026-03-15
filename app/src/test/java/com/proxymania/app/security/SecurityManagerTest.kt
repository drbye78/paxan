package com.proxymania.app.security

import android.content.Context
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.security.KeyStore
import java.security.KeyStore.SecretKeyEntry
import javax.crypto.SecretKey

/**
 * Unit tests for SecurityManager.
 * 
 * Tests verify:
 * - Key generation and storage
 * - Encryption/decryption round-trip
 * - Credential encryption
 */
class SecurityManagerTest {

    private lateinit var securityManager: SecurityManager
    private lateinit var mockContext: Context
    private lateinit var mockKeyStore: KeyStore
    private lateinit var mockSecretKey: SecretKey

    @Before
    fun setup() {
        mockContext = mockk()
        mockKeyStore = mockk()
        mockSecretKey = mockk()

        // Mock KeyStore static methods
        mockkStatic(KeyStore::class)
        every { KeyStore.getInstance("AndroidKeyStore") } returns mockKeyStore
        every { mockKeyStore.load(null) } returns Unit
        every { mockKeyStore.containsAlias("proxymania_master_key") } returns false
        every { mockKeyStore.getEntry("proxymania_master_key", null) } returns mockk<SecretKeyEntry> {
            every { secretKey } returns mockSecretKey
        }

        // Mock SharedPreferences for fallback
        val mockPrefs = mockk<android.content.SharedPreferences>()
        every { mockPrefs.getString("fallback_passphrase", null) } returns null
        every { mockContext.getSharedPreferences("security_prefs", Context.MODE_PRIVATE) } returns mockPrefs
        every { mockPrefs.edit() } returns mockk {
            every { putString("fallback_passphrase", any()) } returns mockk {
                every { apply() } returns Unit
            }
        }

        securityManager = SecurityManager(mockContext)
    }

    @Test
    fun `encrypt and decrypt should return original text`() {
        // Given
        val plaintext = "test_password_123"
        
        // Note: This test requires actual cryptographic operations
        // In a real test environment, you would mock the Cipher
        // For now, we test the structure
        
        // When
        val ciphertext = securityManager.encrypt(plaintext)
        val decrypted = securityManager.decrypt(ciphertext)
        
        // Then
        assertEquals(plaintext, decrypted)
        assertNotEquals(plaintext, ciphertext)
    }

    @Test
    fun `encrypt should produce different ciphertext for same plaintext`() {
        // Given
        val plaintext = "test_password_123"
        
        // When
        val ciphertext1 = securityManager.encrypt(plaintext)
        val ciphertext2 = securityManager.encrypt(plaintext)
        
        // Then
        // GCM uses random IV, so ciphertext should be different each time
        assertNotEquals(ciphertext1, ciphertext2)
        
        // But both should decrypt to the same plaintext
        assertEquals(plaintext, securityManager.decrypt(ciphertext1))
        assertEquals(plaintext, securityManager.decrypt(ciphertext2))
    }

    @Test
    fun `decrypt with invalid ciphertext should throw EncryptionException`() {
        // Given
        val invalidCiphertext = "invalid_base64!!!"
        
        // When/Then
        assertThrows(EncryptionException::class.java) {
            securityManager.decrypt(invalidCiphertext)
        }
    }

    @Test
    fun `encryptProxyCredentials should encrypt username and password`() {
        // Given
        val username = "proxy_user"
        val password = "proxy_pass_123"
        
        // When
        val encrypted = securityManager.encryptProxyCredentials(username, password)
        
        // Then
        assertNotNull(encrypted.username)
        assertNotNull(encrypted.password)
        assertNotEquals(username, encrypted.username)
        assertNotEquals(password, encrypted.password)
    }

    @Test
    fun `decryptProxyCredentials should return original credentials`() {
        // Given
        val username = "proxy_user"
        val password = "proxy_pass_123"
        val encrypted = securityManager.encryptProxyCredentials(username, password)
        
        // When
        val (decryptedUsername, decryptedPassword) = securityManager.decryptProxyCredentials(encrypted)
        
        // Then
        assertEquals(username, decryptedUsername)
        assertEquals(password, decryptedPassword)
    }

    @Test
    fun `encryptProxyCredentials with null values should handle gracefully`() {
        // When
        val encrypted = securityManager.encryptProxyCredentials(null, null)
        
        // Then
        assertNull(encrypted.username)
        assertNull(encrypted.password)
    }

    @Test
    fun `decryptProxyCredentials with null values should return null`() {
        // Given
        val encrypted = EncryptedCredentials(null, null)
        
        // When
        val (username, password) = securityManager.decryptProxyCredentials(encrypted)
        
        // Then
        assertNull(username)
        assertNull(password)
    }

    @Test
    fun `getDatabasePassphrase should return consistent value`() {
        // When
        val passphrase1 = securityManager.getDatabasePassphrase()
        val passphrase2 = securityManager.getDatabasePassphrase()
        
        // Then
        assertEquals(passphrase1, passphrase2)
        assertTrue(passphrase1.isNotEmpty())
    }

    @Test
    fun `encrypt empty string should succeed`() {
        // Given
        val plaintext = ""
        
        // When
        val ciphertext = securityManager.encrypt(plaintext)
        val decrypted = securityManager.decrypt(ciphertext)
        
        // Then
        assertEquals(plaintext, decrypted)
    }

    @Test
    fun `encrypt long string should succeed`() {
        // Given
        val plaintext = "a".repeat(1000)
        
        // When
        val ciphertext = securityManager.encrypt(plaintext)
        val decrypted = securityManager.decrypt(ciphertext)
        
        // Then
        assertEquals(plaintext, decrypted)
    }

    @Test
    fun `encrypt special characters should succeed`() {
        // Given
        val plaintext = "p@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?"
        
        // When
        val ciphertext = securityManager.encrypt(plaintext)
        val decrypted = securityManager.decrypt(ciphertext)
        
        // Then
        assertEquals(plaintext, decrypted)
    }

    @Test
    fun `encrypt unicode characters should succeed`() {
        // Given
        val plaintext = "密码 🔐 パスワード"
        
        // When
        val ciphertext = securityManager.encrypt(plaintext)
        val decrypted = securityManager.decrypt(ciphertext)
        
        // Then
        assertEquals(plaintext, decrypted)
    }
}
