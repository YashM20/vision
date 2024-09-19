import { VisionCameraProxy, Frame } from 'react-native-vision-camera'

// Assuming the plugin is exported from a module

// Initialize the plugin
const plugin = VisionCameraProxy.initFrameProcessorPlugin("startStreaming", { foo: 'bar' })
export function startStreaming(frame: Frame) {
  'worklet'
  if (plugin == null) {
    throw new Error("Failed to load Frame Processor Plugin!")
  }
  return plugin.call(frame, {
    someString: 'hello!',
    someBoolean: true,
    someNumber: 42,
    someObject: { test: 0, second: 'test' },
    someArray: ['another test', 5],
    url: "rtmp://sfo.contribute.live-video.net/app/live_user_123456789?bandwidthtest=true/live_926313112_yylAyiZVFikn2TkCguqSxeKAkGYAnN"
  }) as string[]
}