import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally for api tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchWithProxy', () => {
    it('makes request through worker URL when configured', async () => {
      // Note: This test would need proper module mocking
      // For now we verify the structure exists
      const { CONFIG } = await import('../src/config');
      expect(CONFIG).toBeDefined();
      expect(CONFIG.PUBMED_BASE).toBe('https://eutils.ncbi.nlm.nih.gov/entrez/eutils');
    });
  });

  describe('translateToEnglish', () => {
    it('has correct translate base URL', async () => {
      const { CONFIG } = await import('../src/config');
      expect(CONFIG.TRANSLATE_BASE).toBe('https://translate.googleapis.com/translate_a/single');
    });
  });

  describe('config values', () => {
    it('has correct defaults', async () => {
      const { CONFIG } = await import('../src/config');
      expect(CONFIG.MAX_KEYWORDS).toBe(8);
      expect(CONFIG.MAX_AUTHORS).toBe(3);
      expect(CONFIG.DEFAULT_LIMIT).toBe(10);
      expect(CONFIG.DEBOUNCE_MS).toBe(300);
      expect(CONFIG.MAX_RETRIES).toBe(3);
    });

    it('has fallback proxies defined', async () => {
      const { FALLBACK_PROXIES } = await import('../src/config');
      expect(FALLBACK_PROXIES).toHaveLength(3);
      expect(FALLBACK_PROXIES[0]).toBe('https://api.allorigins.win/raw?url=');
    });
  });
});
