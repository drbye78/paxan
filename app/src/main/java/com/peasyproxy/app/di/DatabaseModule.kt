package com.peasyproxy.app.di

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase
import com.peasyproxy.app.data.local.PeasyProxyDatabase
import com.peasyproxy.app.data.local.dao.ConnectionLogDao
import com.peasyproxy.app.data.local.dao.ProxyDao
import com.peasyproxy.app.data.local.dao.StatisticsDao
import com.peasyproxy.app.security.SecurityManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(
        @ApplicationContext context: Context
    ): PeasyProxyDatabase {
        return Room.databaseBuilder(
            context,
            PeasyProxyDatabase::class.java,
            PeasyProxyDatabase.DATABASE_NAME
        )
            .addMigrations(*PeasyProxyDatabase.ALL_MIGRATIONS)
            .setJournalMode(RoomDatabase.JournalMode.WRITE_AHEAD_LOGGING)
            .build()
    }

    @Provides
    @Singleton
    fun provideSecurityManager(@ApplicationContext context: Context): SecurityManager {
        return SecurityManager(context)
    }

    @Provides
    @Singleton
    fun provideProxyDao(database: PeasyProxyDatabase): ProxyDao {
        return database.proxyDao()
    }

    @Provides
    @Singleton
    fun provideConnectionLogDao(database: PeasyProxyDatabase): ConnectionLogDao {
        return database.connectionLogDao()
    }

    @Provides
    @Singleton
    fun provideStatisticsDao(database: PeasyProxyDatabase): StatisticsDao {
        return database.statisticsDao()
    }
}
