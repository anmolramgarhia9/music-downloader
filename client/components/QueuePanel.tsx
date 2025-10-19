import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QueueItem, QueueStatusResponse, ProgressUpdate } from "@shared/api";
import { 
  Pause, 
  Play, 
  X, 
  Download, 
  Check, 
  AlertCircle, 
  Clock,
  Trash2
} from "lucide-react";
import { toast } from "sonner";

interface QueuePanelProps {
  className?: string;
}

export function QueuePanel({ className }: QueuePanelProps) {
  const [queue, setQueue] = useState<QueueStatusResponse>({ 
    items: [], 
    totalItems: 0, 
    activeDownloads: 0 
  });
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('Connected to WebSocket');
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'queueStatus') {
          setQueue(data.data);
        } else if (data.type === 'progress') {
          // Progress updates are handled by the queue status updates
          console.log('Progress update:', data.data);
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

  const pauseItem = (itemId: string) => {
    sendMessage({ type: 'pauseItem', itemId });
  };

  const resumeItem = (itemId: string) => {
    sendMessage({ type: 'resumeItem', itemId });
  };

  const removeItem = (itemId: string) => {
    sendMessage({ type: 'removeItem', itemId });
  };

  const clearCompleted = () => {
    sendMessage({ type: 'clearCompleted' });
  };

  const getStatusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'downloading':
        return <Download className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'downloading':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'paused':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatCreatedAt = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const completedItems = queue.items.filter(item => item.status === 'completed');
  const hasCompletedItems = completedItems.length > 0;

  if (queue.totalItems === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Download className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No downloads in queue</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Queue
            <Badge variant="outline">
              {queue.totalItems} item{queue.totalItems !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          
          {hasCompletedItems && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearCompleted}
              className="h-8"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear Completed
            </Button>
          )}
        </div>
        
        {queue.activeDownloads > 0 && (
          <p className="text-sm text-muted-foreground">
            {queue.activeDownloads} active download{queue.activeDownloads !== 1 ? 's' : ''}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        {queue.items.map((item) => (
          <div key={item.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(item.status)}
                  <Badge variant={getStatusColor(item.status) as any} className="text-xs">
                    {item.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatCreatedAt(item.createdAt)}
                  </span>
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
                {item.status === 'downloading' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => pauseItem(item.id)}
                  >
                    <Pause className="h-3 w-3" />
                  </Button>
                )}
                
                {item.status === 'paused' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => resumeItem(item.id)}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                )}
                
                {(item.status === 'failed' || item.status === 'completed') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => removeItem(item.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            
            {item.status === 'downloading' && typeof item.progress === 'number' && (
              <div className="space-y-1">
                <Progress value={item.progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{item.progress.toFixed(1)}%</span>
                  <div className="flex gap-2">
                    {item.speed && <span>{item.speed}</span>}
                    {item.eta && <span>ETA: {item.eta}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}