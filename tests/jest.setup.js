// Jest setup file - mocks global Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined)
    }
  },
  runtime: {
    sendMessage: jest.fn().mockResolvedValue({}),
    lastError: null
  },
  proxy: {
    settings: {
      set: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({})
    }
  }
};
