export interface Article {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  pubdate: string;
  fulljournalname?: string;
  source?: string;
  pubtype?: string;
}

export interface ArticleDetail extends Article {
  authorsList?: AuthorInfo[];
}

export interface AuthorInfo {
  name: string;
  authtype?: string;
}

export interface FavoriteItem extends Article {
  savedAt: string;
}

export interface SearchFilters {
  yearFrom: string;
  yearTo: string;
  author: string;
  journal: string;
  limit: string;
}

export interface SearchState {
  results: Article[];
  totalCount: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
  lastQuery: string;
  translatedQuery: string | null;
}

export interface PaginationState {
  currentPage: number;
  totalResults: number;
  retmax: number;
  retstart: number;
}

export interface ApiConfig {
  workerUrl: string;
  pubmedBase: string;
  translateBase: string;
}

export interface FetchOptions {
  retries?: number;
  retryDelay?: number;
}

export interface ParsedAbstract {
  label?: string;
  text: string;
}
