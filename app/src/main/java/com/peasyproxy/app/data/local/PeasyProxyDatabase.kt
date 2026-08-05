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
 * Room database for proxy data.
 * Note: This database uses plaintext SQLite. Field-level encryption is handled
 * at the repository/service layer via SecurityManager for sensitive fields.
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
         * No-op migration: schema unchanged, version bump only.
         */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // No schema changes
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
