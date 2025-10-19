import { spawn, ChildProcess } from 'child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';

export interface OptimizedDownloadOptions {
  url: string;
  format: 'audio' | 'video';
  quality?: 'high' | 'medium' | 'low';
  audioFormat?: string; // Specific audio format (mp3, m4a, etc.)
  audioQuality?: string; // Specific audio quality (320, 192, etc.)
  videoQualityFormat?: string; // Specific video quality format string
  concurrent?: boolean; // Enable parallel processing
  cache?: boolean; // Use intelligent caching
}

export interface DownloadProgress {
  percent: number;
  speed?: string;
  eta?: string;
  stage: 'fetching' | 'processing' | 'finalizing' | 'complete';
}

class OptimizedDownloadService {
  private cache = new Map<string, { path: string; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private activeDownloads = new Set<string>();

  /**
   * Modern optimized download with multiple performance techniques
   */
  async optimizedDownload(
    options: OptimizedDownloadOptions,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ filePath: string; fileName: string; size: number }> {
    const { url, format, quality = 'high', audioFormat = 'mp3', audioQuality = '320', videoQualityFormat = '', concurrent = true, cache = true } = options;
    
    // Generate unique identifier for caching
    const downloadId = this.generateId(url, format, quality, audioFormat, audioQuality, videoQualityFormat);
    console.log(`🔑 Cache key for ${format}: ${downloadId}`);
    
    // Check cache first
    if (cache && this.cache.has(downloadId)) {
      console.log(`📦 Cache hit for ${format}: ${downloadId}`);
      const cached = this.cache.get(downloadId)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL && await this.fileExists(cached.path)) {
        onProgress?.({ percent: 100, stage: 'complete' });
        const stats = await fsp.stat(cached.path);
        return {
          filePath: cached.path,
          fileName: path.basename(cached.path),
          size: stats.size
        };
      } else {
        this.cache.delete(downloadId);
      }
    }

    // Prevent duplicate downloads
    if (this.activeDownloads.has(downloadId)) {
      throw new Error('Download already in progress for this item');
    }

    this.activeDownloads.add(downloadId);

    try {
      onProgress?.({ percent: 5, stage: 'fetching' });
      
      // Use optimized yt-dlp arguments
      const result = await this.executeOptimizedDownload(url, format, quality, audioFormat, audioQuality, videoQualityFormat, onProgress);
      
      // Cache successful download
      if (cache) {
        this.cache.set(downloadId, {
          path: result.filePath,
          timestamp: Date.now()
        });
      }

      onProgress?.({ percent: 100, stage: 'complete' });
      return result;

    } finally {
      this.activeDownloads.delete(downloadId);
    }
  }

