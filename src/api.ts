import { CONFIG, FALLBACK_PROXIES } from './config';
import type { FetchOptions } from './types';
import type { PubmedResultItem } from './parser';

/**
 * Fetch with proxy, retries, and proper error handling.
 * Returns native Response object.
 */
export async function fetchWithProxy(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { retries = CONFIG.MAX_RETRIES, retryDelay = CONFIG.RETRY_BASE_DELAY } = options;

  if (CONFIG.WORKER_URL) {
    return fetchWithRetry(`${CONFIG.WORKER_URL}?url=${encodeURIComponent(url)}`, retries, retryDelay);
  }

  // Fallback: try multiple proxies
  for (const proxy of FALLBACK_PROXIES) {
    try {
      const proxyUrl = proxy + encodeURIComponent(url);
      return await fetchWithRetry(proxyUrl, retries, retryDelay);
    } catch {
      continue;
    }
  }

  // Direct connection as last resort
  return fetchWithRetry(url, retries, retryDelay);
}

async function fetchWithRetry(
  url: string,
  retries: number,
  baseDelay: number
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response looks like an error page (HTML)
      const text = await response.text();
      if (text.trim().startsWith('<') || text.trim().startsWith('<!')) {
        throw new Error('Received HTML error page from proxy');
      }

      // Return a new Response with the text body (streaming not supported by fetch)
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (e) {
      lastError = e as Error;
      if (attempt < retries) {
        await sleep(baseDelay * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error('All fetch attempts failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Translate Chinese text to English using Google Translate via worker proxy.
 */
export async function translateToEnglish(text: string): Promise<string> {
  const url = `${CONFIG.TRANSLATE_BASE}?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetchWithProxy(url);
  const data = await response.json();

  if (!data?.[0]) {
    throw new Error('Translation failed: unexpected response format');
  }

  // data[0] is an array of [translated_text, original_text, , ,]
  return data[0]
    .map((segment: [string, string]) => segment[0])
    .join('');
}

/**
 * Search PubMed for article IDs.
 */
export async function searchPubMedIds(
  query: string,
  retmax: number,
  retstart: number
): Promise<{ ids: string[]; count: number }> {
  const url = `${CONFIG.PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&retstart=${retstart}&retmode=json`;

  const response = await fetchWithProxy(url);
  const data = await response.json();

  const result = data?.esearchresult;
  if (!result) {
    throw new Error('Invalid search response');
  }

  return {
    ids: result.idlist || [],
    count: parseInt(result.count, 10) || 0,
  };
}

/**
 * Fetch article summaries from PubMed.
 */
export async function fetchArticleSummaries(ids: string[]): Promise<Record<string, PubmedResultItem>> {
  if (ids.length === 0) return {};

  const url = `${CONFIG.PUBMED_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
  const response = await fetchWithProxy(url);
  const data = await response.json();

  return data?.result || {};
}

/**
 * Fetch article abstracts (XML) from PubMed.
 */
export async function fetchArticleAbstract(pmid: string): Promise<string> {
  const url = `${CONFIG.PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;
  const response = await fetchWithProxy(url);
  return response.text();
}
