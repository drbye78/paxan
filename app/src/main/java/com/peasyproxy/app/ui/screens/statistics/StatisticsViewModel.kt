package com.peasyproxy.app.ui.screens.statistics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.peasyproxy.app.data.repository.ProxyRepository
import com.peasyproxy.app.data.repository.StatisticsRepository
import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.Statistics
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StatisticsViewModel @Inject constructor(
    private val statisticsRepository: StatisticsRepository,
    private val proxyRepository: ProxyRepository
) : ViewModel() {

    val statistics: StateFlow<Statistics> = statisticsRepository.getStatistics()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = Statistics()
        )

    private val _topProxies = MutableStateFlow<List<Proxy>>(emptyList())
    val topProxies: StateFlow<List<Proxy>> = _topProxies.asStateFlow()

    init {
        loadTopProxies()
    }

    private fun loadTopProxies() {
        viewModelScope.launch {
            val proxies = proxyRepository.getBestProxies(5)
            _topProxies.value = proxies
        }
    }
}