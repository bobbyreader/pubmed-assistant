import { describe, it, expect } from 'vitest';
import { parseArticles, parseAbstractXml, buildSearchQuery, hasChinese } from '../src/parser';

describe('parser', () => {
  describe('hasChinese', () => {
    it('detects Chinese characters', () => {
      expect(hasChinese('糖尿病')).toBe(true);
      expect(hasChinese('COVID-19治疗')).toBe(true);
      expect(hasChinese('cancer treatment')).toBe(false);
      expect(hasChinese('')).toBe(false);
    });
  });

  describe('parseArticles', () => {
    it('parses valid PubMed results', () => {
      const ids = ['12345678', '87654321'];
      const resultData: Record<string, Parameters<typeof parseArticles>[1][string]> = {
        '12345678': {
          uid: '12345678',
          title: 'Test Article Title',
          authors: [{ name: 'Smith J' }, { name: 'Doe A' }],
          fulljournalname: 'Nature Medicine',
          source: 'Nature Med',
          pubdate: '2024-01-15',
        },
        '87654321': {
          uid: '87654321',
          title: 'Another Article',
          authors: [{ name: 'Brown K' }],
          source: 'Lancet',
        },
      };

      const articles = parseArticles(ids, resultData);

      expect(articles).toHaveLength(2);
      expect(articles[0].pmid).toBe('12345678');
      expect(articles[0].title).toBe('Test Article Title');
      expect(articles[0].authors).toBe('Smith J, Doe A');
      expect(articles[0].journal).toBe('Nature Medicine');
      expect(articles[1].authors).toBe('Brown K');
    });

    it('truncates long author lists', () => {
      const ids = ['111'];
      const resultData: Record<string, Parameters<typeof parseArticles>[1][string]> = {
        '111': {
          uid: '111',
          title: 'Test',
          authors: [
            { name: 'A' }, { name: 'B' }, { name: 'C' },
            { name: 'D' }, { name: 'E' }, { name: 'F' },
          ],
        },
      };

      const articles = parseArticles(ids, resultData);
      expect(articles[0].authors).toBe('A, B, C, et al.');
    });

    it('handles missing data with defaults', () => {
      const ids = ['999'];
      const resultData: Record<string, Parameters<typeof parseArticles>[1][string]> = {
        '999': { uid: '999' },
      };

      const articles = parseArticles(ids, resultData);
      expect(articles[0].title).toBe('标题不详');
      expect(articles[0].authors).toBe('作者信息不详');
      expect(articles[0].journal).toBe('');
    });

    it('skips null entries', () => {
      const ids = ['1', '2', '3'];
      const resultData: Record<string, Parameters<typeof parseArticles>[1][string]> = {
        '1': { uid: '1', title: 'Valid' },
        '2': {},
        '3': { uid: '3', title: 'Also Valid' },
      };

      const articles = parseArticles(ids, resultData);
      expect(articles).toHaveLength(2);
    });
  });

  describe('parseAbstractXml', () => {
    it('parses abstract text', () => {
      const xml = `<?xml version="1.0"?>
        <PubmedArticle>
          <MedlineCitation>
            <Article>
              <Abstract>
                <AbstractText Label="BACKGROUND">This is background text.</AbstractText>
                <AbstractText Label="METHODS">These are methods.</AbstractText>
                <AbstractText>Plain abstract text.</AbstractText>
              </Abstract>
              <KeywordList>
                <Keyword>diabetes</Keyword>
                <Keyword>obesity</Keyword>
                <Keyword>metformin</Keyword>
                <Keyword>extra</Keyword>
                <Keyword>keyword</Keyword>
              </KeywordList>
            </Article>
          </MedlineCitation>
        </PubmedArticle>`;

      const { abstract, keywords } = parseAbstractXml(xml);

      expect(abstract).toHaveLength(3);
      expect(abstract[0].label).toBe('BACKGROUND');
      expect(abstract[0].text).toBe('This is background text.');
      expect(abstract[2].text).toBe('Plain abstract text.');
      expect(keywords).toHaveLength(5); // all 5 keywords pass (MAX_KEYWORDS=8)
      expect(keywords).toContain('diabetes');
      expect(keywords).toContain('metformin');
    });

    it('handles empty abstract', () => {
      const xml = `<?xml version="1.0"?>
        <PubmedArticle>
          <MedlineCitation>
            <Article>
              <Abstract></Abstract>
            </Article>
          </MedlineCitation>
        </PubmedArticle>`;

      const { abstract, keywords } = parseAbstractXml(xml);
      expect(abstract).toHaveLength(0);
      expect(keywords).toHaveLength(0);
    });

    it('handles invalid XML', () => {
      const xml = '<invalid><unclosed>';
      expect(() => parseAbstractXml(xml)).toThrow();
    });
  });

  describe('buildSearchQuery', () => {
    it('builds base query', () => {
      expect(buildSearchQuery('diabetes', {})).toBe('diabetes');
    });

    it('adds year range filter', () => {
      expect(buildSearchQuery('cancer', { yearFrom: '2020', yearTo: '2024' }))
        .toBe('cancer AND 2020:2024[dp]');
    });

    it('adds single year filter', () => {
      expect(buildSearchQuery('cancer', { yearFrom: '2020' }))
        .toBe('cancer AND 2020:2026[dp]');
      expect(buildSearchQuery('cancer', { yearTo: '2019' }))
        .toBe('cancer AND 1900:2019[dp]');
    });

    it('adds author filter', () => {
      expect(buildSearchQuery('diabetes', { author: 'Smith' }))
        .toBe('diabetes AND Smith[Author]');
    });

    it('adds journal filter', () => {
      expect(buildSearchQuery('diabetes', { journal: 'Nature' }))
        .toBe('diabetes AND Nature[Journal]');
    });

    it('combines all filters', () => {
      expect(buildSearchQuery('diabetes', {
        yearFrom: '2020',
        yearTo: '2024',
        author: 'Smith',
        journal: 'Lancet',
      })).toBe('diabetes AND 2020:2024[dp] AND Smith[Author] AND Lancet[Journal]');
    });
  });
});
