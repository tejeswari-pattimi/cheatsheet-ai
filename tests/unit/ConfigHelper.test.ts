import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigHelper } from '../../electron/ConfigHelper';
import fs from 'node:fs';
import path from 'node:path';

// Mock dependencies
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false), // Default to false for unit tests
    encryptString: vi.fn((str) => ({ toString: () => `encrypted_${str}` })),
    decryptString: vi.fn((buf) => buf.toString().replace('encrypted_', '')),
  }
}));

// Mock fs module
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
}));

// Mock path module
vi.mock('node:path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/'))),
  },
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/'))),
}));

// Mock SecureConfigHelper if needed, or rely on mocked safeStorage
// Since we modify ConfigHelper to import SecureConfigHelper, which imports electron,
// mocking electron.safeStorage should be enough.

describe('ConfigHelper', () => {
  let configHelper: ConfigHelper;
  const mockConfig = {
    groqApiKey: 'gsk_12345678901234567890123456789012',
    geminiApiKey: 'mock-gemini-key',
    mode: 'mcq',
    groqModel: 'llama-3.3-70b-versatile',
    geminiModel: 'gemini-2.5-flash',
    language: 'python',
    opacity: 1.0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fs mocks
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConfig));

    // Create instance
    configHelper = new ConfigHelper();
  });

  it('should load configuration correctly', () => {
    const config = configHelper.loadConfig();
    expect(config).toEqual(expect.objectContaining(mockConfig));
  });

  it('should use default values if config file is empty', () => {
    (fs.readFileSync as any).mockReturnValue('');
    const config = configHelper.loadConfig();
    expect(config.mode).toBe('mcq'); // Default
  });

  it('should update configuration', () => {
    const updates = { language: 'javascript' };
    const newConfig = configHelper.updateConfig(updates);
    expect(newConfig.language).toBe('javascript');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should validate Groq API key', () => {
    expect(configHelper.isValidGroqApiKey('gsk_12345678901234567890123456789012')).toBe(true);
    expect(configHelper.isValidGroqApiKey('invalid-key')).toBe(false);
  });
});
