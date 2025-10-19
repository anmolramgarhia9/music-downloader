import { EventEmitter } from 'events';
import { MusicQueueItem, MusicQueueStatus, AddToMusicQueueRequest } from '@shared/api';
import { v4 as uuidv4 } from 'uuid';

export class MusicQueueManager extends EventEmitter {
  private queue: MusicQueueItem[] = [];
  private currentIndex: number = -1;
  private isPlaying: boolean = false;

  addToQueue(item: AddToMusicQueueRequest): string {
    const id = uuidv4();
    const queueItem: MusicQueueItem = {
      id,
      title: item.title,
      url: item.url,
      thumbnail: item.thumbnail,
      duration: item.duration,
      channelTitle: item.channelTitle,
      addedAt: new Date(),
      isCurrentlyPlaying: false,
    };

    this.queue.push(queueItem);
    
    // If this is the first item, make it current
    if (this.queue.length === 1) {
      this.currentIndex = 0;
      this.queue[0].isCurrentlyPlaying = true;
    }

    this.emitStatusUpdate();
    return id;
  }

  removeFromQueue(itemId: string): boolean {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index === -1) return false;

    // If removing the currently playing item
    if (index === this.currentIndex) {
      // If there are more items after current, play next
      if (index < this.queue.length - 1) {
        this.queue.splice(index, 1);
        // currentIndex stays the same, pointing to next item
        if (this.queue.length > 0) {
          this.queue[this.currentIndex].isCurrentlyPlaying = true;
        } else {
          this.currentIndex = -1;
        }
      } else {
        // If removing last item or no more items
        this.queue.splice(index, 1);
        if (this.queue.length === 0) {
          this.currentIndex = -1;
        } else {
          // Play previous item
          this.currentIndex = Math.max(0, index - 1);
          this.queue[this.currentIndex].isCurrentlyPlaying = true;
        }
      }
    } else {
      // Adjust currentIndex if needed
      if (index < this.currentIndex) {
        this.currentIndex--;
      }
      this.queue.splice(index, 1);
    }

    this.emitStatusUpdate();
    return true;
  }

  reorderQueue(fromIndex: number, toIndex: number): boolean {
    if (fromIndex < 0 || fromIndex >= this.queue.length || 
        toIndex < 0 || toIndex >= this.queue.length) {
      return false;
    }

    const item = this.queue.splice(fromIndex, 1)[0];
    this.queue.splice(toIndex, 0, item);

    // Update currentIndex
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex++;
    }

    this.emitStatusUpdate();
    return true;
  }

  playNext(): MusicQueueItem | null {
    if (this.queue.length === 0) return null;
    
    // Clear current playing status
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      this.queue[this.currentIndex].isCurrentlyPlaying = false;
    }

    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
    } else {
      // Loop back to beginning
      this.currentIndex = 0;
    }

    this.queue[this.currentIndex].isCurrentlyPlaying = true;
    this.emitStatusUpdate();
    return this.queue[this.currentIndex];
  }

  playPrevious(): MusicQueueItem | null {
    if (this.queue.length === 0) return null;
    
    // Clear current playing status
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      this.queue[this.currentIndex].isCurrentlyPlaying = false;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      // Loop to end
      this.currentIndex = this.queue.length - 1;
    }

    this.queue[this.currentIndex].isCurrentlyPlaying = true;
    this.emitStatusUpdate();
    return this.queue[this.currentIndex];
  }

  playItemAtIndex(index: number): MusicQueueItem | null {
    if (index < 0 || index >= this.queue.length) return null;
    
    // Clear current playing status
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      this.queue[this.currentIndex].isCurrentlyPlaying = false;
    }

    this.currentIndex = index;
    this.queue[this.currentIndex].isCurrentlyPlaying = true;
    this.emitStatusUpdate();
    return this.queue[this.currentIndex];
  }

  playItem(itemId: string): MusicQueueItem | null {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index === -1) return null;
    
    return this.playItemAtIndex(index);
  }

  setPlayingStatus(playing: boolean): void {
    this.isPlaying = playing;
    this.emitStatusUpdate();
  }

  getCurrentItem(): MusicQueueItem | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  clearQueue(): void {
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.emitStatusUpdate();
  }

  getQueueStatus(): MusicQueueStatus {
    return {
      items: this.queue,
      currentIndex: this.currentIndex,
      isPlaying: this.isPlaying,
      totalItems: this.queue.length,
    };
  }

  private emitStatusUpdate(): void {
    this.emit('queueUpdated', this.getQueueStatus());
  }
}

// Global instance
export const musicQueueManager = new MusicQueueManager();