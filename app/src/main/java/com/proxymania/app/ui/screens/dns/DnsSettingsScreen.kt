package com.proxymania.app.ui.screens.dns

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DnsSettingsScreen(
    onNavigateBack: () -> Unit,
    viewModel: DnsSettingsViewModel = hiltViewModel()
) {
    val dnsConfig by viewModel.dnsConfig.collectAsStateWithLifecycle()

    var primaryDns by remember { mutableStateOf(dnsConfig.primaryDns) }
    var secondaryDns by remember { mutableStateOf(dnsConfig.secondaryDns) }

    LaunchedEffect(dnsConfig) {
        primaryDns = dnsConfig.primaryDns
        secondaryDns = dnsConfig.secondaryDns
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("DNS Settings") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                text = "Custom DNS",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = "Use custom DNS servers instead of system DNS",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Switch(
                            checked = dnsConfig.customDnsEnabled,
                            onCheckedChange = { viewModel.updateCustomDnsEnabled(it) }
                        )
                    }
                }
            }

            if (dnsConfig.customDnsEnabled) {
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "DNS Servers",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                OutlinedTextField(
                    value = primaryDns,
                    onValueChange = { 
                        primaryDns = it
                        viewModel.updatePrimaryDns(it)
                    },
                    label = { Text("Primary DNS") },
                    placeholder = { Text("8.8.8.8") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = secondaryDns,
                    onValueChange = { 
                        secondaryDns = it
                        viewModel.updateSecondaryDns(it)
                    },
                    label = { Text("Secondary DNS") },
                    placeholder = { Text("8.8.4.4") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Recommended DNS",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Google: 8.8.8.8 / 8.8.4.4",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            text = "Cloudflare: 1.1.1.1 / 1.0.0.1",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            text = "Quad9: 9.9.9.9 / 149.112.112.112",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "DNS Leak Protection",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                    Text(
                        text = "All DNS queries are forced through the VPN tunnel when connected. This prevents DNS leaks that could reveal your real IP address.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }
    }
}