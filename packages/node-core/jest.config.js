export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
    '^@base/(.*)$': '<rootDir>/src/base/$1',
    '^@validators/(.*)$': '<rootDir>/src/validators/$1',
    '^@nodes/(.*)$': '<rootDir>/src/nodes/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  testTimeout: 30000,
  verbose: true,
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  // Handle ESM modules
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: false,
      tsconfig: {
        compilerOptions: {
          module: 'commonjs'
        }
      }
    }
  }
}