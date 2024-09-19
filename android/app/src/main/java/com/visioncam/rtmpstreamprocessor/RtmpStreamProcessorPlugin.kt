package com.visioncam.rtmpstreamprocessor

import android.content.Context
import android.util.Log
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.FFmpegSession
import com.arthenica.ffmpegkit.ReturnCode
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

class RtmpStreamProcessorPlugin(private val context: Context, proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {
    private val TAG = "RtmpStreamProcessorPlugin"
    private var ffmpegSession: FFmpegSession? = null
    private val isStreaming = AtomicBoolean(false)
    private var rtmpUrl: String? = null
    private var frameCount = 0
    private lateinit var tempFile: File
    private lateinit var tempFileOutputStream: FileOutputStream

    init {
        Log.d(TAG, "RtmpStreamProcessorPlugin initialized with options: ${options?.toString()}")
    }

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        if (arguments == null) {
            return null
        }

        val url = arguments["url"] as? String
        if (url != null && url != rtmpUrl) {
            rtmpUrl = url
            stopStreaming()
            startStreaming(frame)
        }

        if (isStreaming.get()) {
            sendFrameToFFmpeg(frame)
        }

        return mapOf(
            "isStreaming" to isStreaming.get(),
            "rtmpUrl" to rtmpUrl,
            "frameCount" to frameCount
        )
    }

    private fun startStreaming(frame: Frame) {
        if (isStreaming.get()) {
            return
        }

        isStreaming.set(true)
        frameCount = 0

        // Create a temporary file to store frames
        tempFile = File.createTempFile("stream", ".yuv", context.cacheDir)
        tempFileOutputStream = FileOutputStream(tempFile)

        // Start FFmpeg process
        val ffmpegCommand = arrayOf(
            "-f", "rawvideo",
            "-vcodec", "rawvideo",
            "-s", "${frame.width}x${frame.height}",
            "-pix_fmt", "yuv420p",
            "-r", "30",
            "-i", tempFile.absolutePath,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-f", "flv",
            rtmpUrl
        )

        FFmpegKit.executeAsync(ffmpegCommand.joinToString(" ")) { session ->
            when {
                ReturnCode.isSuccess(session.returnCode) -> {
                    Log.d(TAG, "FFmpeg process exited successfully")
                }
                ReturnCode.isCancel(session.returnCode) -> {
                    Log.w(TAG, "FFmpeg process was cancelled")
                }
                else -> {
                    Log.e(TAG, "FFmpeg process failed with state ${session.state} and rc ${session.returnCode}. Error: ${session.failStackTrace}")
                }
            }
            stopStreaming()
        }
    }

    private fun stopStreaming() {
        if (!isStreaming.get()) {
            return
        }

        isStreaming.set(false)
        ffmpegSession?.cancel()
        tempFileOutputStream.close()
        tempFile.delete()
    }

    private fun sendFrameToFFmpeg(frame: Frame) {
        frameCount++

        // Write frame data to temporary file
        frame.image.planes.forEach { plane ->
            val buffer = plane.buffer
            val bytes = ByteArray(buffer.remaining())
            buffer.get(bytes)
            tempFileOutputStream.write(bytes)
        }
        tempFileOutputStream.flush()
    }
}
