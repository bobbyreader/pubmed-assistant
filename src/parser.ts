import type { Article, AuthorInfo, ParsedAbstract } from './types';
import { CONFIG } from './config';

export interface PubmedResultItem {
  uid?: string;
  title?: string;
  authors?: { name?: string }[];
  fulljournalname?: string;
  source?: string;
  pubtype?: string;
  pubdate?: string;
  epubdate?: string;
  sortdate?: string;
}

export interface ParsedArticle extends Article {
  authorsList?: AuthorInfo[];
}

/**
 * Parse esummary JSON response into Article objects.
 */
export function parseArticles(
  ids: string[],
  resultData: Record<string, PubmedResultItem>
): Article[] {
  return ids
    .map(id => {
      const r = resultData[id];
      if (!r || (!r.uid && !r.title)) return null;

      const authors = parseAuthors(r.authors);
      const pubdate = getPubDate(r);
      const journal = r.fulljournalname || r.source || '';

      return {
        pmid: r.uid || id,
        title: r.title || '标题不详',
        authors,
        journal,
        pubdate,
        fulljournalname: r.fulljournalname,
        source: r.source,
        pubtype: r.pubtype,
      } as Article;
    })
    .filter((a): a is Article => a !== null);
}

function parseAuthors(authorsData: unknown): string {
  if (!Array.isArray(authorsData)) return '作者信息不详';

  const names = authorsData
    .slice(0, CONFIG.MAX_AUTHORS)
    .map((a: { name?: string }) => a.name || '')
    .filter(Boolean);

  if (names.length === 0) return '作者信息不详';

  const result = names.join(', ');
  if (authorsData.length > CONFIG.MAX_AUTHORS) {
    return result + ', et al.';
  }
  return result;
}

function getPubDate(r: PubmedResultItem): string {
  const pubDate = r.pubdate;
  if (typeof pubDate === 'string' && pubDate) return pubDate;

  const epubDate = r.epubdate;
  if (typeof epubDate === 'string' && epubDate) return epubDate;

  const sortDate = r.sortdate;
  if (typeof sortDate === 'string' && sortDate) return sortDate;

  return '日期不详';
}

/**
 * Parse PubMed XML abstract response.
 */
export function parseAbstractXml(xmlText: string): {
  abstract: ParsedAbstract[];
  keywords: string[];
} {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check for parse error
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Failed to parse XML response');
  }

  const abstractEls = xmlDoc.getElementsByTagName('AbstractText');
  const abstract: ParsedAbstract[] = [];

  for (let i = 0; i < abstractEls.length; i++) {
    const el = abstractEls[i];
    const label = el.getAttribute('Label') || undefined;
    const text = el.textContent?.trim() || '';
    if (text) {
      abstract.push({ label, text });
    }
  }

  const keywordEls = xmlDoc.getElementsByTagName('Keyword');
  const keywords: string[] = [];

  for (let i = 0; i < Math.min(keywordEls.length, CONFIG.MAX_KEYWORDS); i++) {
    const text = keywordEls[i].textContent?.trim();
    if (text) keywords.push(text);
  }

  return { abstract, keywords };
}

/**
 * Build PubMed search query with filters.
 */
export function buildSearchQuery(baseQuery: string, filters: {
  yearFrom?: string;
  yearTo?: string;
  author?: string;
  journal?: string;
}): string {
  let query = baseQuery;

  const { yearFrom, yearTo, author, journal } = filters;

  if (yearFrom && yearTo) {
    query += ` AND ${yearFrom}:${yearTo}[dp]`;
  } else if (yearFrom) {
    query += ` AND ${yearFrom}:2026[dp]`;
  } else if (yearTo) {
    query += ` AND 1900:${yearTo}[dp]`;
  }

  if (author?.trim()) {
    query += ` AND ${author.trim()}[Author]`;
  }

  if (journal?.trim()) {
    query += ` AND ${journal.trim()}[Journal]`;
  }

  return query;
}

/**
 * Check if text contains Chinese characters.
 */
export function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}
