package com.visioncam.rtmpstreamprocessor

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry

class RtmpStreamProcessorPluginPackage : ReactPackage {
  companion object {
    fun initialize(reactContext: ReactApplicationContext) {
      // Pass the ReactApplicationContext to the RtmpStreamProcessorPlugin
      FrameProcessorPluginRegistry.addFrameProcessorPlugin("startStreaming") { proxy, options ->
        RtmpStreamProcessorPlugin(reactContext, proxy, options) // Now we pass the reactContext
      }
    }
    // init {
    //   FrameProcessorPluginRegistry.addFrameProcessorPlugin("startStreaming") { proxy, options ->
    //     RtmpStreamProcessorPlugin(proxy, options)
    //   }
    // }
  }

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    initialize(reactContext)
    return emptyList()
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}