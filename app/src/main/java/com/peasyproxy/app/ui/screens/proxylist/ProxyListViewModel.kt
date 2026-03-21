package com.peasyproxy.app.ui.screens.proxylist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.peasyproxy.app.data.repository.ProxyRepository
import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.ProxyTestResult
import com.peasyproxy.app.domain.usecase.ReputationCalculator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProxyListViewModel @Inject constructor(
    private val proxyRepository: ProxyRepository,
    private val reputationCalculator: ReputationCalculator
) : ViewModel() {

    private val _proxies = MutableStateFlow<List<Proxy>>(emptyList())
    val proxies: StateFlow<List<Proxy>> = _proxies.asStateFlow()

    private val _filteredProxies = MutableStateFlow<List<Proxy>>(emptyList())
    val filteredProxies: StateFlow<List<Proxy>> = _filteredProxies.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedFilter = MutableStateFlow(ProxyFilter.ALL)
    val selectedFilter: StateFlow<ProxyFilter> = _selectedFilter.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _testingProxies = MutableStateFlow<Set<String>>(emptySet())
    val testingProxies: StateFlow<Set<String>> = _testingProxies.asStateFlow()

    init {
        loadProxies()
        observeFilters()
    }

    private fun loadProxies() {
        viewModelScope.launch {
            proxyRepository.getAllProxies().collect { proxies ->
                val rankedProxies = reputationCalculator.rankProxies(proxies)
                _proxies.value = rankedProxies
            }
        }
    }

    private fun observeFilters() {
        viewModelScope.launch {
            combine(_proxies, _searchQuery, _selectedFilter) { proxies, query, filter ->
                applyFilters(proxies, query, filter)
            }.collect { filtered ->
                _filteredProxies.value = filtered
            }
        }
    }

    private fun applyFilters(proxies: List<Proxy>, query: String, filter: ProxyFilter): List<Proxy> {
        var result = proxies

        result = when (filter) {
            ProxyFilter.ALL -> result
            ProxyFilter.FAVORITES -> result.filter { it.isFavorite }
            ProxyFilter.TRUSTED -> result.filter { it.trustLevel == com.peasyproxy.app.domain.model.TrustLevel.TRUSTED }
            ProxyFilter.RECENTLY_USED -> result.sortedByDescending { it.lastChecked }.take(20)
        }

        if (query.isNotBlank()) {
            result = result.filter {
                it.host.contains(query, ignoreCase = true) ||
                it.country?.contains(query, ignoreCase = true) == true ||
                it.displayName.contains(query, ignoreCase = true)
            }
        }

        return result
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun setFilter(filter: ProxyFilter) {
        _selectedFilter.value = filter
    }

    fun refreshProxies() {
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                val result = proxyRepository.fetchAndSaveProxies(forceRefresh = true)
                if (result.isFailure) {
                    _errorMessage.value = result.exceptionOrNull()?.message
                }
            } catch (e: Exception) {
                _errorMessage.value = e.message
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun testProxy(proxy: Proxy) {
        viewModelScope.launch {
            _testingProxies.value = _testingProxies.value + proxy.id
            try {
                val result = proxyRepository.testAndSaveProxy(proxy)
                if (!result.isReachable) {
                    _errorMessage.value = "Proxy ${proxy.displayName} is not reachable"
                }
            } catch (e: Exception) {
                _errorMessage.value = e.message
            } finally {
                _testingProxies.value = _testingProxies.value - proxy.id
            }
        }
    }

    fun toggleFavorite(proxy: Proxy) {
        viewModelScope.launch {
            proxyRepository.toggleFavorite(proxy.id, !proxy.isFavorite)
        }
    }

    fun clearError() {
        _errorMessage.value = null
    }

    fun deleteProxy(proxy: Proxy) {
        viewModelScope.launch {
            proxyRepository.deleteProxy(proxy)
        }
    }
}

enum class ProxyFilter {
    ALL,
    FAVORITES,
    TRUSTED,
    RECENTLY_USED
}