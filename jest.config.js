module.exports = {
  projects: [
    {
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.test.ts'],
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.test.tsx'],
      setupFiles: ['<rootDir>/jest.setup.ui.js'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)/|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|react-native-svg)',
      ],
    },
  ],
};
