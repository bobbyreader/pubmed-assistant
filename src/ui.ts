import { CONFIG } from './config';
import { state, toggleFavorite, deleteFavorite, getFavoritesArray, updateSearchState, isFavorite } from './state';
import {
  searchPubMedIds,
  fetchArticleSummaries,
  translateToEnglish,
} from './api';
import {
  parseArticles,
  buildSearchQuery,
  hasChinese,
} from './parser';
import {
  renderSkeleton,
  renderResults,
  renderFavorites,
  renderError,
  clearError,
  renderResultsInfo,
  clearResultsInfo,
  renderTranslationInfo,
  clearTranslationInfo,
  renderPagination,
} from './renderer';

// =============================================================================
// Debounce utility
// =============================================================================

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// =============================================================================
// Search logic
// =============================================================================

export async function handleSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) {
    alert('请输入搜索关键词！');
    return;
  }

  const elements = getElements();
  if (!elements) return;

  // Reset state
  updateSearchState({
    isLoading: true,
    error: null,
    results: [],
    totalCount: 0,
    currentPage: 1,
  });

  clearError(elements.errorDiv);
  clearResultsInfo(elements.resultsInfoDiv);
  clearTranslationInfo(elements.translationInfoDiv);
  elements.resultsDiv.innerHTML = '';
  renderSkeleton(elements.resultsDiv);
  elements.searchBtn.disabled = true;

  try {
    let searchQuery = trimmed;

    // Translate if Chinese
    if (hasChinese(trimmed)) {
      elements.loadingDiv.textContent = '正在翻译关键词...';
      updateSearchState({ isLoading: true });
      const translated = await translateToEnglish(trimmed);
      searchQuery = translated;
      updateSearchState({ translatedQuery: translated });
      renderTranslationInfo(elements.translationInfoDiv, translated);
      elements.loadingDiv.textContent = '正在搜索中，请稍候...';
    } else {
      updateSearchState({ translatedQuery: null });
      clearTranslationInfo(elements.translationInfoDiv);
    }

    // Apply filters
    const finalQuery = buildSearchQuery(searchQuery, {
      yearFrom: state.filters.yearFrom,
      yearTo: state.filters.yearTo,
      author: state.filters.author,
      journal: state.filters.journal,
    });

    updateSearchState({ lastQuery: finalQuery });

    const retmax = parseInt(state.filters.limit, 10) || CONFIG.DEFAULT_LIMIT;
    const retstart = 0;
    const { ids, count } = await searchPubMedIds(finalQuery, retmax, retstart);

    updateSearchState({ totalCount: count, currentPage: 1 });

    if (ids.length === 0) {
      elements.resultsDiv.innerHTML = '';
      renderResults(elements.resultsDiv, []);
      clearResultsInfo(elements.resultsInfoDiv);
      return;
    }

    const resultData = await fetchArticleSummaries(ids);
    const articles = parseArticles(ids, resultData);

    updateSearchState({ results: articles, isLoading: false });
    renderResults(elements.resultsDiv, articles);
    renderResultsInfo(elements.resultsInfoDiv, count, state.filters);
    renderPagination(elements.paginationDiv, 1, count, retmax, handlePageChange);

  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    updateSearchState({ error: message, isLoading: false });
    renderError(elements.errorDiv, message, !CONFIG.WORKER_URL);
  } finally {
    elements.loadingDiv.style.display = 'none';
    elements.searchBtn.disabled = false;
  }
}

export async function handlePageChange(page: number): Promise<void> {
  const elements = getElements();
  if (!elements) return;

  const trimmed = state.search.lastQuery.trim();
  if (!trimmed) return;

  const retmax = parseInt(state.filters.limit, 10) || CONFIG.DEFAULT_LIMIT;
  const retstart = (page - 1) * retmax;

  updateSearchState({ isLoading: true, currentPage: page });
  clearError(elements.errorDiv);
  elements.resultsDiv.innerHTML = '';
  renderSkeleton(elements.resultsDiv);

  try {
    const { ids, count } = await searchPubMedIds(trimmed, retmax, retstart);

    updateSearchState({ totalCount: count });

    if (ids.length === 0) {
      renderResults(elements.resultsDiv, []);
      return;
    }

    const resultData = await fetchArticleSummaries(ids);
    const articles = parseArticles(ids, resultData);

    updateSearchState({ results: articles, isLoading: false });
    renderResults(elements.resultsDiv, articles);
    renderResultsInfo(elements.resultsInfoDiv, count, state.filters);
    renderPagination(elements.paginationDiv, page, count, retmax, handlePageChange);

    // Scroll to top of results
    elements.resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    updateSearchState({ error: message, isLoading: false });
    renderError(elements.errorDiv, message, !CONFIG.WORKER_URL);
  }
}

