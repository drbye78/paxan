package com.peasyproxy.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.TrustLevel
import com.peasyproxy.app.domain.usecase.ReputationCalculator

@Composable
fun ProxyItem(
    proxy: Proxy,
    onClick: () -> Unit,
    onFavoriteClick: () -> Unit,
    isSelected: Boolean = false,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) 
                MaterialTheme.colorScheme.primaryContainer 
            else 
                MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(getTrustLevelColor(proxy.trustLevel)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = proxy.countryCode ?: "XX",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = proxy.displayName,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = proxy.protocol.name,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    if (proxy.country != null) {
                        Text(
                            text = proxy.country,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Column(
                horizontalAlignment = Alignment.End
            ) {
                LatencyIndicator(latency = proxy.latency)
                Spacer(modifier = Modifier.height(4.dp))
                TrustBadge(trustLevel = proxy.trustLevel, score = proxy.trustScore)
            }

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(onClick = onFavoriteClick) {
                Icon(
                    imageVector = if (proxy.isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription = "Favorite",
                    tint = if (proxy.isFavorite) Color.Red else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun LatencyIndicator(
    latency: Long,
    modifier: Modifier = Modifier
) {
    val quality = when {
        latency < 100 -> "Excellent"
        latency < 300 -> "Good"
        latency < 1000 -> "Fair"
        else -> "Poor"
    }

    val color = when {
        latency < 100 -> Color(0xFF4CAF50)
        latency < 300 -> Color(0xFF8BC34A)
        latency < 1000 -> Color(0xFFFFC107)
        else -> Color(0xFFF44336)
    }

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
        Text(
            text = "${latency}ms",
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}

@Composable
fun TrustBadge(
    trustLevel: TrustLevel,
    score: Int,
    modifier: Modifier = Modifier
) {
    val (color, text) = when (trustLevel) {
        TrustLevel.TRUSTED -> Color(0xFF4CAF50) to "Trusted"
        TrustLevel.UNVERIFIED -> Color(0xFFFFC107) to "Unverified"
        TrustLevel.RISKY -> Color(0xFFF44336) to "Risky"
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(4.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Text(
            text = "$text ($score)",
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
fun getTrustLevelColor(trustLevel: TrustLevel): Color {
    return when (trustLevel) {
        TrustLevel.TRUSTED -> Color(0xFF4CAF50)
        TrustLevel.UNVERIFIED -> Color(0xFFFFC107)
        TrustLevel.RISKY -> Color(0xFFF44336)
    }
}

@Composable
fun ConnectionStatusCard(
    isConnected: Boolean,
    proxy: Proxy?,
    onConnectClick: () -> Unit,
    onDisconnectClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isConnected)
                MaterialTheme.colorScheme.primaryContainer
            else
                MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = if (isConnected) "Connected" else "Disconnected",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = if (isConnected)
                    MaterialTheme.colorScheme.onPrimaryContainer
                else
                    MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (proxy != null && isConnected) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = proxy.displayName,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                )
                
                if (proxy.country != null) {
                    Text(
                        text = proxy.country,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.6f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = if (isConnected) onDisconnectClick else onConnectClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isConnected)
                        MaterialTheme.colorScheme.error
                    else
                        MaterialTheme.colorScheme.primary
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = if (isConnected) "Disconnect" else "Connect",
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}