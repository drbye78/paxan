package com.proxymania.app.ui.screens.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.proxymania.app.domain.model.ConnectionState
import com.proxymania.app.ui.components.ConnectionStatusCard
import com.proxymania.app.ui.components.ProxyItem
import com.proxymania.app.ui.components.SpeedGraph

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToProxyList: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val connectionInfo by viewModel.connectionInfo.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val selectedProxy by viewModel.selectedProxy.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("ProxyMania") },
                actions = {
                    IconButton(onClick = { viewModel.refreshProxies() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            ConnectionStatusCard(
                isConnected = connectionInfo.state == ConnectionState.CONNECTED,
                proxy = connectionInfo.currentProxy ?: selectedProxy,
                onConnectClick = { viewModel.connect() },
                onDisconnectClick = { viewModel.disconnect() }
            )

            Spacer(modifier = Modifier.height(24.dp))

            if (connectionInfo.state == ConnectionState.CONNECTED && connectionInfo.connectedSince != null) {
                ConnectionStatsCard(
                    connectedSince = connectionInfo.connectedSince!!,
                    bytesReceived = connectionInfo.bytesReceived,
                    bytesSent = connectionInfo.bytesSent
                )
                
                Spacer(modifier = Modifier.height(24.dp))
            }

            if (selectedProxy != null && connectionInfo.state != ConnectionState.CONNECTED) {
                Text(
                    text = "Selected Proxy",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.fillMaxWidth()
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                ProxyItem(
                    proxy = selectedProxy!!,
                    onClick = { onNavigateToProxyList() },
                    onFavoriteClick = { },
                    isSelected = true
                )

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = { viewModel.quickConnect() },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isLoading
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Text("Quick Connect (Best Proxy)")
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                TextButton(
                    onClick = onNavigateToProxyList,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Choose Different Proxy")
                }
            }

            if (connectionInfo.state == ConnectionState.ERROR) {
                Spacer(modifier = Modifier.height(16.dp))
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Text(
                        text = connectionInfo.errorMessage ?: "Unknown error",
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun ConnectionStatsCard(
    connectedSince: Long,
    bytesReceived: Long,
    bytesSent: Long,
    modifier: Modifier = Modifier
) {
    var elapsedSeconds by remember { mutableLongStateOf(0L) }
    
    LaunchedEffect(connectedSince) {
        while (true) {
            elapsedSeconds = (System.currentTimeMillis() - connectedSince) / 1000
            kotlinx.coroutines.delay(1000)
        }
    }

    val hours = elapsedSeconds / 3600
    val minutes = (elapsedSeconds % 3600) / 60
    val seconds = elapsedSeconds % 60

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = "Connection Stats",
                style = MaterialTheme.typography.titleMedium
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                StatItem(
                    label = "Duration",
                    value = String.format("%02d:%02d:%02d", hours, minutes, seconds)
                )
                StatItem(
                    label = "Download",
                    value = formatBytes(bytesReceived)
                )
                StatItem(
                    label = "Upload",
                    value = formatBytes(bytesSent)
                )
            }
        }
    }
}

@Composable
fun StatItem(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

fun formatBytes(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
        else -> "${bytes / (1024 * 1024 * 1024)} GB"
    }
}