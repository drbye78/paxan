package com.peasyproxy.app.ui.screens.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.peasyproxy.app.domain.model.VibrationPattern

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationSettingsScreen(
    onNavigateBack: () -> Unit,
    viewModel: NotificationSettingsViewModel = hiltViewModel()
) {
    val notificationPrefs by viewModel.notificationPreferences.collectAsState()
    var showVibrationDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notification Settings") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    TextButton(onClick = { viewModel.resetToDefaults() }) {
                        Text("Reset")
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
        ) {
            // Connection Notifications Section
            Text(
                text = "Connection Notifications",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
            )

            NotificationSwitchSetting(
                title = "Connection Status",
                description = "Show notifications when VPN connects or disconnects",
                checked = notificationPrefs.connectionNotifications,
                onCheckedChange = { viewModel.updateConnectionNotifications(it) }
            )

            NotificationSwitchSetting(
                title = "Error Alerts",
                description = "Show notifications for connection errors and failures",
                checked = notificationPrefs.errorAlerts,
                onCheckedChange = { viewModel.updateErrorAlerts(it) }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            // Sound & Vibration Section
            Text(
                text = "Sound & Vibration",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
            )

            NotificationSwitchSetting(
                title = "Sound",
                description = "Play sound for notifications",
                checked = notificationPrefs.soundEnabled,
                onCheckedChange = { viewModel.updateSoundEnabled(it) }
            )

            NotificationSwitchSetting(
                title = "Vibration",
                description = "Vibrate for notifications",
                checked = notificationPrefs.vibrationEnabled,
                onCheckedChange = { viewModel.updateVibrationEnabled(it) }
            )

            NotificationClickableSetting(
                title = "Vibration Pattern",
                description = getVibrationPatternDisplayName(notificationPrefs.vibrationPattern),
                onClick = { showVibrationDialog = true }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            // Preview Section
            Text(
                text = "Preview",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
            )

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Sample Notification",
                        style = MaterialTheme.typography.titleSmall
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "VPN Connected",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        text = "Connected to proxy.example.com:8080",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }

    if (showVibrationDialog) {
        VibrationPatternDialog(
            currentPattern = notificationPrefs.vibrationPattern,
            patterns = viewModel.availableVibrationPatterns,
            onPatternSelected = { pattern ->
                viewModel.updateVibrationPattern(pattern)
                showVibrationDialog = false
            },
            onDismiss = { showVibrationDialog = false }
        )
    }
}

@Composable
private fun NotificationSwitchSetting(
    title: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}

@Composable
private fun NotificationClickableSetting(
    title: String,
    description: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun VibrationPatternDialog(
    currentPattern: LongArray,
    patterns: List<VibrationPattern>,
    onPatternSelected: (VibrationPattern) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Vibration Pattern") },
        text = {
            Column {
                patterns.forEach { pattern ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPatternSelected(pattern) }
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = pattern.pattern.contentEquals(currentPattern),
                            onClick = { onPatternSelected(pattern) }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = pattern.displayName,
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

private fun getVibrationPatternDisplayName(pattern: LongArray): String {
    return VibrationPattern.entries.find { it.pattern.contentEquals(pattern) }?.displayName 
        ?: "Default"
}
