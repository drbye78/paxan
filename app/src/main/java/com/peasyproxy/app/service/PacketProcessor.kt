package com.peasyproxy.app.service

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.FileDescriptor
import java.nio.ByteBuffer
import java.util.concurrent.ConcurrentLinkedQueue
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PacketProcessor @Inject constructor() {

    private val packetQueue = ConcurrentLinkedQueue<ByteArray>()
    private val outgoingQueue = ConcurrentLinkedQueue<ByteArray>()

    private val _bytesReceived = MutableStateFlow(0L)
    val bytesReceived: StateFlow<Long> = _bytesReceived

    private val _bytesSent = MutableStateFlow(0L)
    val bytesSent: StateFlow<Long> = _bytesSent

    private val _packetsReceived = MutableStateFlow(0L)
    val packetsReceived: StateFlow<Long> = _packetsReceived

    private val _packetsSent = MutableStateFlow(0L)
    val packetsSent: StateFlow<Long> = _packetsSent

    private var isRunning = false

    fun start() {
        isRunning = true
        _bytesReceived.value = 0L
        _bytesSent.value = 0L
        _packetsReceived.value = 0L
        _packetsSent.value = 0L
    }

    fun stop() {
        isRunning = false
        packetQueue.clear()
        outgoingQueue.clear()
    }

    fun enqueueOutgoingPacket(packet: ByteArray) {
        if (isRunning) {
            outgoingQueue.offer(packet)
        }
    }

    fun enqueueIncomingPacket(packet: ByteArray) {
        if (isRunning) {
            packetQueue.offer(packet)
        }
    }

    suspend fun readFromVpnInterface(
        fileDescriptor: FileDescriptor,
        buffer: ByteBuffer,
        mtu: Int
    ): ByteArray? = withContext(Dispatchers.IO) {
        try {
            val inputStream = java.io.FileInputStream(fileDescriptor)
            val packet = ByteArray(mtu)
            val bytesRead = inputStream.read(packet)

            if (bytesRead > 0) {
                _bytesSent.value += bytesRead
                _packetsSent.value++
                packet.copyOf(bytesRead)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    suspend fun writeToVpnInterface(
        fileDescriptor: FileDescriptor,
        packet: ByteArray
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val outputStream = java.io.FileOutputStream(fileDescriptor)
            outputStream.write(packet)
            outputStream.flush()
            _bytesReceived.value += packet.size
            _packetsReceived.value++
            true
        } catch (e: Exception) {
            false
        }
    }

    fun getOutgoingPacket(): ByteArray? = outgoingQueue.poll()

    fun getIncomingPacket(): ByteArray? = packetQueue.poll()

    fun getQueuedPacketCount(): Int = packetQueue.size + outgoingQueue.size

    fun resetStats() {
        _bytesReceived.value = 0L
        _bytesSent.value = 0L
        _packetsReceived.value = 0L
        _packetsSent.value = 0L
    }

    /**
     * Clears all packet buffers.
     * Called by kill switch for immediate traffic blocking.
     */
    fun clearBuffers() {
        packetQueue.clear()
        outgoingQueue.clear()
    }

    companion object {
        const val MTU = 1500
        const val IP_HEADER_SIZE = 20
        const val IPV6_HEADER_SIZE = 40
    }
}

object PacketParser {

    fun parseIpVersion(packet: ByteArray): Int? {
        if (packet.isEmpty()) return null
        return (packet[0].toInt() shr 4) and 0x0F
    }

    fun getDestinationIp(packet: ByteArray): String? {
        if (packet.size < 20) return null

        val version = parseIpVersion(packet) ?: return null

        return when (version) {
            4 -> {
                val destBytes = packet.sliceArray(16..19)
                destBytes.joinToString(".") { (it.toInt() and 0xFF).toString() }
            }
            6 -> {
                val destBytes = packet.sliceArray(24..39)
                destBytes.joinToString(":") { 
                    String.format("%02x%02x", it, destBytes[destBytes.indexOf(it) + 1].also { })
                }
            }
            else -> null
        }
    }

    fun getSourceIp(packet: ByteArray): String? {
        if (packet.size < 20) return null

        val version = parseIpVersion(packet) ?: return null

        return when (version) {
            4 -> {
                val srcBytes = packet.sliceArray(12..15)
                srcBytes.joinToString(".") { (it.toInt() and 0xFF).toString() }
            }
            6 -> {
                val srcBytes = packet.sliceArray(8..23)
                srcBytes.joinToString(":") { String.format("%02x%02x", it, 0) }
            }
            else -> null
        }
    }

    fun getProtocol(packet: ByteArray): Int? {
        if (packet.size < 20) return null
        return packet[9].toInt() and 0xFF
    }

    fun isTcpPacket(packet: ByteArray): Boolean {
        return getProtocol(packet) == 6
    }

    fun isUdpPacket(packet: ByteArray): Boolean {
        return getProtocol(packet) == 17
    }

    fun getDestinationPort(packet: ByteArray): Int? {
        if (packet.size < 20) return null

        return when (parseIpVersion(packet)) {
            4 -> {
                if (packet.size < 24) return null
                ((packet[16].toInt() and 0xFF) shl 8) or (packet[17].toInt() and 0xFF)
            }
            6 -> {
                if (packet.size < 44) return null
                ((packet[40].toInt() and 0xFF) shl 8) or (packet[41].toInt() and 0xFF)
            }
            else -> null
        }
    }

    fun isDnsPacket(packet: ByteArray): Boolean {
        val destPort = getDestinationPort(packet) ?: return false
        return destPort == 53
    }
}