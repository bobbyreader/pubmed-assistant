import type { Article, FavoriteItem, SearchFilters, SearchState } from './types';

const STORAGE_KEY = 'pubmed-favorites';

function loadFromStorage(): Record<string, FavoriteItem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, FavoriteItem>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save favorites:', e);
  }
}

// Reactive state using a simple pub/sub pattern
type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notify(): void {
  listeners.forEach(fn => fn());
}

export const state = {
  // Search state
  search: {
    results: [] as Article[],
    totalCount: 0,
    currentPage: 1,
    isLoading: false,
    error: null as string | null,
    lastQuery: '',
    translatedQuery: null as string | null,
  } as SearchState,

  // Favorites
  _favorites: loadFromStorage() as Record<string, FavoriteItem>,

  get favorites(): Record<string, FavoriteItem> {
    return this._favorites;
  },

  set favorites(val: Record<string, FavoriteItem>) {
    this._favorites = val;
    saveToStorage(val);
    notify();
  },

  // Filter state
  filters: {
    yearFrom: '',
    yearTo: '',
    author: '',
    journal: '',
    limit: '10',
  } as SearchFilters,

  // UI state
  activeTab: 'search' as 'search' | 'favorites',
  filterPanelOpen: false,

  // Subscribe to state changes
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Favorites operations
export function toggleFavorite(article: Article): void {
  const pmid = article.pmid;
  if (state._favorites[pmid]) {
    delete state._favorites[pmid];
  } else {
    state._favorites[pmid] = {
      ...article,
      savedAt: new Date().toISOString(),
    };
  }
  saveToStorage(state._favorites);
  notify();
}

export function isFavorite(pmid: string): boolean {
  return pmid in state._favorites;
}

export function deleteFavorite(pmid: string): void {
  if (pmid in state._favorites) {
    delete state._favorites[pmid];
    saveToStorage(state._favorites);
    notify();
  }
}

export function getFavoritesArray(): FavoriteItem[] {
  return Object.values(state._favorites).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

export function updateSearchState(partial: Partial<SearchState>): void {
  Object.assign(state.search, partial);
  notify();
}
