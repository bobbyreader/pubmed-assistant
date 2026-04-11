import type { Article, FavoriteItem, ParsedAbstract } from './types';
import { isFavorite, toggleFavorite } from './state';
import { parseAbstractXml } from './parser';
import { fetchArticleAbstract } from './api';

// =============================================================================
// Utility: Safe DOM text creation helpers
// =============================================================================

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  children?: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      el.setAttribute(key, val);
    }
  }
  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    }
  }
  return el;
}

function setText(el: HTMLElement, text: string): void {
  el.textContent = text;
}

function addClass(el: HTMLElement, ...classes: string[]): void {
  el.classList.add(...classes);
}

// =============================================================================
// Skeleton Loading
// =============================================================================

export function renderSkeleton(container: HTMLElement): void {
  container.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const card = createEl('div', { class: 'skeleton-card' });
    const titleLine = createEl('div', { class: 'skeleton-line title' });
    const authLine = createEl('div', { class: 'skeleton-line authors' });
    const jourLine = createEl('div', { class: 'skeleton-line journal' });
    const metaLine = createEl('div', { class: 'skeleton-line meta' });
    card.append(titleLine, authLine, jourLine, metaLine);
    container.appendChild(card);
  }
}

// =============================================================================
// Article Card
// =============================================================================

