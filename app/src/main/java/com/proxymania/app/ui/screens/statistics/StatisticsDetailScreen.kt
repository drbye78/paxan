package com.proxymania.app.ui.screens.statistics

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.proxymania.app.domain.model.Statistics
import com.proxymania.app.ui.screens.home.formatBytes
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatisticsDetailScreen(
    onNavigateBack: () -> Unit,
    viewModel: StatisticsDetailViewModel = hiltViewModel()
) {
    val statistics by viewModel.statistics.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Statistics Details") },
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Success Rate Pie Chart
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Connection Success Rate",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        PieChart(
                            successRate = statistics.successRate,
                            modifier = Modifier.size(120.dp)
                        )
                        Column(
                            modifier = Modifier.padding(start = 24.dp)
                        ) {
                            StatRow("Successful", "${statistics.successRate.toInt()}%", Color(0xFF4CAF50))
                            Spacer(modifier = Modifier.height(8.dp))
                            StatRow("Failed", "${(100 - statistics.successRate).toInt()}%", Color(0xFFF44336))
                        }
                    }
                }
            }

            // Data Usage Bar Chart
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Data Usage",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    DataUsageBar(
                        received = statistics.totalDataReceived,
                        sent = statistics.totalDataSent,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(40.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Downloaded: ${formatBytes(statistics.totalDataReceived)}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            text = "Uploaded: ${formatBytes(statistics.totalDataSent)}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            // Connection Stats
            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Summary",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    DetailStatRow("Total Connections", statistics.totalConnections.toString())
                    DetailStatRow("Average Latency", if (statistics.averageLatency > 0) "${statistics.averageLatency}ms" else "N/A")
                    DetailStatRow("Total Data", formatBytes(statistics.totalDataReceived + statistics.totalDataSent))
                }
            }
        }
    }
}

@Composable
fun StatRow(label: String, value: String, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically
    ) {
        Canvas(modifier = Modifier.size(12.dp)) {
            drawCircle(color = color)
        }
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "$label: $value",
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
fun PieChart(
    successRate: Float,
    modifier: Modifier = Modifier
) {
    val successColor = Color(0xFF4CAF50)
    val failureColor = Color(0xFFF44336)

    Canvas(modifier = modifier) {
        val strokeWidth = 20f
        val radius = (size.minDimension - strokeWidth) / 2
        val center = Offset(size.width / 2, size.height / 2)

        // Background circle
        drawCircle(
            radius = radius,
            center = center,
            color = failureColor.copy(alpha = 0.3f),
            style = Stroke(width = strokeWidth)
        )

        // Success arc
        val sweepAngle = (successRate / 100) * 360
        drawArc(
            color = successColor,
            startAngle = -90f,
            sweepAngle = sweepAngle,
            useCenter = false,
            topLeft = Offset(center.x - radius, center.y - radius),
            size = Size(radius * 2, radius * 2),
            style = Stroke(width = strokeWidth)
        )
    }
}

@Composable
fun DataUsageBar(
    received: Long,
    sent: Long,
    modifier: Modifier = Modifier
) {
    val total = received + sent
    val receivedRatio = if (total > 0) received.toFloat() / total else 0.5f

    val receivedColor = Color(0xFF2196F3)
    val sentColor = Color(0xFFFF9800)

    Canvas(modifier = modifier) {
        val barHeight = size.height
        val barWidth = size.width
        val cornerRadius = barHeight / 2

        // Sent portion (from left)
        drawRoundRect(
            color = sentColor,
            topLeft = Offset(0f, 0f),
            size = Size(barWidth * (1 - receivedRatio), barHeight),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(cornerRadius, cornerRadius)
        )

        // Received portion (from right)
        drawRoundRect(
            color = receivedColor,
            topLeft = Offset(barWidth * (1 - receivedRatio), 0f),
            size = Size(barWidth * receivedRatio, barHeight),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(cornerRadius, cornerRadius)
        )
    }
}

@Composable
fun DetailStatRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}