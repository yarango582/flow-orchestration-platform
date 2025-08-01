import 'reflect-metadata';

// Global test setup
beforeAll(() => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  
  // Suppress console logs during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Cleanup after all tests
});

// Global timeout for async operations
jest.setTimeout(30000);