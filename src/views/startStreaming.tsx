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
    url: "http://commondata.storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
  }) as string[]
}