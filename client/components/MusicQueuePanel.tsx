import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MusicQueueItem, MusicQueueStatus } from "@shared/api";
import { 
  Play, 
  Pause,
  SkipForward,
  SkipBack,
  X,
  Music,
  Trash2,
  GripVertical
} from "lucide-react";
import { toast } from "sonner";

interface MusicQueuePanelProps {
  className?: string;
}

export function MusicQueuePanel({ className }: MusicQueuePanelProps) {
  const [musicQueue, setMusicQueue] = useState<MusicQueueStatus>({ 
    items: [], 
    currentIndex: -1,
    isPlaying: false,
    totalItems: 0 
  });
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('Connected to WebSocket for music queue');
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'musicQueueStatus') {
          setMusicQueue(data.data);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('Lost connection to server');
    };

    websocket.onclose = () => {
      console.log('WebSocket connection closed');
      setWs(null);
    };

    // Cleanup on unmount
    return () => {
      websocket.close();
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, [ws]);

  const playItem = (itemId: string) => {
    sendMessage({ type: 'playMusicItem', itemId });
  };

  const removeItem = (itemId: string) => {
    sendMessage({ type: 'removeFromMusicQueue', itemId });
  };

  const playNext = () => {
    sendMessage({ type: 'playNext' });
  };

  const playPrevious = () => {
    sendMessage({ type: 'playPrevious' });
  };

  const togglePlayPause = () => {
    sendMessage({ type: 'setPlayingStatus', playing: !musicQueue.isPlaying });
  };

  const clearQueue = () => {
    sendMessage({ type: 'clearMusicQueue' });
  };

  const formatDuration = (duration?: string) => {
    if (!duration) return '';
    return duration;
  };

  const getCurrentItem = () => {
    if (musicQueue.currentIndex >= 0 && musicQueue.currentIndex < musicQueue.items.length) {
      return musicQueue.items[musicQueue.currentIndex];
    }
    return null;
  };

  const currentItem = getCurrentItem();

  if (musicQueue.totalItems === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No songs in music queue</p>
          <p className="text-sm">Search for songs and add them to start playing!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Now Playing Section */}
      {currentItem && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Music className="h-5 w-5" />
              Now Playing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              {currentItem.thumbnail && (
                <img 
                  src={currentItem.thumbnail} 
                  alt={currentItem.title}
                  className="w-16 h-12 object-cover rounded flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">
                  {currentItem.title}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {currentItem.channelTitle}
                </p>
                {currentItem.duration && (
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(currentItem.duration)}
                  </p>
                )}
              </div>
            </div>
            
            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={playPrevious}
                disabled={musicQueue.totalItems <= 1}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={togglePlayPause}
                className="px-4"
              >
                {musicQueue.isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={playNext}
                disabled={musicQueue.totalItems <= 1}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Music Queue
              <Badge variant="outline">
                {musicQueue.totalItems} song{musicQueue.totalItems !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
            
            {musicQueue.totalItems > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearQueue}
                className="h-8"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear Queue
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          {musicQueue.items.map((item, index) => (
            <div 
              key={item.id} 
              className={`border rounded-lg p-3 transition-colors ${
                index === musicQueue.currentIndex 
                  ? 'bg-primary/10 border-primary/20' 
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  <GripVertical className="h-4 w-4 text-muted-foreground mr-2" />
                  {index === musicQueue.currentIndex && (
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse mr-2" />
                  )}
                </div>
                
                {item.thumbnail && (
                  <img 
                    src={item.thumbnail} 
                    alt={item.title}
                    className="w-12 h-9 object-cover rounded flex-shrink-0"
                  />
                )}
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{item.channelTitle}</span>
                    {item.duration && (
                      <>
                        <span>•</span>
                        <span>{formatDuration(item.duration)}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-1">
                  {index !== musicQueue.currentIndex && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => playItem(item.id)}
                      title="Play this song"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                    title="Remove from queue"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}