// =============================================================================
// Tab switching
// =============================================================================

export function handleTabSwitch(tab: 'search' | 'favorites'): void {
  state.activeTab = tab;

  const elements = getElements();
  if (!elements) return;

  const searchPanel = document.getElementById('search-panel');
  const favoritesPanel = document.getElementById('favorites-panel');

  elements.tabBtns.forEach((btn, i) => {
    if ((tab === 'search' && i === 0) || (tab === 'favorites' && i === 1)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (tab === 'search') {
    searchPanel?.classList.add('active');
    favoritesPanel?.classList.remove('active');
  } else {
    searchPanel?.classList.remove('active');
    favoritesPanel?.classList.add('active');
    // Refresh favorites display
    const favItems = getFavoritesArray();
    renderFavorites(elements.favoritesListDiv, favItems);
    const countEl = document.getElementById('fav-count');
    if (countEl) countEl.textContent = String(favItems.length);
  }
}

// =============================================================================
// Filter panel
// =============================================================================

export function handleFilterToggle(): void {
  state.filterPanelOpen = !state.filterPanelOpen;
  const panel = document.getElementById('filter-panel');
  const btn = document.getElementById('filter-toggle-btn');
  if (panel) {
    panel.classList.toggle('open', state.filterPanelOpen);
  }
  if (btn) {
    btn.textContent = state.filterPanelOpen ? '🔧 隐藏筛选条件' : '🔧 显示筛选条件';
  }
}

export function handleFilterClear(): void {
  state.filters.yearFrom = '';
  state.filters.yearTo = '';
  state.filters.author = '';
  state.filters.journal = '';
  state.filters.limit = '10';

  const elements = getElements();
  if (!elements) return;

  const yearFromEl = document.getElementById('filter-year-from') as HTMLInputElement | null;
  const yearToEl = document.getElementById('filter-year-to') as HTMLInputElement | null;
  const authorEl = document.getElementById('filter-author') as HTMLInputElement | null;
  const journalEl = document.getElementById('filter-journal') as HTMLInputElement | null;
  const limitEl = document.getElementById('filter-limit') as HTMLSelectElement | null;

  if (yearFromEl) yearFromEl.value = '';
  if (yearToEl) yearToEl.value = '';
  if (authorEl) authorEl.value = '';
  if (journalEl) journalEl.value = '';
  if (limitEl) limitEl.value = '10';
}

// =============================================================================
// Export favorites
// =============================================================================

export function handleExportFavorites(): void {
  const items = getFavoritesArray();
  if (items.length === 0) {
    alert('没有收藏可以导出！');
    return;
  }

  const lines: string[] = [];
  lines.push('PubMed 文献收藏列表');
  lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('═'.repeat(60));
  lines.push('');

  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.title}`);
    lines.push(`   作者: ${item.authors}`);
    lines.push(`   期刊: ${item.journal}`);
    lines.push(`   发表时间: ${item.pubdate}`);
    lines.push(`   PMID: ${item.pmid}`);
    lines.push(`   链接: https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/`);
    lines.push(`   收藏时间: ${new Date(item.savedAt).toLocaleString('zh-CN')}`);
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PubMed收藏_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================================================
// Event binding
// =============================================================================

interface UIElements {
  searchInput: HTMLInputElement;
  searchBtn: HTMLButtonElement;
  resultsDiv: HTMLElement;
  errorDiv: HTMLElement;
  loadingDiv: HTMLElement;
  resultsInfoDiv: HTMLElement;
  translationInfoDiv: HTMLElement;
  paginationDiv: HTMLElement;
  favoritesListDiv: HTMLElement;
  tabBtns: NodeListOf<HTMLButtonElement>;
}

function getElements(): UIElements | null {
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  const searchBtn = document.getElementById('search-btn') as HTMLButtonElement | null;
  const resultsDiv = document.getElementById('results-list') as HTMLElement | null;
  const errorDiv = document.getElementById('error-container') as HTMLElement | null;
  const loadingDiv = document.getElementById('loading') as HTMLElement | null;
  const resultsInfoDiv = document.getElementById('results-info') as HTMLElement | null;
  const translationInfoDiv = document.getElementById('translation-info') as HTMLElement | null;
  const paginationDiv = document.getElementById('pagination') as HTMLElement | null;
  const favoritesListDiv = document.getElementById('favorites-list') as HTMLElement | null;
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');

  if (!searchInput || !searchBtn || !resultsDiv || !errorDiv || !loadingDiv ||
      !resultsInfoDiv || !translationInfoDiv || !paginationDiv || !favoritesListDiv) {
    return null;
  }

  return {
    searchInput,
    searchBtn,
    resultsDiv,
    errorDiv,
    loadingDiv,
    resultsInfoDiv,
    translationInfoDiv,
    paginationDiv,
    favoritesListDiv,
    tabBtns,
  };
}

// Debounced search for Enter key (the Enter key triggers immediately, no debounce needed)
function handleSearchSubmit(): void {
  const query = (document.getElementById('search-input') as HTMLInputElement | null)?.value || '';
  handleSearch(query);
}

const debouncedSearch = debounce(() => {
  const query = (document.getElementById('search-input') as HTMLInputElement | null)?.value || '';
  if (query.trim()) handleSearch(query);
}, CONFIG.DEBOUNCE_MS);

// Event delegation for all button clicks
function handleDelegatedClick(e: Event): void {
  const target = e.target as HTMLElement;

  // Tab buttons
  if (target.classList.contains('tab-btn')) {
    const tab = target.dataset.tab as 'search' | 'favorites';
    if (tab) handleTabSwitch(tab);
    return;
  }

  // Search button
  if (target.id === 'search-btn') {
    handleSearchSubmit();
    return;
  }

  // Filter toggle
  if (target.id === 'filter-toggle-btn') {
    handleFilterToggle();
    return;
  }

  // Filter clear
  if (target.id === 'filter-clear-btn') {
    handleFilterClear();
    return;
  }

  // Export favorites
  if (target.id === 'export-btn') {
    handleExportFavorites();
    return;
  }

  // Favorite button
  if (target.classList.contains('btn-favorite') && target.dataset.pmid) {
    // Article was added to results earlier via renderer, we need the full article data
    // Find from current search results
    const pmid = target.dataset.pmid;
    const article = state.search.results.find(a => a.pmid === pmid);
    if (article) {
      toggleFavorite(article);
      // Update button state
      if (isFavorite(pmid)) {
        target.classList.add('favorited');
        target.textContent = '❤️ 已收藏';
      } else {
        target.classList.remove('favorited');
        target.textContent = '⭐ 收藏';
      }
    }
    return;
  }

  // Delete favorite button
  if (target.classList.contains('btn-delete') && target.dataset.pmid) {
    const pmid = target.dataset.pmid;
    if (confirm('确定要删除这篇收藏吗？')) {
      deleteFavorite(pmid);
      const elements = getElements();
      if (elements && state.activeTab === 'favorites') {
        const favItems = getFavoritesArray();
        renderFavorites(elements.favoritesListDiv, favItems);
        const countEl = document.getElementById('fav-count');
        if (countEl) countEl.textContent = String(favItems.length);
      }
    }
    return;
  }

  // Apply filters (search again with new filters)
  if (target.id === 'filter-apply-btn') {
    const yearFromEl = document.getElementById('filter-year-from') as HTMLInputElement | null;
    const yearToEl = document.getElementById('filter-year-to') as HTMLInputElement | null;
    const authorEl = document.getElementById('filter-author') as HTMLInputElement | null;
    const journalEl = document.getElementById('filter-journal') as HTMLInputElement | null;
    const limitEl = document.getElementById('filter-limit') as HTMLSelectElement | null;

    state.filters.yearFrom = yearFromEl?.value || '';
    state.filters.yearTo = yearToEl?.value || '';
    state.filters.author = authorEl?.value || '';
    state.filters.journal = journalEl?.value || '';
    state.filters.limit = limitEl?.value || '10';

    // Re-run search if there's a query
    const query = (document.getElementById('search-input') as HTMLInputElement | null)?.value;
    if (query?.trim()) {
      handleSearch(query);
    }
    return;
  }
}

export function initUI(): void {
  const elements = getElements();
  if (!elements) return;

  // Search input: debounce on input, Enter triggers immediately
  elements.searchInput.addEventListener('input', debouncedSearch);
  elements.searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    }
  });

  // Event delegation for all buttons
  document.addEventListener('click', handleDelegatedClick);

  // Initialize favorites count
  const favItems = getFavoritesArray();
  const countEl = document.getElementById('fav-count');
  if (countEl) countEl.textContent = String(favItems.length);

  // Subscribe to state changes for re-rendering when favorites change
  state.subscribe(() => {
    if (state.activeTab === 'favorites') {
      const favItems = getFavoritesArray();
      renderFavorites(elements.favoritesListDiv, favItems);
      const countEl = document.getElementById('fav-count');
      if (countEl) countEl.textContent = String(favItems.length);
    }
  });
}
