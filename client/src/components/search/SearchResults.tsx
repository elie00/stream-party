/**
 * SearchResults Component
 * Displays search results with highlighting
 */
import React from 'react';
import { SearchResult } from '@stream-party/shared';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  onResultClick?: (result: SearchResult) => void;
  isLoading?: boolean;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  onResultClick,
  isLoading = false,
}) => {
  // Highlight matching text
  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) return text;

    const parts = text.split(new RegExp(`(${escapeRegex(searchQuery)})`, 'gi'));
    
    return parts.map((part, index) => 
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={index} className="bg-indigo-500/30 text-white rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Escape regex special characters
  const escapeRegex = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Format date
  const formatDate = (date?: Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get score label
  const getScoreLabel = (score: number) => {
    if (score >= 50) return 'Meilleur résultat';
    if (score >= 30) return 'Résultat pertinent';
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Recherche en cours...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0 && query.length >= 2) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <svg
          className="w-16 h-16 mb-4 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <p className="text-lg font-medium">Aucun résultat</p>
        <p className="text-sm">Essayez avec d'autres termes de recherche</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Results count */}
      {results.length > 0 && (
        <div className="flex items-center justify-between px-2 py-1 text-sm text-gray-400">
          <span>{results.length} résultat(s) pour "{query}"</span>
        </div>
      )}

      {/* Results list */}
      {results.map((result, index) => (
        <button
          key={`${result.type}-${result.id}-${index}`}
          onClick={() => onResultClick?.(result)}
          className="w-full text-left p-4 bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors group"
        >
          {result.type === 'message' ? (
            <div className="space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {result.displayName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-white group-hover:text-indigo-400 transition-colors">
                    {result.displayName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getScoreLabel(result.score) && (
                    <span className="text-xs text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded">
                      {getScoreLabel(result.score)}
                    </span>
                  )}
                  {result.createdAt && (
                    <span className="text-xs text-gray-500">
                      {formatDate(result.createdAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <p className="text-sm text-gray-300 line-clamp-3">
                {highlightText(result.content || '', query)}
              </p>

              {/* Context */}
              {result.roomId && (
                <p className="text-xs text-gray-500">
                  Room: {result.roomId}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-white">
                  {result.displayName?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-white group-hover:text-indigo-400 transition-colors">
                  {result.displayName}
                </p>
                <p className="text-xs text-gray-400">Utilisateur</p>
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
};

export default SearchResults;
