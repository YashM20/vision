package com.visioncam.rtmpstreamprocessor

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.content.Context
import android.widget.Toast
import android.util.Log
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

import com.arthenica.ffmpegkit.FFprobeKit
import com.arthenica.ffmpegkit.FFprobeSession
import com.arthenica.ffmpegkit.FFmpegKitConfig
import org.json.JSONObject

import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.FFmpegSession
import com.arthenica.ffmpegkit.ReturnCode
import java.io.File
import java.nio.ByteBuffer
import java.io.PipedInputStream
import java.io.PipedOutputStream
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.*

class RtmpStreamProcessorPlugin(private val context: Context, proxy: VisionCameraProxy, options: Map<String, Any>?): FrameProcessorPlugin() {
    private val TAG = "RtmpStreamProcessorPlugin"
    private var ffmpegSession: FFmpegSession? = null
    private val isStreaming = AtomicBoolean(false)
    private var rtmpUrl: String? = null
    private var isFFmpegInitialized = false

    private val isRecording = AtomicBoolean(false)
    private val frameList = mutableListOf<ByteArray>()
    private var recordingStartTime: Long = 0
    private val recordingDuration = 5000 // 10 seconds in milliseconds

    private var width: Int = 0
    private var height: Int = 0
    private var fps: Int = 1

    init {
      Log.d(TAG, "ExampleKotlinFrameProcessorPlugin initialized with options: " + options?.toString())
    }

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        if (arguments == null) {
            return null
        }

        val image = frame.image
        Log.d(
            TAG,
            image.width.toString() + " x " + image.height + " Image with format #" + image.format + ". Logging " + arguments.size + " parameters:"
        )

        for (key in arguments.keys) {
            val value = arguments[key]
            Log.d(TAG, "  -> " + if (value == null) "(null)" else value.toString() + " (" + value.javaClass.name + ")")
        }
        // FFmpegKitConfig.getFFmpegVersion()

        val  ffmpegVersion = FFmpegKitConfig.getFFmpegVersion()
        // showToast(ffmpegVersion)

        // return mapOf(
        //     "ffmpegVersion" to ffmpegVersion
        // )

    //   val url = arguments["url"] as String?
    //    if (url != null && url != rtmpUrl) {
    //         rtmpUrl = url
    //         stopStreaming()
    //         startStreaming(frame)
    //     }

    //     if (isStreaming.get()) {
    //         sendFrameToFFmpeg(frame)
    //     }

    //     return mapOf(
    //         "isStreaming" to isStreaming.get(),
    //         "rtmpUrl" to rtmpUrl
    //     )

      val currentTime = System.currentTimeMillis()

        if (!isRecording.get() && frameList.isEmpty()) {
            // Start recording
            isRecording.set(true)
            recordingStartTime = currentTime
            width = frame.width
            height = frame.height
            fps = 1
            Log.d(TAG, "Started recording: ${width}x${height} at $fps FPS")
            showToast("Started recording: ${width}x${height} at $fps FPS")
        }

        if (isRecording.get()) {
            // Capture frame
             showToast("Recording frame ${frameList.size}")
            val yBuffer = frame.image.planes[0].buffer
            val uBuffer = frame.image.planes[1].buffer
            val vBuffer = frame.image.planes[2].buffer

            val ySize = yBuffer.remaining()
            val uSize = uBuffer.remaining()
            val vSize = vBuffer.remaining()

            val frameData = ByteArray(ySize + uSize + vSize)
            yBuffer.get(frameData, 0, ySize)
            uBuffer.get(frameData, ySize, uSize)
            vBuffer.get(frameData, ySize + uSize, vSize)

            frameList.add(frameData)

            if (currentTime - recordingStartTime >= recordingDuration) {
                // Stop recording and save video
                showToast("Stopped recording")
                isRecording.set(false)
                saveVideo { success, path ->
                    if (success) {
                        Log.d(TAG, "Video saved at: $path")
                        showToast("Video saved at: $path")
                    } else {
                        Log.e(TAG, "Failed to save video")
                        showToast("Failed to save video")
                    }
                }
            }
        }