  /**
   * Execute download with optimized yt-dlp parameters
   */
  private async executeOptimizedDownload(
    url: string, 
    format: 'audio' | 'video',
    quality: string,
    audioFormat: string,
    audioQuality: string,
    videoQualityFormat: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ filePath: string; fileName: string; size: number }> {
    
    const tmpDir = os.tmpdir();
    const uniquePrefix = `ytdl-opt-${Date.now()}-`;
    const template = path.join(tmpDir, `${uniquePrefix}%(title)s.%(ext)s`);

    const ytdlpPath = process.platform === 'win32' 
      ? path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
      : 'yt-dlp';

    let args: string[];
    let expectedExt: string;

    if (format === 'video') {
      // Optimized video download with MP4 conversion
      const videoFormat = videoQualityFormat || this.getOptimalVideoFormat(quality);
      args = [
        url,
        // Format selection with fallback
        '--format', videoFormat,
        // Performance optimizations
        '--concurrent-fragments', '4', // Parallel fragment downloads
        '--buffer-size', '64K', // Larger buffer
        '--http-chunk-size', '10M', // Larger HTTP chunks
        // Output settings
        '--output', template,
        '--no-warnings',
        '--no-playlist',
        // Convert to MP4 for compatibility
        '--merge-output-format', 'mp4',
        '--recode-video', 'mp4',
        // FFmpeg optimizations
        ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
        '--postprocessor-args', 'ffmpeg:-threads 0 -preset ultrafast -c:v libx264 -c:a aac', // Convert to H.264/AAC
      ];
      expectedExt = 'mp4';
    } else {
      // Optimized audio download
      args = [
        url,
        // Extract audio with selected format and quality
        '--extract-audio',
        '--audio-format', audioFormat,
        ...(audioFormat === 'mp3' && audioQuality ? ['--audio-quality', audioQuality] : []),
        // Performance optimizations
        '--concurrent-fragments', '4',
        '--buffer-size', '64K',
        '--http-chunk-size', '10M',
        // Output settings
        '--output', template,
        '--no-warnings',
        '--no-playlist',
        // FFmpeg optimizations
        ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
        '--postprocessor-args', 'ffmpeg:-threads 0 -preset ultrafast -ac 2', // Stereo, ultrafast
        // Metadata optimization
        '--embed-metadata',
        '--add-metadata',
      ];
      expectedExt = audioFormat;
    }

    console.log(`\n🔧 yt-dlp command: ${ytdlpPath} ${args.join(' ')}\n`);
    
    return new Promise((resolve, reject) => {
      const child = spawn(ytdlpPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let lastPercent = 0;
      let stderr = '';
      const progressRegex = /\[download\]\s+(\d{1,3}(?:\.\d+)?)%.*?of.*?at\s+([^\s]+).*?ETA\s+([^\s]+)/i;
      const postProcessRegex = /\[ffmpeg\]|Merging formats into/i;

      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        
        // Parse download progress
        const progressMatch = text.match(progressRegex);
        if (progressMatch) {
          const percent = Math.min(95, parseFloat(progressMatch[1]));
          const speed = progressMatch[2];
          const eta = progressMatch[3];
          
          if (percent > lastPercent) {
            lastPercent = percent;
            onProgress?.({
              percent,
              speed,
              eta,
              stage: 'fetching'
            });
          }
        }
        
        // Detect post-processing stage
        if (postProcessRegex.test(text)) {
          onProgress?.({
            percent: 96,
            stage: 'processing'
          });
        }
      });

      child.on('close', async (code) => {
        if (code === 0) {
          try {
            onProgress?.({ percent: 98, stage: 'finalizing' });
            
            // Find the downloaded file
            const filePath = await this.findOutputFile(tmpDir, uniquePrefix, expectedExt);
            if (!filePath) {
              throw new Error('Downloaded file not found');
            }

            const stats = await fsp.stat(filePath);
            resolve({
              filePath,
              fileName: path.basename(filePath),
              size: stats.size
            });
          } catch (error) {
            reject(error);
          }
        } else {
          console.error(`\n❌ yt-dlp stderr output:\n${stderr}\n`);
          reject(new Error(`Download failed with exit code ${code}. Error: ${stderr.slice(-500)}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Timeout protection
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Download timeout'));
      }, 300000); // 5 minute timeout
    });
  }

  /**
   * Get optimal video format string based on quality preference
   */
  private getOptimalVideoFormat(quality: string): string {
    // Always prioritize 4K quality regardless of quality setting
    return 'best[height<=2160][ext=mp4]/best[height<=1440][ext=mp4]/best[height<=1080][ext=mp4]/best[ext=mp4]/best';
  }

  /**
   * Get optimal audio quality based on preference
   */
  private getOptimalAudioQuality(quality: string): string {
    switch (quality) {
      case 'high':
        return '320';
      case 'medium':
        return '192';
      case 'low':
        return '128';
      default:
        return '320';
    }
  }

  /**
   * Find downloaded file with better search algorithm
   */
  private async findOutputFile(dir: string, prefix: string, ext: string): Promise<string | null> {
    try {
      const files = await fsp.readdir(dir);
      
      // First try exact extension match
      let matchingFiles = files.filter(f => 
        f.startsWith(prefix) && f.toLowerCase().endsWith('.' + ext.toLowerCase())
      );
      
      // If no exact match and looking for mp4, try other video extensions
      if (matchingFiles.length === 0 && ext === 'mp4') {
        const videoExts = ['mp4', 'mkv', 'webm', 'avi', 'm4v'];
        matchingFiles = files.filter(f => 
          f.startsWith(prefix) && videoExts.some(videoExt => 
            f.toLowerCase().endsWith('.' + videoExt)
          )
        );
      }
      
      // If still no match, try any file with the prefix
      if (matchingFiles.length === 0) {
        matchingFiles = files.filter(f => f.startsWith(prefix));
      }
      
      if (matchingFiles.length === 0) {
        console.log(`❌ No files found with prefix: ${prefix} in directory: ${dir}`);
        console.log(`📁 Available files:`, files);
        return null;
      }
      
      // Return the largest file (in case of multiple matches)
      let largestFile = matchingFiles[0];
      let largestSize = 0;
      
      for (const file of matchingFiles) {
        const filePath = path.join(dir, file);
        const stats = await fsp.stat(filePath);
        if (stats.size > largestSize) {
          largestSize = stats.size;
          largestFile = file;
        }
      }
      
      console.log(`✅ Found file: ${largestFile} (${(largestSize / 1024 / 1024).toFixed(2)} MB)`);
      return path.join(dir, largestFile);
    } catch (error) {
      console.error(`❌ Error finding output file:`, error);
      return null;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate unique ID for caching
   */
  private generateId(url: string, format: string, quality: string, audioFormat?: string, audioQuality?: string, videoQualityFormat?: string): string {
    let key: string;
    if (format === 'audio') {
      key = `${url}-${format}-${audioFormat}-${audioQuality}`;
    } else {
      key = `${url}-${format}-${videoQualityFormat || quality}`;
    }
    return Buffer.from(key).toString('base64').slice(0, 16);
  }

  /**
   * Clean up old cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        // Optionally delete the cached file
        fsp.unlink(value.path).catch(() => {});
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { entries: number; totalSize: string } {
    return {
      entries: this.cache.size,
      totalSize: `${this.cache.size} items`
    };
  }
}

// Global instance
export const optimizedDownloadService = new OptimizedDownloadService();

// Cleanup cache periodically
setInterval(() => {
  optimizedDownloadService.cleanupCache();
}, 60 * 60 * 1000); // Every hour