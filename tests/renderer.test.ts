import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderSkeleton,
  renderNoResults,
  renderEmptyFavorites,
} from '../src/renderer';

describe('renderer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('renderSkeleton', () => {
    it('creates 3 skeleton cards', () => {
      renderSkeleton(container);
      const cards = container.querySelectorAll('.skeleton-card');
      expect(cards).toHaveLength(3);
    });

    it('contains skeleton lines', () => {
      renderSkeleton(container);
      const card = container.querySelector('.skeleton-card')!;
      expect(card.querySelector('.skeleton-line.title')).toBeTruthy();
      expect(card.querySelector('.skeleton-line.authors')).toBeTruthy();
      expect(card.querySelector('.skeleton-line.journal')).toBeTruthy();
      expect(card.querySelector('.skeleton-line.meta')).toBeTruthy();
    });
  });

  describe('renderNoResults', () => {
    it('creates no-results element with heading and tips', () => {
      const el = renderNoResults();
      container.appendChild(el);

      const heading = container.querySelector('h3');
      expect(heading?.textContent).toBe('没有找到符合条件的文献');

      const tips = container.querySelectorAll('li');
      expect(tips).toHaveLength(3);
      expect(tips[0].textContent).toBe('• 调整筛选条件');
    });
  });

  describe('renderEmptyFavorites', () => {
    it('creates empty favorites element', () => {
      const el = renderEmptyFavorites();
      container.appendChild(el);

      const heading = container.querySelector('h3');
      expect(heading?.textContent).toBe('还没有收藏任何文献');
    });
  });
});
