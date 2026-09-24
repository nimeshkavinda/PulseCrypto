/* eslint-disable no-undef */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
  // npm nests some Expo packages (e.g. expo-modules-core) under expo/ in this workspace.
  modulePaths: ['<rootDir>/../node_modules/expo/node_modules'],
  moduleNameMapper: {
    // Test the shared contract from source (no prior build needed).
    '^@pulsecrypto/shared$': '<rootDir>/../shared/src/index.ts',
    // Shared sources use NodeNext-style `.js` import specifiers.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|react-native-svg|zustand|standard-navigation))',
  ],
};
