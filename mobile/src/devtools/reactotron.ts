import Reactotron from 'reactotron-react-native';

/**
 * Reactotron Developer Tooling
 * Enables JS-level network inspection, state logging, and error tracking
 * without relying on React Native Bridgeless C++ host hooks.
 */
if (__DEV__) {
  Reactotron.configure({
    name: 'PulseCrypto Mobile',
  })
    .useReactNative({
      asyncStorage: false,
      networking: {
        ignoreUrls: /symbolicate/,
      },
    })
    .connect();
}

export default Reactotron;
