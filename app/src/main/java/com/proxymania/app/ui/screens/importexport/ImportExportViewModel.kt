package com.proxymania.app.ui.screens.importexport

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.proxymania.app.data.repository.ProxyRepository
import com.proxymania.app.domain.model.Proxy
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ImportExportViewModel @Inject constructor(
    private val proxyRepository: ProxyRepository
) : ViewModel() {

    private val _exportData = MutableStateFlow<String?>(null)
    val exportData: StateFlow<String?> = _exportData.asStateFlow()

    private val _importStatus = MutableStateFlow<ImportStatus>(ImportStatus.Idle)
    val importStatus: StateFlow<ImportStatus> = _importStatus.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()

    fun exportProxies() {
        viewModelScope.launch {
            _isLoading.value = true
            proxyRepository.exportProxies().first().let { proxies ->
                val json = gson.toJson(proxies)
                _exportData.value = json
            }
            _isLoading.value = false
        }
    }

    fun importProxies(json: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val proxies = gson.fromJson(json, Array<Proxy>::class.java).toList()
                proxyRepository.importProxies(proxies)
                _importStatus.value = ImportStatus.Success(proxies.size)
            } catch (e: Exception) {
                _importStatus.value = ImportStatus.Error(e.message ?: "Import failed")
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun importProxiesFromUri(uri: Uri, content: String) {
        importProxies(content)
    }

    fun clearExportData() {
        _exportData.value = null
    }

    fun resetImportStatus() {
        _importStatus.value = ImportStatus.Idle
    }

    fun clearAllProxies() {
        viewModelScope.launch {
            proxyRepository.clearAllProxies()
        }
    }
}

sealed class ImportStatus {
    object Idle : ImportStatus()
    data class Success(val count: Int) : ImportStatus()
    data class Error(val message: String) : ImportStatus()
}