        return mapOf(
            "isRecording" to isRecording.get(),
            "frameCount" to frameList.size
        )

        // if (!isFFmpegInitialized) {

        //     isStreaming.set(true)
        //     return mapOf(
        //         "ffmpegVersion" to "j",
        //         "output" to output

        //     )
        // } else{
        //     return mapOf(
        //         "isStreaming" to isStreaming.get(),
        //         "rtmpUrl" to "rtmpUrl"
        //     )
        // }
    }

    private fun showToast(message: String) {
        GlobalScope.launch(Dispatchers.Main) {
            Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        }
    }

    private fun saveVideo(onVideoSaved: (Boolean, String?) -> Unit) {
        GlobalScope.launch(Dispatchers.IO) {
            val outputFile = File("/storage/emulated/0/Download/captured_video.mp4")
            val bitRate = 2000000 // 2 Mbps
            showToast("Saving video to: ${outputFile.path}")
            try {
                val mediaCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
                val mediaFormat = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height)
                mediaFormat.setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
                mediaFormat.setInteger(MediaFormat.KEY_FRAME_RATE, fps)
                mediaFormat.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
                mediaFormat.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)

                mediaCodec.configure(mediaFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
                mediaCodec.start()

                val mediaMuxer = MediaMuxer(outputFile.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
                var trackIndex = -1

                val bufferInfo = MediaCodec.BufferInfo()
                var presentationTimeUs = 0L

                frameList.forEach { frameData ->
                    val inputBufferIndex = mediaCodec.dequeueInputBuffer(-1)
                    if (inputBufferIndex >= 0) {
                        val inputBuffer = mediaCodec.getInputBuffer(inputBufferIndex)
                        inputBuffer?.clear()
                        inputBuffer?.put(frameData)
                        mediaCodec.queueInputBuffer(inputBufferIndex, 0, frameData.size, presentationTimeUs, 0)
                        presentationTimeUs += 1000000 / fps
                    }

                    var outputBufferIndex = mediaCodec.dequeueOutputBuffer(bufferInfo, 10000)
                    while (outputBufferIndex >= 0) {
                        val encodedData = mediaCodec.getOutputBuffer(outputBufferIndex)

                        if (trackIndex == -1) {
                            val newFormat = mediaCodec.getOutputFormat()
                            trackIndex = mediaMuxer.addTrack(newFormat)
                            mediaMuxer.start()
                        }

                        encodedData?.position(bufferInfo.offset)
                        encodedData?.limit(bufferInfo.offset + bufferInfo.size)

                        mediaMuxer.writeSampleData(trackIndex, encodedData!!, bufferInfo)
                        mediaCodec.releaseOutputBuffer(outputBufferIndex, false)

                        outputBufferIndex = mediaCodec.dequeueOutputBuffer(bufferInfo, 10000)
                    }
                }

                mediaCodec.stop()
                mediaCodec.release()
                mediaMuxer.stop()
                mediaMuxer.release()

                Log.d(TAG, "Video saved successfully: ${outputFile.path}")
                showToast("Video saved successfully: ${outputFile.path}")
                onVideoSaved(true, outputFile.path)
            } catch (e: Exception) {
                Log.e(TAG, "Error saving video: ${e.message}")
                onVideoSaved(false, null)
            }

            // Clear the frame list after saving the video
            frameList.clear()
        }
    }

    private fun sendFrameToFFmpeg(frame: Frame, pipedOutputStream: PipedOutputStream? = null) {
        frame.image.planes.forEach { plane ->
            pipedOutputStream?.write(plane.buffer.array())
        }
    }
  
    private fun getVideoDuration(url: String): Double {
        val ffprobeCommand = "-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $url"
        val session: FFprobeSession = FFprobeKit.execute(ffprobeCommand)
        
        if (session.returnCode.isValueSuccess) {
            val output = session.output
            return output.trim().toDouble()
        } else {
            throw Exception("FFprobe command failed: ${session.failStackTrace}")
        }
    }
}