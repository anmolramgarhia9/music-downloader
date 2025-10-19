import { EventEmitter } from 'events';
import { QueueItem, ProgressUpdate } from '@shared/api';
import { v4 as uuidv4 } from 'uuid';

export class QueueManager extends EventEmitter {
  private queue: QueueItem[] = [];
  private maxConcurrent = 3;
  private activeDownloads = 0;

  addToQueue(url: string, format: any, title?: string): string {
    const id = uuidv4();
    const item: QueueItem = {
      id,
      url,
      format,
      title,
      status: 'pending',
      createdAt: new Date(),
    };

    this.queue.push(item);
    this.emit('queueUpdated', this.getQueueStatus());
    
    // Try to start processing
    this.processQueue();
    
    return id;
  }

  getQueueStatus() {
    return {
      items: this.queue,
      totalItems: this.queue.length,
      activeDownloads: this.activeDownloads,
    };
  }

  updateProgress(itemId: string, update: Partial<ProgressUpdate>) {
    const item = this.queue.find(q => q.id === itemId);
    if (item) {
      Object.assign(item, update);
      this.emit('progressUpdate', {
        itemId,
        ...update,
        status: item.status,
      } as ProgressUpdate);
      this.emit('queueUpdated', this.getQueueStatus());
    }
  }

  completeItem(itemId: string, success: boolean, error?: string) {
    const item = this.queue.find(q => q.id === itemId);
    if (item) {
      item.status = success ? 'completed' : 'failed';
      item.completedAt = new Date();
      if (error) item.error = error;
      
      this.activeDownloads--;
      this.emit('queueUpdated', this.getQueueStatus());
      
      // Process next item
      this.processQueue();
    }
  }

  pauseItem(itemId: string) {
    const item = this.queue.find(q => q.id === itemId);
    if (item && item.status === 'downloading') {
      item.status = 'paused';
      this.emit('queueUpdated', this.getQueueStatus());
    }
  }

  resumeItem(itemId: string) {
    const item = this.queue.find(q => q.id === itemId);
    if (item && item.status === 'paused') {
      item.status = 'pending';
      this.emit('queueUpdated', this.getQueueStatus());
      this.processQueue();
    }
  }

  removeItem(itemId: string) {
    const index = this.queue.findIndex(q => q.id === itemId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.emit('queueUpdated', this.getQueueStatus());
    }
  }

  clearCompleted() {
    this.queue = this.queue.filter(item => item.status !== 'completed');
    this.emit('queueUpdated', this.getQueueStatus());
  }

  private processQueue() {
    if (this.activeDownloads >= this.maxConcurrent) return;

    const nextItem = this.queue.find(item => item.status === 'pending');
    if (!nextItem) return;

    nextItem.status = 'downloading';
    this.activeDownloads++;
    
    this.emit('queueUpdated', this.getQueueStatus());
    this.emit('startDownload', nextItem);
  }
}

// Global instance
export const queueManager = new QueueManager();