import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { queueManager } from './queue/QueueManager';
import { musicQueueManager } from './queue/MusicQueueManager';
import { activeTasks } from './activeTasks';

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    console.log('New WebSocket connection');
    clients.add(ws);

    // Send current queue status immediately
    ws.send(JSON.stringify({
      type: 'queueStatus',
      data: queueManager.getQueueStatus()
    }));
    
    // Send current music queue status immediately
    ws.send(JSON.stringify({
      type: 'musicQueueStatus',
      data: musicQueueManager.getQueueStatus()
    }));

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        handleMessage(ws, data);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Listen to queue manager events
  queueManager.on('queueUpdated', (status) => {
    broadcast({
      type: 'queueStatus',
      data: status
    });
  });

  queueManager.on('progressUpdate', (progress) => {
    broadcast({
      type: 'progress',
      data: progress
    });
  });

  // Listen to music queue manager events
  musicQueueManager.on('queueUpdated', (status) => {
    broadcast({
      type: 'musicQueueStatus',
      data: status
    });
  });

  function broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  function handleMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'pauseItem':
        queueManager.pauseItem(message.itemId);
        break;
      case 'resumeItem':
        queueManager.resumeItem(message.itemId);
        break;
      case 'removeItem':
        // Try to cancel active process if running
        if (activeTasks.cancel(message.itemId)) {
          queueManager.completeItem(message.itemId, false, 'Canceled by user');
        } else {
          queueManager.removeItem(message.itemId);
        }
        break;
      case 'clearCompleted':
        queueManager.clearCompleted();
        break;
      case 'getQueueStatus':
        ws.send(JSON.stringify({
          type: 'queueStatus',
          data: queueManager.getQueueStatus()
        }));
        break;
      case 'getMusicQueueStatus':
        ws.send(JSON.stringify({
          type: 'musicQueueStatus',
          data: musicQueueManager.getQueueStatus()
        }));
        break;
      case 'addToMusicQueue':
        musicQueueManager.addToQueue(message.data);
        break;
      case 'removeFromMusicQueue':
        musicQueueManager.removeFromQueue(message.itemId);
        break;
      case 'playMusicItem':
        musicQueueManager.playItem(message.itemId);
        break;
      case 'playNext':
        musicQueueManager.playNext();
        break;
      case 'playPrevious':
        musicQueueManager.playPrevious();
        break;
      case 'setPlayingStatus':
        musicQueueManager.setPlayingStatus(message.playing);
        break;
      case 'clearMusicQueue':
        musicQueueManager.clearQueue();
        break;
      case 'reorderMusicQueue':
        musicQueueManager.reorderQueue(message.fromIndex, message.toIndex);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  return wss;
}