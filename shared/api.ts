/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// Supported audio formats for downloads (detailed)
export type DownloadFormat = "mp3-320" | "mp3-192" | "mp3-128" | "m4a" | "wav" | "flac" | "opus";

// Supported video qualities
export type VideoQuality = "4k" | "1440p" | "1080p" | "720p" | "480p" | "360p";

// Simplified format types for UI
export type SimpleDownloadFormat = "audio" | "video";

// Quality mapping for formats
export const QUALITY_OPTIONS = {
  "mp3-320": { format: "mp3", quality: "320", label: "MP3 (320kbps - Highest)" },
  "mp3-192": { format: "mp3", quality: "192", label: "MP3 (192kbps - High)" },
  "mp3-128": { format: "mp3", quality: "128", label: "MP3 (128kbps - Standard)" },
  "m4a": { format: "m4a", quality: "0", label: "M4A (AAC - Best compression)" },
  "wav": { format: "wav", quality: "0", label: "WAV (Lossless)" },
  "flac": { format: "flac", quality: "0", label: "FLAC (Lossless)" },
  "opus": { format: "opus", quality: "0", label: "Opus (Efficient)" },
} as const;

// Video quality options
export const VIDEO_QUALITY_OPTIONS = {
  "4k": { quality: "2160", label: "4K (2160p - Ultra HD)", format: "bestvideo[height>=2160]+bestaudio/best[height>=2160]/bestvideo[height>=1440]+bestaudio/best" },
  "1440p": { quality: "1440", label: "2K (1440p - Quad HD)", format: "bestvideo[height>=1440][height<2160]+bestaudio/best[height>=1440]/bestvideo[height>=1080]+bestaudio/best" },
  "1080p": { quality: "1080", label: "1080p (Full HD)", format: "bestvideo[height>=1080][height<1440]+bestaudio/best[height>=1080]/bestvideo[height>=720]+bestaudio/best" },
  "720p": { quality: "720", label: "720p (HD)", format: "bestvideo[height>=720][height<1080]+bestaudio/best[height>=720]/best" },
  "480p": { quality: "480", label: "480p (SD)", format: "bestvideo[height>=480][height<720]+bestaudio/best[height>=480]/best" },
  "360p": { quality: "360", label: "360p (Low)", format: "bestvideo[height>=360][height<480]+bestaudio/best[height>=360]/worst" },
} as const;

// Simplified format options for UI
export const SIMPLE_FORMAT_OPTIONS = {
  "audio": { 
    format: "mp3", 
    quality: "320", 
    label: "Audio (MP3 - High Quality)",
    downloadFormat: "mp3-320" as DownloadFormat
  },
  "video": { 
    format: "mp4", 
    quality: "best", 
    label: "Video (MP4 - Best Quality)",
    downloadFormat: "mp4" as any // We'll handle video downloads differently
  },
} as const;

// Request body for /api/download
export interface DownloadRequest {
  url: string;
  format: DownloadFormat;
}

// Enhanced playlist song info with metadata
export interface PlaylistSong {
  id: string;
  title: string;
  url: string;
  duration?: string;
  artist?: string;
  album?: string;
  thumbnail?: string;
  viewCount?: number;
  uploadDate?: string;
  description?: string;
}

// Download queue item
export interface QueueItem {
  id: string;
  url: string;
  format: DownloadFormat;
  title?: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
  progress?: number;
  speed?: string;
  eta?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  thumbnail?: string;
  duration?: string;
  channelTitle?: string;
}

// Music queue item (for playing music, separate from downloads)
export interface MusicQueueItem {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  duration?: string;
  channelTitle?: string;
  addedAt: Date;
  isCurrentlyPlaying?: boolean;
}

// Music queue management
export interface MusicQueueStatus {
  items: MusicQueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  totalItems: number;
}

// Search result from YouTube
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration?: string;
  viewCount?: number;
  channelTitle: string;
  publishedAt?: string;
}

// Response for /api/playlist-info
export interface PlaylistInfoResponse {
  title: string;
  songs: PlaylistSong[];
}

// Request body for playlist download
export interface PlaylistDownloadRequest {
  url: string;
  format: DownloadFormat;
}

// Search request
export interface SearchRequest {
  query: string;
  maxResults?: number;
}

// Search response
export interface SearchResponse {
  results: SearchResult[];
  nextPageToken?: string;
}

// Queue management
export interface QueueStatusResponse {
  items: QueueItem[];
  totalItems: number;
  activeDownloads: number;
}

// Progress update (for WebSocket)
export interface ProgressUpdate {
  itemId: string;
  progress: number;
  speed?: string;
  eta?: string;
  currentFile?: string;
  status: QueueItem['status'];
}

// Music queue requests
export interface AddToMusicQueueRequest {
  title: string;
  url: string;
  thumbnail?: string;
  duration?: string;
  channelTitle?: string;
}

export interface ReorderMusicQueueRequest {
  fromIndex: number;
  toIndex: number;
}
