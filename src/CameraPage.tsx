import * as React from 'react'
import { useRef, useState, useCallback, useMemo } from 'react'
import type { GestureResponderEvent } from 'react-native'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { PinchGestureHandlerGestureEvent } from 'react-native-gesture-handler'
import { PinchGestureHandler, TapGestureHandler } from 'react-native-gesture-handler'
import type { CameraProps, CameraRuntimeError, PhotoFile, VideoFile } from 'react-native-vision-camera'
import {
  runAsync,
  runAtTargetFps,
  useCameraDevice,
  useCameraFormat,
  useFrameProcessor,
  useLocationPermission,
  useMicrophonePermission,
  useSkiaFrameProcessor,
} from 'react-native-vision-camera'
import { Camera } from 'react-native-vision-camera'
import { CONTENT_SPACING, CONTROL_BUTTON_SIZE, MAX_ZOOM_FACTOR, SAFE_AREA_PADDING, SCREEN_HEIGHT, SCREEN_WIDTH } from './Constants'
import Reanimated, { Extrapolate, interpolate, runOnJS, runOnUI, useAnimatedGestureHandler, useAnimatedProps, useSharedValue } from 'react-native-reanimated'
import { useEffect } from 'react'
import { useIsForeground } from './hooks/useIsForeground'
import { StatusBarBlurBackground } from './views/StatusBarBlurBackground'
import { CaptureButton } from './views/CaptureButton'
// import { PressableOpacity } from 'react-native-pressable-opacity'
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import IonIcon from 'react-native-vector-icons/Ionicons'
import type { Routes } from './Routes'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/core'
import { usePreferredCameraDevice } from './hooks/usePreferredCameraDevice'
import { Skia } from '@shopify/react-native-skia'
// import { examplePlugin } from './frame-processors/ExamplePlugin'
// import { exampleKotlinSwiftPlugin } from './frame-processors/ExampleKotlinSwiftPlugin'
// import RNFS from 'react-native-fs'
import { useSharedValue as useSharedValue2, useRunOnJS } from 'react-native-worklets-core'
import { FFmpegKit } from 'ffmpeg-kit-react-native'
import { useResizePlugin } from 'vision-camera-resize-plugin'
import { startStreaming } from './views/startStreaming'
const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera)
Reanimated.addWhitelistedNativeProps({
  zoom: true,
})

const SCALE_FULL_ZOOM = 3

// Define these outside the component
const START_TIME = 'startTime';
const FRAMES = 'frames';

// For JS/TS
// import { VisionCameraProxy, Frame } from 'react-native-vision-camera'


// export function startStreaming(frame: Frame) {
//   'worklet'
//   if (plugin == null) {
//     throw new Error("Failed to load Frame Processor Plugin!")
//   }
//   return plugin.call(frame)
// }


