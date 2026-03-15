package com.proxymania.app.ui.screens.settings

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.proxymania.app.domain.model.AutoRotateInterval
import com.proxymania.app.domain.model.DarkMode
import com.proxymania.app.domain.model.RotationStrategy
import com.proxymania.app.domain.model.SplitTunnelMode

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun SettingsScreen(
    onNavigateToAppRouting: () -> Unit = {},
    onNavigateToDnsSettings: () -> Unit = {},
    onNavigateToImportExport: () -> Unit = {},
    onNavigateToAdvancedSettings: () -> Unit = {},
    onNavigateToNotificationSettings: () -> Unit = {},
    onNavigateToLanguageSettings: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val splitTunnelMode by viewModel.splitTunnelMode.collectAsStateWithLifecycle()
    val language by viewModel.language.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
        ) {
            SettingsSection(title = "Connection") {
                SwitchSetting(
                    title = "Auto-connect on start",
                    description = "Automatically connect when app starts",
                    checked = settings.autoConnectOnStart,
                    onCheckedChange = { viewModel.updateAutoConnectOnStart(it) }
                )

                SwitchSetting(
                    title = "Auto-reconnect",
                    description = "Automatically reconnect on disconnect",
                    checked = settings.autoReconnect,
                    onCheckedChange = { viewModel.updateAutoReconnect(it) }
                )

                SwitchSetting(
                    title = "Failover on disconnect",
                    description = "Switch to backup proxy on connection loss",
                    checked = settings.failoverEnabled,
                    onCheckedChange = { viewModel.updateFailoverEnabled(it) }
                )

                SwitchSetting(
                    title = "Kill switch",
                    description = "Block all traffic when VPN disconnects",
                    checked = settings.killSwitchEnabled,
                    onCheckedChange = { viewModel.updateKillSwitchEnabled(it) }
                )
            }

            SettingsSection(title = "Proxy Rotation") {
                SwitchSetting(
                    title = "Auto-rotate",
                    description = "Automatically change proxy periodically",
                    checked = settings.autoRotateEnabled,
                    onCheckedChange = { viewModel.updateAutoRotateEnabled(it) }
                )

                if (settings.autoRotateEnabled) {
                    DropdownSetting(
                        title = "Rotate interval",
                        options = AutoRotateInterval.entries,
                        selectedOption = AutoRotateInterval.entries.find { it.minutes == settings.autoRotateIntervalMinutes }
                            ?: AutoRotateInterval.FIFTEEN_MINUTES,
                        onOptionSelected = { viewModel.updateAutoRotateInterval(it) },
                        optionLabel = { it.display }
                    )

                    DropdownSetting(
                        title = "Rotation strategy",
                        options = RotationStrategy.entries,
                        selectedOption = settings.rotationStrategy,
                        onOptionSelected = { viewModel.updateRotationStrategy(it) },
                        optionLabel = { it.name.replace("_", " ") }
                    )
                }
            }

            SettingsSection(title = "Network") {
                SliderSetting(
                    title = "Connection timeout",
                    value = settings.connectionTimeout.toFloat(),
                    valueRange = 1000f..30000f,
                    steps = 28,
                    valueLabel = "${settings.connectionTimeout / 1000}s",
                    onValueChange = { viewModel.updateConnectionTimeout(it.toInt()) }
                )
            }

            SettingsSection(title = "Notifications") {
                SwitchSetting(
                    title = "Connection notifications",
                    description = "Show notifications on connect/disconnect",
                    checked = settings.notificationsEnabled,
                    onCheckedChange = { viewModel.updateNotificationsEnabled(it) }
                )
                NavigationSetting(
                    title = "Notification Settings",
                    description = "Sound, vibration, and alerts",
                    onClick = onNavigateToNotificationSettings
                )
            }

            SettingsSection(title = "Appearance") {
                DropdownSetting(
                    title = "Theme",
                    options = DarkMode.entries,
                    selectedOption = settings.darkMode,
                    onOptionSelected = { viewModel.updateDarkMode(it) },
                    optionLabel = { it.name }
                )
                NavigationSetting(
                    title = "Language",
                    description = getLanguageDisplayName(language),
                    onClick = onNavigateToLanguageSettings
                )
            }

            SettingsSection(title = "Split Tunneling") {
                DropdownSetting(
                    title = "Mode",
                    options = SplitTunnelMode.entries,
                    selectedOption = splitTunnelMode,
                    onOptionSelected = { viewModel.updateSplitTunnelMode(it) },
                    optionLabel = { it.name }
                )
                NavigationSetting(
                    title = "App Routing",
                    description = "Configure per-app VPN routing",
                    onClick = onNavigateToAppRouting
                )
            }

            SettingsSection(title = "Network") {
                NavigationSetting(
                    title = "DNS Settings",
                    description = "Configure custom DNS servers",
                    onClick = onNavigateToDnsSettings
                )
                
                NavigationSetting(
                    title = "Import/Export",
                    description = "Backup and restore proxies",
                    onClick = onNavigateToImportExport
                )

                NavigationSetting(
                    title = "Advanced Settings",
                    description = "Connection timeout, health check, rotation",
                    onClick = onNavigateToAdvancedSettings
                )
            }

            SettingsSection(title = "About") {
                InfoItem(title = "Version", value = "1.0.0")
                InfoItem(title = "Build", value = "1")
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun SettingsSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        content()
    }
    HorizontalDivider()
}

@Composable
fun SwitchSetting(
    title: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> DropdownSetting(
    title: String,
    options: List<T>,
    selectedOption: T,
    onOptionSelected: (T) -> Unit,
    optionLabel: (T) -> String
) {
    var expanded by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge
            )
        }

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it }
        ) {
            OutlinedTextField(
                value = optionLabel(selectedOption),
                onValueChange = {},
                readOnly = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier.menuAnchor()
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(optionLabel(option)) },
                        onClick = {
                            onOptionSelected(option)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun SliderSetting(
    title: String,
    value: Float,
    valueRange: ClosedFloatingPointRange<Float>,
    steps: Int,
    valueLabel: String,
    onValueChange: (Float) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge
            )
            Text(
                text = valueLabel,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = valueRange,
            steps = steps
        )
    }
}

@Composable
fun InfoItem(
    title: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun NavigationSetting(
    title: String,
    description: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp)
            .clickable { onClick() },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Text(
            text = ">",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.primary
        )
    }
}

private fun getLanguageDisplayName(code: String): String {
    return when (code) {
        "en" -> "English"
        "ru" -> "Русский"
        else -> "English"
    }
}