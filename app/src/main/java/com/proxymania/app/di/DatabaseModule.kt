package com.proxymania.app.di

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase
import com.proxymania.app.data.local.ProxyManiaDatabase
import com.proxymania.app.data.local.dao.ConnectionLogDao
import com.proxymania.app.data.local.dao.ProxyDao
import com.proxymania.app.data.local.dao.StatisticsDao
import com.proxymania.app.security.SecurityManager
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
    ): ProxyManiaDatabase {
        return Room.databaseBuilder(
            context,
            ProxyManiaDatabase::class.java,
            ProxyManiaDatabase.DATABASE_NAME
        )
            .addMigrations(*ProxyManiaDatabase.ALL_MIGRATIONS)
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
    fun provideProxyDao(database: ProxyManiaDatabase): ProxyDao {
        return database.proxyDao()
    }

    @Provides
    @Singleton
    fun provideConnectionLogDao(database: ProxyManiaDatabase): ConnectionLogDao {
        return database.connectionLogDao()
    }

    @Provides
    @Singleton
    fun provideStatisticsDao(database: ProxyManiaDatabase): StatisticsDao {
        return database.statisticsDao()
    }
}
