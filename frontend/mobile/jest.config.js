/**
 * pnpm stores every dependency under `node_modules/.pnpm/<name>@<version>`, so
 * the default Expo ignore pattern (which expects `node_modules/<name>`) never
 * matches and React Native ships untranspiled ESM. The pattern below opts the
 * RN/Expo packages into Babel using the pnpm directory naming, where a scope
 * separator is `+`.
 */
const TRANSPILED = [
  '(@react-native|@react-native-community|@expo|@expo-google-fonts|@react-navigation|@testing-library)\\+',
  'react-native',
  'expo',
  'jest-expo',
].join('|')

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    // The generated client only publishes an ESM `import` condition, which the
    // CommonJS test runtime cannot resolve. Pointing at the sources also means
    // the suite does not depend on `pnpm build` having run first.
    '^@tenda/api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
    // Those sources use ESM-style `./x.js` specifiers that resolve to `./x.ts`.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['<rootDir>/**/__tests__/**/*.test.tsx', '<rootDir>/**/*.test.ts'],
  transformIgnorePatterns: [`node_modules/\\.pnpm/(?!(${TRANSPILED}))`],
  // React Native keeps its own timers and bridge queue alive after the last
  // test, and the worker pool cannot be signalled inside sandboxes.
  maxWorkers: 1,
  forceExit: true,
  // A cold Babel cache makes the first screen render slow on CI machines.
  testTimeout: 15000,
}
