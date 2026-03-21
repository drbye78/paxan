package com.peasyproxy.app.service

import com.peasyproxy.app.domain.model.Proxy
import com.peasyproxy.app.domain.model.ProxyProtocol
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.InetAddress
import java.nio.ByteBuffer
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PacketRouter @Inject constructor() {

    private val routeCache = mutableMapOf<String, RouteInfo>()
    
    data class RouteInfo(
        val targetHost: String,
        val targetPort: Int,
        val isDnsQuery: Boolean = false
    )

    suspend fun routePacket(packet: ByteArray): RouteInfo? = withContext(Dispatchers.IO) {
        try {
            val version = PacketParser.parseIpVersion(packet) ?: return@withContext null

            when (version) {
                4 -> routeIpv4Packet(packet)
                6 -> routeIpv6Packet(packet)
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun routeIpv4Packet(packet: ByteArray): RouteInfo? {
        if (packet.size < 20) return null

        val protocol = packet[9].toInt() and 0xFF
        val destPort = PacketParser.getDestinationPort(packet) ?: return null
        val destIp = PacketParser.getDestinationIp(packet) ?: return null

        // DNS query detection
        if (protocol == 17 && destPort == 53) {
            return parseDnsQuery(packet)
        }

        // TCP/UDP traffic
        val targetHost = destIp
        val targetPort = destPort

        // Cache route
        val routeKey = "$targetHost:$targetPort"
        if (!routeCache.containsKey(routeKey)) {
            routeCache[routeKey] = RouteInfo(targetHost, targetPort)
        }

        return routeCache[routeKey]
    }

    private fun routeIpv6Packet(packet: ByteArray): RouteInfo? {
        if (packet.size < 40) return null

        val nextHeader = packet[6].toInt() and 0xFF
        val destPort = PacketParser.getDestinationPort(packet) ?: return null

        if (nextHeader == 17 && destPort == 53) {
            return parseDnsQuery(packet)
        }

        return null
    }

    private fun parseDnsQuery(packet: ByteArray): RouteInfo? {
        // DNS queries go to DNS server - determine target from DNS query
        // This is a simplified implementation
        return RouteInfo("dns", 53, isDnsQuery = true)
    }

    fun resolveDomainToIp(domain: String): String? {
        return try {
            InetAddress.getByName(domain).hostAddress
        } catch (e: Exception) {
            null
        }
    }

    fun clearRouteCache() {
        routeCache.clear()
    }

    fun getRouteCount(): Int = routeCache.size
}

object IpPacketBuilder {

    fun buildTcpPacket(
        srcIp: String,
        dstIp: String,
        srcPort: Int,
        dstPort: Int,
        sequenceNumber: Int,
        acknowledgment: Int,
        flags: Byte,
        data: ByteArray
    ): ByteArray {
        val ipHeader = buildIpHeader(
            version = 4,
            srcIp = srcIp,
            dstIp = dstIp,
            protocol = 6,
            totalLength = 20 + 20 + data.size
        )

        val tcpHeader = buildTcpHeader(
            srcPort = srcPort,
            dstPort = dstPort,
            sequenceNumber = sequenceNumber,
            acknowledgment = acknowledgment,
            flags = flags,
            data = data
        )

        return ipHeader + tcpHeader + data
    }

    fun buildUdpPacket(
        srcIp: String,
        dstIp: String,
        srcPort: Int,
        dstPort: Int,
        payload: ByteArray
    ): ByteArray {
        val ipHeader = buildIpHeader(
            version = 4,
            srcIp = srcIp,
            dstIp = dstIp,
            protocol = 17,
            totalLength = 20 + 8 + payload.size
        )

        val udpHeader = buildUdpHeader(
            srcPort = srcPort,
            dstPort = dstPort,
            length = 8 + payload.size
        )

        return ipHeader + udpHeader + payload
    }

    private fun buildIpHeader(
        version: Int,
        srcIp: String,
        dstIp: String,
        protocol: Int,
        totalLength: Int
    ): ByteArray {
        val header = ByteArray(20)
        
        // Version (4 bits) + IHL (4 bits)
        header[0] = ((version shl 4) or 5).toByte()
        
        // Type of Service
        header[1] = 0
        
        // Total Length
        header[2] = (totalLength shr 8).toByte()
        header[3] = (totalLength and 0xFF).toByte()
        
        // Identification
        header[4] = 0
        header[5] = 0
        
        // Flags (3 bits) + Fragment Offset (13 bits)
        header[6] = 0x40.toByte() // Don't fragment
        header[7] = 0
        
        // TTL
        header[8] = 64
        
        // Protocol
        header[9] = protocol.toByte()
        
        // Header Checksum (placeholder)
        header[10] = 0
        header[11] = 0
        
        // Source IP
        val srcParts = srcIp.split(".")
        srcParts.forEachIndexed { index, part ->
            header[12 + index] = part.toInt().toByte()
        }
        
        // Destination IP
        val dstParts = dstIp.split(".")
        dstParts.forEachIndexed { index, part ->
            header[16 + index] = part.toInt().toByte()
        }

        // Calculate checksum
        val checksum = calculateIpChecksum(header)
        header[10] = (checksum shr 8).toByte()
        header[11] = (checksum and 0xFF).toByte()

        return header
    }

    private fun buildTcpHeader(
        srcPort: Int,
        dstPort: Int,
        sequenceNumber: Int,
        acknowledgment: Int,
        flags: Byte,
        data: ByteArray
    ): ByteArray {
        val header = ByteArray(20)
        
        // Source Port
        header[0] = (srcPort shr 8).toByte()
        header[1] = (srcPort and 0xFF).toByte()
        
        // Destination Port
        header[2] = (dstPort shr 8).toByte()
        header[3] = (dstPort and 0xFF).toByte()
        
        // Sequence Number
        header[4] = (sequenceNumber shr 24).toByte()
        header[5] = (sequenceNumber shr 16).toByte()
        header[6] = (sequenceNumber shr 8).toByte()
        header[7] = (sequenceNumber and 0xFF).toByte()
        
        // Acknowledgment Number
        header[8] = (acknowledgment shr 24).toByte()
        header[9] = (acknowledgment shr 16).toByte()
        header[10] = (acknowledgment shr 8).toByte()
        header[11] = (acknowledgment and 0xFF).toByte()
        
        // Data Offset (5 = 20 bytes) + Flags
        header[12] = 0x50.toByte()
        header[13] = flags
        
        // Window Size
        header[14] = 0xFF.toByte()
        header[15] = 0xFF.toByte()
        
        // Checksum (placeholder)
        header[16] = 0
        header[17] = 0
        
        // Urgent Pointer
        header[18] = 0
        header[19] = 0

        return header
    }

    private fun buildUdpHeader(
        srcPort: Int,
        dstPort: Int,
        length: Int
    ): ByteArray {
        val header = ByteArray(8)
        
        header[0] = (srcPort shr 8).toByte()
        header[1] = (srcPort and 0xFF).toByte()
        
        header[2] = (dstPort shr 8).toByte()
        header[3] = (dstPort and 0xFF).toByte()
        
        header[4] = (length shr 8).toByte()
        header[5] = (length and 0xFF).toByte()
        
        header[6] = 0
        header[7] = 0

        return header
    }

    private fun calculateIpChecksum(header: ByteArray): Int {
        var sum = 0
        for (i in header.indices step 2) {
            val word = ((header[i].toInt() and 0xFF) shl 8) or (header[i + 1].toInt() and 0xFF)
            sum += word
        }
        while (sum shr 16 != 0) {
            sum = (sum and 0xFFFF) + (sum shr 16)
        }
        return sum.inv() and 0xFFFF
    }
}