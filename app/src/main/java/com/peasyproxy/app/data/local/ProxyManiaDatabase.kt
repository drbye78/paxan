package com.peasyproxy.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.peasyproxy.app.data.local.dao.ConnectionLogDao
import com.peasyproxy.app.data.local.dao.ProxyDao
import com.peasyproxy.app.data.local.dao.StatisticsDao
import com.peasyproxy.app.data.local.entity.ConnectionLogEntity
import com.peasyproxy.app.data.local.entity.ProxyEntity
import com.peasyproxy.app.data.local.entity.StatisticsEntity

/**
 * Main Room database for PeasyProxy.
 * 
 * Features:
 * - Proxy storage with encryption support
 * - Connection logging
 * - Statistics tracking
 * - Proper migration support
 * 
 * Security:
 * - Database encrypted with SQLCipher
 * - Credentials encrypted at rest via SecurityManager
 */
@Database(
    entities = [
        ProxyEntity::class,
        ConnectionLogEntity::class,
        StatisticsEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class PeasyProxyDatabase : RoomDatabase() {
    abstract fun proxyDao(): ProxyDao
    abstract fun connectionLogDao(): ConnectionLogDao
    abstract fun statisticsDao(): StatisticsDao

    companion object {
        const val DATABASE_NAME = "peasyproxy_db"
        
        /**
         * Migration from version 1 to 2.
         * Adds encryption support columns if needed.
         */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Version 2 doesn't require schema changes
                // Encryption is handled at the database level by SQLCipher
                // and at the field level by SecurityManager
            }
        }
        
        /**
         * All database migrations in order.
         */
        val ALL_MIGRATIONS = arrayOf(
            MIGRATION_1_2
        )
    }
}
