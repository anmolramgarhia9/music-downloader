import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Download, Trash2, Calendar } from "lucide-react";

interface HistoryItem {
  id: string;
  url: string;
  title: string;
  format: string;
  timestamp: Date;
  status: 'completed' | 'failed';
  error?: string;
}

interface HistoryPanelProps {
  className?: string;
}

export function HistoryPanel({ className }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    // Load history from localStorage
    const savedHistory = localStorage.getItem('download-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      } catch (error) {
        console.error('Failed to load download history:', error);
      }
    }
  }, []);

  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem('download-history', JSON.stringify(newHistory));
  };

  const addToHistory = (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    const newHistory = [newItem, ...history].slice(0, 50); // Keep last 50 items
    saveHistory(newHistory);
  };

  const clearHistory = () => {
    saveHistory([]);
  };

  const removeItem = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    saveHistory(newHistory);
  };

  const redownload = (item: HistoryItem) => {
    // Simulate re-download by adding to history
    addToHistory({
      url: item.url,
      title: item.title,
      format: item.format,
      status: 'completed'
    });
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Expose addToHistory function globally for other components to use
  React.useEffect(() => {
    (window as any).addToDownloadHistory = addToHistory;
  }, [addToHistory]);

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No download history</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Download History
            <Badge variant="outline">
              {history.length} item{history.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            className="h-8"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {history.map((item) => (
          <div key={item.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge 
                    variant={item.status === 'completed' ? 'secondary' : 'destructive'} 
                    className="text-xs"
                  >
                    {item.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {item.format.toUpperCase()}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatTimestamp(item.timestamp)}
                  </div>
                </div>
                
                <p className="text-sm font-medium truncate mb-1">
                  {item.title || 'Untitled'}
                </p>
                
                <p className="text-xs text-muted-foreground truncate">
                  {item.url}
                </p>
                
                {item.error && (
                  <p className="text-xs text-red-500 mt-1">
                    Error: {item.error}
                  </p>
                )}
              </div>
              
              <div className="flex gap-1">
                {item.status === 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => redownload(item)}
                    title="Download again"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => removeItem(item.id)}
                  title="Remove from history"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}