export function renderArticleCard(article: Article): HTMLElement {
  const card = createEl('div', { class: 'article-card' });

  const title = createEl('div', { class: 'article-title' });
  setText(title, article.title);

  const authors = createEl('div', { class: 'article-authors' });
  setText(authors, article.authors);

  const journal = createEl('div', { class: 'article-journal' });
  setText(journal, article.journal);

  const meta = createEl('div', { class: 'article-meta' });
  setText(meta, `${article.pubdate} | PMID: ${article.pmid}`);

  // Action buttons row
  const actions = createEl('div', { class: 'article-actions' });

  // Link to PubMed
  const link = createEl('a', {
    class: 'btn btn-link',
    href: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  setText(link, '查看原文 →');
  actions.appendChild(link);

  // Summary button
  const summaryBtn = createEl('button', { class: 'btn btn-summary', 'data-pmid': article.pmid });
  setText(summaryBtn, '查看摘要');
  summaryBtn.addEventListener('click', () => handleSummaryClick(summaryBtn, article));
  actions.appendChild(summaryBtn);

  // Favorite button
  const favBtn = createEl('button', { class: 'btn btn-favorite', 'data-pmid': article.pmid });
  updateFavoriteBtn(favBtn, article.pmid);
  favBtn.addEventListener('click', () => {
    toggleFavorite(article);
    updateFavoriteBtn(favBtn, article.pmid);
  });
  actions.appendChild(favBtn);

  // Summary panel
  const summaryPanel = createEl('div', {
    class: 'article-summary',
    id: `summary-${article.pmid}`,
  });

  card.append(title, authors, journal, meta, actions, summaryPanel);
  return card;
}

function updateFavoriteBtn(btn: HTMLButtonElement, pmid: string): void {
  if (isFavorite(pmid)) {
    addClass(btn, 'favorited');
    btn.textContent = '❤️ 已收藏';
  } else {
    btn.classList.remove('favorited');
    btn.textContent = '⭐ 收藏';
  }
}

async function handleSummaryClick(btn: HTMLButtonElement, article: Article): Promise<void> {
  const pmid = article.pmid;
  const panel = document.getElementById(`summary-${pmid}`);
  if (!panel) return;

  // Toggle: if open, close
  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    setText(btn, '查看摘要');
    btn.classList.remove('active');
    return;
  }

  // Show loading
  btn.disabled = true;
  addClass(btn, 'loading');
  setText(btn, '⏳ 加载中...');

  panel.classList.add('open');
  const inner = createEl('div', { class: 'article-summary-inner' });
  panel.innerHTML = '';
  panel.appendChild(inner);

  const loadingEl = createEl('div', { class: 'summary-loading' });
  setText(loadingEl, '正在获取文献摘要...');
  inner.appendChild(loadingEl);

  try {
    const xmlText = await fetchArticleAbstract(pmid);
    const { abstract: abstracts, keywords } = parseAbstractXml(xmlText);
    renderAbstractContent(inner, abstracts, keywords);
    setText(btn, '✅ 隐藏摘要');
    addClass(btn, 'active');
  } catch {
    renderFallbackContent(inner, article);
    setText(btn, '✅ 隐藏信息');
    addClass(btn, 'active');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

function renderAbstractContent(
  container: HTMLElement,
  abstracts: ParsedAbstract[],
  keywords: string[]
): void {
  container.innerHTML = '';

  const label = createEl('div', { class: 'summary-label' });
  setText(label, '文献摘要');
  container.appendChild(label);

  const content = createEl('div', { class: 'summary-content' });

  if (abstracts.length === 0) {
    const p = createEl('p');
    setText(p, '该文献暂无摘要信息。');
    content.appendChild(p);
  } else {
    for (const abs of abstracts) {
      const p = createEl('p');
      if (abs.label) {
        const strong = createEl('strong');
        setText(strong, `${abs.label}: `);
        p.appendChild(strong);
        p.appendChild(document.createTextNode(abs.text));
      } else {
        setText(p, abs.text);
      }
      content.appendChild(p);
    }
  }

  container.appendChild(content);

  if (keywords.length > 0) {
    const kwDiv = createEl('div', { class: 'summary-keywords' });
    const kwStrong = createEl('strong');
    setText(kwStrong, '关键词：');
    setText(kwDiv, '');
    kwDiv.appendChild(kwStrong);
    kwDiv.appendChild(document.createTextNode(keywords.join(', ')));
    container.appendChild(kwDiv);
  }
}

function renderFallbackContent(container: HTMLElement, article: Article): void {
  container.innerHTML = '';

  const label = createEl('div', { class: 'summary-label' });
  setText(label, '文献信息');
  container.appendChild(label);

  const content = createEl('div', { class: 'summary-content' });

  const fields: [string, string][] = [
    ['标题', article.title],
    ['作者', article.authors],
    ['期刊', article.journal],
  ];

  for (const [fieldLabel, value] of fields) {
    const p = createEl('p');
    const strong = createEl('strong');
    setText(strong, `${fieldLabel}：`);
    p.appendChild(strong);
    p.appendChild(document.createTextNode(value));
    content.appendChild(p);
  }

  const em = createEl('p');
  const emText = createEl('em');
  setText(emText, '点击"查看原文"可以查看完整的摘要和详细信息。');
  em.appendChild(emText);
  content.appendChild(em);

  container.appendChild(content);
}

// =============================================================================
// Article Card for Favorites (with delete button)
// =============================================================================

export function renderFavoriteCard(item: FavoriteItem): HTMLElement {
  const card = renderArticleCard(item);

  // Find and modify actions — append delete button
  const actions = card.querySelector('.article-actions');
  if (actions) {
    const deleteBtn = createEl('button', { class: 'btn btn-delete', 'data-pmid': item.pmid });
    setText(deleteBtn, '🗑️ 删除');
    actions.appendChild(deleteBtn);
  }

  return card;
}

// =============================================================================
// Results List
// =============================================================================

export function renderResults(container: HTMLElement, articles: Article[]): void {
  container.innerHTML = '';

  if (articles.length === 0) {
    container.appendChild(renderNoResults());
    return;
  }

  for (const article of articles) {
    container.appendChild(renderArticleCard(article));
  }
}

// =============================================================================
// Favorites List
// =============================================================================

export function renderFavorites(container: HTMLElement, items: FavoriteItem[]): void {
  container.innerHTML = '';

  if (items.length === 0) {
    container.appendChild(renderEmptyFavorites());
    return;
  }

  for (const item of items) {
    container.appendChild(renderFavoriteCard(item));
  }
}

// =============================================================================
// No Results
// =============================================================================

export function renderNoResults(): HTMLElement {
  const el = createEl('div', { class: 'no-results' });

  const icon = createEl('div', { class: 'no-results-icon' });
  icon.textContent = '🔍';

  const heading = createEl('h3');
  setText(heading, '没有找到符合条件的文献');

  const ul = createEl('ul');
  const tips = [
    '调整筛选条件',
    '使用其他关键词搜索',
    '扩大年份范围',
  ];
  for (const tip of tips) {
    const li = createEl('li');
    setText(li, `• ${tip}`);
    ul.appendChild(li);
  }

  el.append(icon, heading, ul);
  return el;
}

// =============================================================================
// Empty Favorites
// =============================================================================

export function renderEmptyFavorites(): HTMLElement {
  const el = createEl('div', { class: 'empty-favorites' });

  const icon = createEl('div', { class: 'empty-favorites-icon' });
  icon.textContent = '📚';

  const heading = createEl('h3');
  setText(heading, '还没有收藏任何文献');

  const p = createEl('p');
  setText(p, '在搜索结果中点击"收藏"按钮来保存感兴趣的文献');

  el.append(icon, heading, p);
  return el;
}

// =============================================================================
// Error Banner
// =============================================================================

export function renderError(container: HTMLElement, message: string, showTip = false): void {
  const div = createEl('div', { class: 'error-banner show' });

  const p = createEl('p');
  setText(p, `搜索出错：${message}`);
  div.appendChild(p);

  const suggestions = createEl('p');
  setText(suggestions, '可能的原因：网络环境限制或 PubMed 服务暂时不可用');
  div.appendChild(suggestions);

  if (showTip) {
    const tip = createEl('p');
    setText(tip, '💡 建议：配置 Cloudflare Worker 代理以获得更稳定的访问');
    div.appendChild(tip);
  }

  const linkP = createEl('p');
  const linkText = document.createTextNode('📖 或直接访问 ');
  linkP.appendChild(linkText);
  const link = createEl('a', {
    href: 'https://pubmed.ncbi.nlm.nih.gov',
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  setText(link, 'PubMed 官网');
  linkP.appendChild(link);
  div.appendChild(linkP);

  container.innerHTML = '';
  container.appendChild(div);
}

export function clearError(container: HTMLElement): void {
  container.innerHTML = '';
}

// =============================================================================
// Results Info Bar
// =============================================================================

export function renderResultsInfo(
  container: HTMLElement,
  totalCount: number,
  filters?: { yearFrom?: string; yearTo?: string; author?: string; journal?: string }
): void {
  const div = createEl('div', { class: 'results-info show' });

  const countSpan = createEl('span', { class: 'results-count' });
  const numSpan = createEl('span', { class: 'count-num' });
  setText(numSpan, String(totalCount));
  countSpan.appendChild(document.createTextNode('找到 '));
  countSpan.appendChild(numSpan);
  countSpan.appendChild(document.createTextNode(` 条结果（当前页）`));
  div.appendChild(countSpan);

  if (filters) {
    const parts: string[] = [];
    if (filters.yearFrom || filters.yearTo) {
      const range = filters.yearFrom && filters.yearTo
        ? `${filters.yearFrom}–${filters.yearTo}`
        : filters.yearFrom
          ? `${filters.yearFrom}年起`
          : `${filters.yearTo}年前`;
      parts.push(`📅 ${range}`);
    }
    if (filters.author) parts.push(`👤 ${filters.author}`);
    if (filters.journal) parts.push(`📰 ${filters.journal}`);

    if (parts.length > 0) {
      const filterSpan = createEl('span', { class: 'text-muted text-sm' });
      setText(filterSpan, parts.join(' · '));
      div.appendChild(filterSpan);
    }
  }

  container.innerHTML = '';
  container.appendChild(div);
}

export function clearResultsInfo(container: HTMLElement): void {
  container.innerHTML = '';
}

// =============================================================================
// Translation Info
// =============================================================================

export function renderTranslationInfo(container: HTMLElement, translated: string): void {
  const div = createEl('div', { class: 'translation-info show' });
  const textNode = document.createTextNode('🌐 已翻译为：');
  div.appendChild(textNode);
  const strong = createEl('strong');
  setText(strong, translated);
  div.appendChild(strong);
  container.innerHTML = '';
  container.appendChild(div);
}

export function clearTranslationInfo(container: HTMLElement): void {
  container.innerHTML = '';
}

// =============================================================================
// Pagination
// =============================================================================

export function renderPagination(
  container: HTMLElement,
  currentPage: number,
  totalResults: number,
  retmax: number,
  onPageChange: (page: number) => void
): void {
  container.innerHTML = '';

  const totalPages = Math.ceil(totalResults / retmax);
  if (totalPages <= 1) return;

  const maxVisible = 5;
  const pages: (number | '...')[] = [];

  if (totalPages <= maxVisible + 2) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const prevBtn = createEl('button', { class: 'pagination-btn', 'data-page': String(currentPage - 1) });
  setText(prevBtn, '‹ 上一页');
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
  container.appendChild(prevBtn);

  for (const p of pages) {
    if (p === '...') {
      const ellipsis = createEl('span', { class: 'pagination-ellipsis' });
      setText(ellipsis, '...');
      container.appendChild(ellipsis);
    } else {
      const btn = createEl('button', { class: 'pagination-btn' });
      if (p === currentPage) addClass(btn, 'active');
      setText(btn, String(p));
      btn.addEventListener('click', () => onPageChange(p));
      container.appendChild(btn);
    }
  }

  const nextBtn = createEl('button', { class: 'pagination-btn', 'data-page': String(currentPage + 1) });
  setText(nextBtn, '下一页 ›');
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
  container.appendChild(nextBtn);
}
