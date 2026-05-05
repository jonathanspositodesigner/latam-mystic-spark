import { useState, useEffect, useMemo } from 'react';
import { expandSearchTerms } from '@/lib/synonyms';

interface UseSmartSearchResult {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  debouncedSearch: string;
  expandedTerms: string[];
  isSearching: boolean;
}

export function useSmartSearch(debounceMs = 300): UseSmartSearchResult {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), debounceMs);
    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  const expandedTerms = useMemo(
    () => (debouncedSearch.trim() ? expandSearchTerms(debouncedSearch) : []),
    [debouncedSearch],
  );

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearch,
    expandedTerms,
    isSearching: debouncedSearch.trim().length > 0,
  };
}

export function buildSmartSearchFilter(
  terms: string[],
  fields: string[] = ['title'],
  tagField?: string,
): string {
  if (terms.length === 0) return '';
  const filters: string[] = [];
  for (const term of terms) {
    for (const field of fields) {
      filters.push(`${field}.ilike.%${term}%`);
    }
    if (tagField) {
      filters.push(`${tagField}.cs.{${term}}`);
    }
  }
  return filters.join(',');
}