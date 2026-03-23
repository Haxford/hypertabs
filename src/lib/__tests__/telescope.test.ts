import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../telescope';

describe('parseSearchQuery', () => {
  it('returns mode "tabs" when no prefix is given', () => {
    const result = parseSearchQuery('github');
    expect(result.mode).toBe('tabs');
    expect(result.searchTerm).toBe('github');
  });

  it('returns mode "history" for "h:" prefix', () => {
    const result = parseSearchQuery('h:google');
    expect(result.mode).toBe('history');
    expect(result.searchTerm).toBe('google');
  });

  it('returns mode "history" for "H:" prefix', () => {
    const result = parseSearchQuery('H:google');
    expect(result.mode).toBe('history');
    expect(result.searchTerm).toBe('google');
  });

  it('returns mode "bookmarks" for "b:" prefix', () => {
    const result = parseSearchQuery('b:recipes');
    expect(result.mode).toBe('bookmarks');
    expect(result.searchTerm).toBe('recipes');
  });

  it('returns mode "bookmarks" for "B:" prefix', () => {
    const result = parseSearchQuery('B:recipes');
    expect(result.mode).toBe('bookmarks');
    expect(result.searchTerm).toBe('recipes');
  });

  it('trims whitespace from the query and search term', () => {
    const result = parseSearchQuery('  h:  some query  ');
    expect(result.mode).toBe('history');
    expect(result.searchTerm).toBe('some query');
  });

  it('returns mode "tabs" and empty searchTerm for an empty query', () => {
    const result = parseSearchQuery('');
    expect(result.mode).toBe('tabs');
    expect(result.searchTerm).toBe('');
  });

  it('returns mode "tabs" and empty searchTerm for whitespace-only query', () => {
    const result = parseSearchQuery('   ');
    expect(result.mode).toBe('tabs');
    expect(result.searchTerm).toBe('');
  });
});
