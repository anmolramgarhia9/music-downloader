import React, { useState, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SearchResult, SearchResponse } from "@shared/api";
import { Search, Play, Download, Clock, Eye, Globe } from "lucide-react";

interface SearchPanelProps {
  onSelectVideo: (url: string, title?: string) => void;
  onDirectDownload?: (url: string, title?: string) => void;
  className?: string;
}

export function SearchPanel({ onSelectVideo, onDirectDownload, className }: SearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    try {
      setSearching(true);
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), maxResults: 20 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Search failed (${res.status})`);
      }

      const data: SearchResponse = await res.json();
      setResults(data.results);
      
      if (data.results.length === 0) {
        toast.info("No results found. Try a different search term.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !searching) {
      handleSearch();
    }
  };

  const formatViewCount = (count?: number) => {
    if (!count) return '';
    if (count > 1000000) return `${Math.floor(count / 1000000)}M views`;
    if (count > 1000) return `${Math.floor(count / 1000)}K views`;
    return `${count} views`;
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search YouTube for music..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10 h-12 text-base"
            />
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={searching || !searchQuery.trim()}
            className="w-full sm:w-auto h-12 px-6"
          >
            {searching ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Found {results.length} results
            </p>
            {results.map((result) => (
              <Card key={result.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 md:p-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {result.thumbnail && (
                      <img 
                        src={result.thumbnail} 
                        alt={result.title}
                        className="w-full sm:w-20 h-32 sm:h-15 object-cover rounded flex-shrink-0"
                        loading="lazy"
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm sm:text-sm line-clamp-2 leading-tight mb-2">
                        {result.title}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span>{result.channelTitle}</span>
                        {result.viewCount && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {formatViewCount(result.viewCount)}
                            </div>
                          </>
                        )}
                        {result.duration && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {result.duration}
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {onDirectDownload && (
                          <Button
                            size="sm"
                            className="flex-1 sm:flex-none h-10 sm:h-8 text-sm sm:text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90"
                            onClick={() => onDirectDownload(result.url, result.title)}
                          >
                            <Download className="h-4 w-4 sm:h-3 sm:w-3 mr-1" />
                            Download
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-none h-10 sm:h-8 text-sm sm:text-xs"
                          onClick={() => onSelectVideo(result.url, result.title)}
                        >
                          <Globe className="h-4 w-4 sm:h-3 sm:w-3 mr-1" />
                          Add URL
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 sm:flex-none h-10 sm:h-8 text-sm sm:text-xs"
                          onClick={() => window.open(result.url, '_blank')}
                        >
                          <Play className="h-4 w-4 sm:h-3 sm:w-3 mr-1" />
                          Watch
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}