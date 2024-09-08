package com.visioncam.rtmpstreamprocessor

import android.util.Log
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

import com.arthenica.ffmpegkit.FFprobeKit
import com.arthenica.ffmpegkit.FFprobeSession
import com.arthenica.ffmpegkit.FFmpegKitConfig
import org.json.JSONObject

class RtmpStreamProcessorPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?): FrameProcessorPlugin() {
  private val TAG = "RtmpStreamProcessorPlugin"
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

      val url = arguments["url"] as String?
      if (url != null) {
        // getVideoDuration(url)
        try{
          val duration = getVideoDuration(url)
          Log.d(TAG, "Video duration: $duration")
           return hashMapOf<String, Any>(
          "example_str" to duration,
          "example_bool" to false,
          "example_double" to 6.7,
          "example_array" to arrayListOf<Any>(
              "Good bye",
              false,
              21.37
          )
      )
        } catch (e: Exception) {
          Log.e(TAG, "Error while executing FFprobe command: $e")
        }
      }
      
      return hashMapOf<String, Any>(
          "example_str" to ffmpegVersion,
          "example_bool" to false,
          "example_double" to 6.7,
          "example_array" to arrayListOf<Any>(
              "Good bye",
              false,
              21.37
          )
      )
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
  // private fun startRtmpStream(frame: Frame, rtmpUrl: String) {
  //   val ffmpegCommand = "-f rawvideo -pix_fmt rgba -s ${frame.image.width}x${frame.image.height} " +
  //                       "-r 30 -i - -c:v libx264 -preset ultrafast -f flv $rtmpUrl"
  //   FFmpegKit.executeAsync(ffmpegCommand) { session ->
  //       if (ReturnCode.isSuccess(session.returnCode)) {
  //           Log.d(TAG, "RTMP stream started successfully")
  //       } else {
  //           Log.e(TAG, "Error starting RTMP stream: ${session.failStackTrace}")
  //       }
  //   }
// }
}