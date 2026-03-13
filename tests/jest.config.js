module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  collectCoverageFrom: [
    '../src/**/*.js',
    '../background.js',
    '../popup.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  testMatch: [
    '**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '/accessibility/'
  ],
  verbose: true,
  collectCoverage: true
};