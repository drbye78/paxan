package com.peasyproxy.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import java.text.DecimalFormat

@Composable
fun SpeedGraph(
    uploadSpeed: Long,
    downloadSpeed: Long,
    maxSpeed: Long = 10_000_000L, // 10 MB/s default max
    modifier: Modifier = Modifier
) {
    val downloadColor = Color(0xFF2196F3)
    val uploadColor = Color(0xFFFF9800)
    val gridColor = Color(0xFFE0E0E0)
    
    val downloadPoints = remember { mutableStateListOf(0f) }
    val uploadPoints = remember { mutableStateListOf(0f) }
    
    // Update points every second
    LaunchedEffect(uploadSpeed, downloadSpeed) {
        val downloadRatio = (downloadSpeed.toFloat() / maxSpeed).coerceIn(0f, 1f)
        val uploadRatio = (uploadSpeed.toFloat() / maxSpeed).coerceIn(0f, 1f)
        
        if (downloadPoints.size >= 60) {
            downloadPoints.removeAt(0)
        }
        if (uploadPoints.size >= 60) {
            uploadPoints.removeAt(0)
        }
        
        downloadPoints.add(downloadRatio)
        uploadPoints.add(uploadRatio)
    }

    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            SpeedIndicator(
                label = "Download",
                speed = downloadSpeed,
                color = downloadColor
            )
            SpeedIndicator(
                label = "Upload",
                speed = uploadSpeed,
                color = uploadColor
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp)
        ) {
            val width = size.width
            val height = size.height
            
            // Draw grid lines
            for (i in 0..4) {
                val y = height * i / 4
                drawLine(
                    color = gridColor,
                    start = Offset(0f, y),
                    end = Offset(width, y),
                    strokeWidth = 1f
                )
            }
            
            // Draw download line
            if (downloadPoints.size > 1) {
                val downloadPath = Path()
                val stepX = width / (downloadPoints.size - 1).coerceAtLeast(1)
                
                downloadPoints.forEachIndexed { index, ratio ->
                    val x = index * stepX
                    val y = height * (1 - ratio)
                    if (index == 0) {
                        downloadPath.moveTo(x, y)
                    } else {
                        downloadPath.lineTo(x, y)
                    }
                }
                
                drawPath(
                    path = downloadPath,
                    color = downloadColor,
                    style = Stroke(width = 3f, cap = StrokeCap.Round)
                )
            }
            
            // Draw upload line
            if (uploadPoints.size > 1) {
                val uploadPath = Path()
                val stepX = width / (uploadPoints.size - 1).coerceAtLeast(1)
                
                uploadPoints.forEachIndexed { index, ratio ->
                    val x = index * stepX
                    val y = height * (1 - ratio)
                    if (index == 0) {
                        uploadPath.moveTo(x, y)
                    } else {
                        uploadPath.lineTo(x, y)
                    }
                }
                
                drawPath(
                    path = uploadPath,
                    color = uploadColor,
                    style = Stroke(width = 3f, cap = StrokeCap.Round)
                )
            }
        }
        
        // Legend
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            LegendItem(color = downloadColor, label = "Download")
            Spacer(modifier = Modifier.width(24.dp))
            LegendItem(color = uploadColor, label = "Upload")
        }
    }
}

@Composable
private fun SpeedIndicator(
    label: String,
    speed: Long,
    color: Color
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = formatSpeed(speed),
            style = MaterialTheme.typography.titleMedium,
            color = color
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Canvas(modifier = Modifier.size(12.dp)) {
            drawCircle(color = color)
        }
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall
        )
    }
}

fun formatSpeed(bytesPerSecond: Long): String {
    return when {
        bytesPerSecond < 1024 -> "$bytesPerSecond B/s"
        bytesPerSecond < 1024 * 1024 -> String.format("%.1f KB/s", bytesPerSecond / 1024.0)
        bytesPerSecond < 1024 * 1024 * 1024 -> String.format("%.1f MB/s", bytesPerSecond / (1024.0 * 1024.0))
        else -> String.format("%.1f GB/s", bytesPerSecond / (1024.0 * 1024.0 * 1024.0))
    }
}

@Composable
fun ConnectionQualityIndicator(
    quality: ConnectionQuality,
    latency: Long,
    modifier: Modifier = Modifier
) {
    val (color, label) = when (quality) {
        ConnectionQuality.EXCELLENT -> Color(0xFF4CAF50) to "Excellent"
        ConnectionQuality.GOOD -> Color(0xFF8BC34A) to "Good"
        ConnectionQuality.FAIR -> Color(0xFFFFC107) to "Fair"
        ConnectionQuality.POOR -> Color(0xFFF44336) to "Poor"
        ConnectionQuality.DISCONNECTED -> Color(0xFF9E9E9E) to "Disconnected"
    }

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Canvas(modifier = Modifier.size(12.dp)) {
            drawCircle(color = color)
        }
        Text(
            text = if (quality != ConnectionQuality.DISCONNECTED) "$label (${latency}ms)" else label,
            style = MaterialTheme.typography.labelMedium,
            color = color
        )
    }
}

enum class ConnectionQuality {
    EXCELLENT,
    GOOD,
    FAIR,
    POOR,
    DISCONNECTED
}