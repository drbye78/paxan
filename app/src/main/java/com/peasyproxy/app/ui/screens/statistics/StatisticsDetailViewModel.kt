package com.peasyproxy.app.ui.screens.statistics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.peasyproxy.app.data.repository.StatisticsRepository
import com.peasyproxy.app.domain.model.Statistics
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import javax.inject.Inject

@HiltViewModel
class StatisticsDetailViewModel @Inject constructor(
    private val statisticsRepository: StatisticsRepository
) : ViewModel() {

    val statistics: StateFlow<Statistics> = statisticsRepository.getStatistics()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = Statistics()
        )
}