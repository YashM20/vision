import { Button, StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { FFmpegKitConfig, FFprobeKit } from 'ffmpeg-kit-react-native'

type Props = {}
FFmpegKitConfig.enableLogs();
FFmpegKitConfig.init();

const Example = (props: Props) => {

  const onPress = () => {
    FFprobeKit.getMediaInformation("http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4").then(async (session) => {
      console.log('Button pressed', await FFmpegKitConfig.getFFmpegVersion())
      const information = await session.getMediaInformation();
      console.log(`Media information: ${JSON.stringify(information, null, 2)}`);
      // if (information === undefined) {
      return;
      // CHECK THE FOLLOWING ATTRIBUTES ON ERROR
      const state = FFmpegKitConfig.sessionStateToString(await session.getState());
      const returnCode = await session.getReturnCode();
      const failStackTrace = await session.getFailStackTrace();
      const duration = await session.getDuration();
      const output = await session.getOutput();

      console.log(`Media information failed with state ${state} and returnCode ${returnCode}.`);
      console.log(`Command output: ${output}`);
      console.log(`Duration: ${duration}`);
      console.log(`Fail stack trace: ${failStackTrace}`);
      // }
    });
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Example</Text>
      <Button title="Press me" onPress={onPress} />
    </View>
  )
}

export default Example

const styles = StyleSheet.create({})