type Props = NativeStackScreenProps<Routes, 'CameraPage'>
export function CameraPage({ navigation }: Props): React.ReactElement {
  const camera = useRef<Camera>(null)
  const { resize } = useResizePlugin()
  const [isCameraInitialized, setIsCameraInitialized] = useState(false)
  const microphone = useMicrophonePermission()
  const location = useLocationPermission()
  const zoom = useSharedValue(1)
  const isPressingButton = useSharedValue(false)

  // check if camera page is active
  const isFocussed = useIsFocused()
  const isForeground = useIsForeground()
  const isActive = isFocussed && isForeground
  const isEnabled = useSharedValue2(isActive);

  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back')
  const [enableHdr, setEnableHdr] = useState(false)
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [enableNightMode, setEnableNightMode] = useState(false)

  const [isRecording, setIsRecording] = useState(false);
  // const [collectedFrames, setCollectedFrames] = useState<string[]>([]);
  // const collectedFrames: ArrayBuffer[] = [];
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectedFrames, setCollectedFrames] = useState([]);
  const startTimeRef = useRef(0);

  // Inside your component, before the frameProcessor definition
  const [isCollectingFrames, setIsCollectingFrames] = useState(false);
  const sharedValues = {
    [START_TIME]: useSharedValue2(0),
    [FRAMES]: useSharedValue2([]),
  };
  const sharedCollectedFrames = useSharedValue2([]);

  // camera device settings
  const [preferredDevice] = usePreferredCameraDevice()
  let device = useCameraDevice(cameraPosition)

  if (preferredDevice != null && preferredDevice.position === cameraPosition) {
    // override default device with the one selected by the user in settings
    device = preferredDevice
  }

  const [targetFps, setTargetFps] = useState(60)

  const screenAspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH
  const format = useCameraFormat(device, [
    { fps: targetFps },
    { videoAspectRatio: screenAspectRatio },
    { videoResolution: 'max' },
    { photoAspectRatio: screenAspectRatio },
    { photoResolution: 'max' },
  ])

  const fps = Math.min(format?.maxFps ?? 1, targetFps)

  const supportsFlash = device?.hasFlash ?? false
  const supportsHdr = format?.supportsPhotoHdr
  const supports60Fps = useMemo(() => device?.formats.some((f) => f.maxFps >= 60), [device?.formats])
  const canToggleNightMode = device?.supportsLowLightBoost ?? false

  //#region Animated Zoom
  const minZoom = device?.minZoom ?? 1
  const maxZoom = Math.min(device?.maxZoom ?? 1, MAX_ZOOM_FACTOR)

  const cameraAnimatedProps = useAnimatedProps<CameraProps>(() => {
    const z = Math.max(Math.min(zoom.value, maxZoom), minZoom)
    return {
      zoom: z,
    }
  }, [maxZoom, minZoom, zoom])
  //#endregion

  //#region Callbacks
  const setIsPressingButton = useCallback(
    (_isPressingButton: boolean) => {
      isPressingButton.value = _isPressingButton
    },
    [isPressingButton],
  )
  const onError = useCallback((error: CameraRuntimeError) => {
    console.error(error)
  }, [])
  const onInitialized = useCallback(() => {
    console.log('Camera initialized!')
    setIsCameraInitialized(true)
  }, [])
  const onMediaCaptured = useCallback(
    (media: PhotoFile | VideoFile, type: 'photo' | 'video') => {
      console.log(`Media captured! ${JSON.stringify(media)}`)
      navigation.navigate('MediaPage', {
        path: media.path,
        type: type,
      })
    },
    [navigation],
  )
  const onFlipCameraPressed = useCallback(() => {
    setCameraPosition((p) => (p === 'back' ? 'front' : 'back'))
  }, [])
  const onFlashPressed = useCallback(() => {
    setFlash((f) => (f === 'off' ? 'on' : 'off'))
  }, [])
  //#endregion

  //#region Tap Gesture
  const onFocusTap = useCallback(
    ({ nativeEvent: event }: GestureResponderEvent) => {
      if (!device?.supportsFocus) return
      camera.current?.focus({
        x: event.locationX,
        y: event.locationY,
      })
    },
    [device?.supportsFocus],
  )
  const onDoubleTap = useCallback(() => {
    onFlipCameraPressed()
  }, [onFlipCameraPressed])
  //#endregion

  //#region Effects
  useEffect(() => {
    // Reset zoom to it's default everytime the `device` changes.
    zoom.value = device?.neutralZoom ?? 1
  }, [zoom, device])
  //#endregion

  //#region Pinch to Zoom Gesture
  // The gesture handler maps the linear pinch gesture (0 - 1) to an exponential curve since a camera's zoom
  // function does not appear linear to the user. (aka zoom 0.1 -> 0.2 does not look equal in difference as 0.8 -> 0.9)
  const onPinchGesture = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent, { startZoom?: number }>({
    onStart: (_, context) => {
      context.startZoom = zoom.value
    },
    onActive: (event, context) => {
      // we're trying to map the scale gesture to a linear zoom here
      const startZoom = context.startZoom ?? 0
      const scale = interpolate(event.scale, [1 - 1 / SCALE_FULL_ZOOM, 1, SCALE_FULL_ZOOM], [-1, 0, 1], Extrapolate.CLAMP)
      zoom.value = interpolate(scale, [-1, 0, 1], [minZoom, startZoom, maxZoom], Extrapolate.CLAMP)
    },
  })
  //#endregion

  useEffect(() => {
    const f =
      format != null
        ? `(${format.photoWidth}x${format.photoHeight} photo / ${format.videoWidth}x${format.videoHeight}@${format.maxFps} video @ ${fps}fps)`
        : undefined
    console.log(`Camera: ${device?.name} | Format: ${f}`)
  }, [device?.name, format, fps])

  useEffect(() => {
    location.requestPermission()
  }, [location])

  // const frameProcessor = useSkiaFrameProcessor((frame) => {
  //   'worklet'
  //   frame.render()
  // runAtTargetFps(10, () => {
  //   'worklet'
  //   console.log(`${frame.timestamp}: ${frame.width}x${frame.height} ${frame.pixelFormat} Frame (${frame.orientation})`)
  //   frame.render()
  //   const paint = Skia.Paint()
  //   paint.setColor(Skia.Color('red'))
  //   frame.drawCircle(frame.width / 2, frame.height / 2, frame.width / 4, paint)
  //   // examplePlugin(frame)
  //   // exampleKotlinSwiftPlugin(frame)
  // })
  // }, [])
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'


    // const resized = resize(frame, {
    //   scale: {
    //     width: 192,
    //     height: 192
    //   },
    //   pixelFormat: 'rgb',
    //   dataType: 'uint8'
    // })

    // const firstPixel = {
    //   r: resized[0],
    //   g: resized[1],
    //   b: resized[2]
    // }

    // runAtTargetFps(1, () => {
    //   'worklet'
    //   console.log("I'm running synchronously at 1 FPS!")
    // runAsync(frame, async () => {
    runAtTargetFps(45, () => {
      'worklet'
      console.log("I'm running asynchronously, possibly at a lower FPS rate!", isEnabled.value)
      // const start = startStreaming(frame);
      // console.log("start==g>j", start)

      const currentTime = new Date().getTime();
      if (startTimeRef.current === null) {
        console.log("start time is null");
        return;
      }
      if (startTimeRef.current === 0) {
        startTimeRef.current = currentTime;
        console.log("start time", startTimeRef.current);
      }
      if (currentTime - startTimeRef.current <= 208000) {
        const start = startStreaming(frame);
        console.log("start==g>j", currentTime - startTimeRef.current, "==>", start)

        return;
      }

      // isEnabled.value = false;


    })


    // })

    // console.log("Pixel==>", firstPixel)
    // const start = startStreaming(frame);
    // console.log("start==g>j", start)


  }, [])

  const videoHdr = format?.supportsVideoHdr && enableHdr
  const photoHdr = format?.supportsPhotoHdr && enableHdr && !videoHdr

  return (
    <View style={styles.container}>
      {device != null && isEnabled.value ? (
        <PinchGestureHandler onGestureEvent={onPinchGesture} enabled={isActive}>
          <Reanimated.View onTouchEnd={onFocusTap} style={StyleSheet.absoluteFill}>
            <TapGestureHandler onEnded={onDoubleTap} numberOfTaps={2}>
              <ReanimatedCamera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isActive}
                ref={camera}
                onInitialized={onInitialized}
                onError={onError}
                onStarted={() => console.log('Camera started!')}
                onStopped={() => console.log('Camera stopped!')}
                onPreviewStarted={() => console.log('Preview started!')}
                onPreviewStopped={() => console.log('Preview stopped!')}
                onOutputOrientationChanged={(o) => console.log(`Output orientation changed to ${o}!`)}
                onPreviewOrientationChanged={(o) => console.log(`Preview orientation changed to ${o}!`)}
                onUIRotationChanged={(degrees) => console.log(`UI Rotation changed: ${degrees}°`)}
                format={format}
                fps={format.minFps}
                photoHdr={photoHdr}
                videoHdr={videoHdr}
                photoQualityBalance="balanced"
                lowLightBoost={device.supportsLowLightBoost && enableNightMode}
                enableZoomGesture={false}
                animatedProps={cameraAnimatedProps}
                exposure={0}
                enableFpsGraph={true}
                outputOrientation="device"
                photo={false}
                video={true}
                audio={microphone.hasPermission}
                enableLocation={location.hasPermission}
                torch={supportsFlash ? flash : 'off'}
                frameProcessor={frameProcessor}


              />
            </TapGestureHandler>
          </Reanimated.View>
        </PinchGestureHandler>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.text}>Your phone does not have a Camera.</Text>
        </View>
      )}

      <CaptureButton
        style={styles.captureButton}
        camera={camera}
        onMediaCaptured={onMediaCaptured}
        cameraZoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        flash={supportsFlash ? flash : 'off'}
        enabled={isCameraInitialized && isActive}
        setIsPressingButton={setIsPressingButton}
        photoModeEnabled={false}
      />

      <StatusBarBlurBackground />

      <View style={styles.rightButtonRow}>
        <TouchableOpacity style={styles.button} onPress={onFlipCameraPressed} >
          <IonIcon name="camera-reverse" color="white" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => {
          console.log("pressed----------------", collectedFrames.length);
          // startCollecting();
          setIsCollectingFrames(prev => !prev);
        }} >
          <IonIcon name="camera" color="white" size={24} />
        </TouchableOpacity>
        {supportsFlash && (
          <TouchableOpacity style={styles.button} onPress={onFlashPressed} >
            <IonIcon name={flash === 'on' ? 'flash' : 'flash-off'} color="white" size={24} />
          </TouchableOpacity>
        )}
        {supports60Fps && (
          <TouchableOpacity style={styles.button} onPress={() => setTargetFps((t) => (t === 30 ? 60 : 30))}>
            <Text style={styles.text}>{`${targetFps}\nFPS`}</Text>
          </TouchableOpacity>
        )}
        {supportsHdr && (
          <TouchableOpacity style={styles.button} onPress={() => setEnableHdr((h) => !h)}>
            <MaterialIcon name={enableHdr ? 'hdr' : 'hdr-off'} color="white" size={24} />
          </TouchableOpacity>
        )}
        {canToggleNightMode && (
          <TouchableOpacity style={styles.button} onPress={() => setEnableNightMode(!enableNightMode)} >
            <IonIcon name={enableNightMode ? 'moon' : 'moon-outline'} color="white" size={24} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Devices')}>
          <IonIcon name="settings-outline" color="white" size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('CodeScannerPage')}>
          <IonIcon name="qr-code-outline" color="white" size={24} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  captureButton: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: SAFE_AREA_PADDING.paddingBottom,
  },
  button: {
    marginBottom: CONTENT_SPACING,
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: CONTROL_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(140, 140, 140, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightButtonRow: {
    position: 'absolute',
    right: SAFE_AREA_PADDING.paddingRight,
    top: SAFE_AREA_PADDING.paddingTop,
  },
  text: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})