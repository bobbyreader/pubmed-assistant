export const CONFIG = {
  WORKER_URL: import.meta.env?.VITE_WORKER_URL || '',
  PUBMED_BASE: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
  TRANSLATE_BASE: 'https://translate.googleapis.com/translate_a/single',
  MAX_KEYWORDS: 8,
  MAX_AUTHORS: 3,
  DEFAULT_LIMIT: 10,
  DEBOUNCE_MS: 300,
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY: 1000,
} as const;

export const FALLBACK_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://corsproxy.io/?',
] as const;
