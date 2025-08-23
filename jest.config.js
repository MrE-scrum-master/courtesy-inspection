module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/tests/**/*.test.js'],
      coverageDirectory: '<rootDir>/server/coverage',
      collectCoverageFrom: [
        'server/**/*.js',
        '!server/node_modules/**',
        '!server/coverage/**',
        '!server/tests/**'
      ]
    }
  ],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};