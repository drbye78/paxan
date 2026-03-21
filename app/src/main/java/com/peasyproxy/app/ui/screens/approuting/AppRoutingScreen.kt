package com.peasyproxy.app.ui.screens.approuting

import android.content.pm.PackageManager
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.peasyproxy.app.domain.model.SplitTunnelMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppRoutingScreen(
    onNavigateBack: () -> Unit,
    viewModel: AppRoutingViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val routingConfig by viewModel.routingConfig.collectAsStateWithLifecycle()
    val installedApps by viewModel.installedApps.collectAsStateWithLifecycle()
    val mode by viewModel.mode.collectAsStateWithLifecycle()

    val packageManager = context.packageManager
    val apps = remember {
        packageManager.getInstalledApplications(PackageManager.GET_META_DATA)
    }

    LaunchedEffect(apps) {
        viewModel.loadInstalledApps(apps)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("App Routing") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.clearSelection() }) {
                        Icon(Icons.Default.Clear, contentDescription = "Clear")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Routing Mode",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = mode == SplitTunnelMode.INCLUDE,
                            onClick = { viewModel.setMode(SplitTunnelMode.INCLUDE) },
                            label = { Text("Include") },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = mode == SplitTunnelMode.EXCLUDE,
                            onClick = { viewModel.setMode(SplitTunnelMode.EXCLUDE) },
                            label = { Text("Exclude") },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = mode == SplitTunnelMode.BYPASS,
                            onClick = { viewModel.setMode(SplitTunnelMode.BYPASS) },
                            label = { Text("Bypass") },
                            modifier = Modifier.weight(1f)
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Text(
                        text = when (mode) {
                            SplitTunnelMode.INCLUDE -> "Only selected apps will use the VPN tunnel. Other apps will use direct connection."
                            SplitTunnelMode.EXCLUDE -> "Selected apps will NOT use the VPN tunnel. They will use direct connection."
                            SplitTunnelMode.BYPASS -> "All apps use VPN except selected apps. Selected apps bypass the VPN."
                            SplitTunnelMode.DISABLED -> "Split tunneling is disabled. All traffic goes through VPN."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Text(
                text = when (mode) {
                    SplitTunnelMode.INCLUDE,
                    SplitTunnelMode.BYPASS -> "${routingConfig.includedApps.size} apps included"
                    SplitTunnelMode.EXCLUDE -> "${routingConfig.excludedApps.size} apps excluded"
                    SplitTunnelMode.DISABLED -> "Split tunnel disabled"
                },
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(installedApps, key = { it.packageName }) { app ->
                    AppItem(
                        app = app,
                        onClick = { viewModel.toggleApp(app.packageName) }
                    )
                }
            }
        }
    }
}

@Composable
fun AppItem(
    app: AppInfo,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = app.isSelected,
                onCheckedChange = { onClick() }
            )
            
            Spacer(modifier = Modifier.width(8.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = app.appName,
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = app.packageName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            if (app.isSystemApp) {
                Icon(
                    imageVector = Icons.Default.Android,
                    contentDescription = "System app",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}