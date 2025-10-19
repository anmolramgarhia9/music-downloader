import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { spawn, type ChildProcess } from "child_process";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import archiver from "archiver";
import { queueManager } from "./queue/QueueManager";
import { musicQueueManager } from "./queue/MusicQueueManager";
import { activeTasks } from "./activeTasks";
import { searchYouTube, getPlaylistInfo } from "./services/youtubeApi";
import { optimizedDownloadService } from "./services/optimizedDownload";

const execAsync = promisify(exec);

function debug(...args: any[]) {
  if (process.env.DEBUG_YTDLP === '1') {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

function buildYtDlpArgs(userArgs: string[]): string[] {
  const args = [
    // Safer filenames and metadata embedding
    '--add-metadata',
    '--embed-thumbnail',
    '--trim-filenames', '128',
    '--restrict-filenames',
    ...userArgs,
  ];

  // Optional cookies/proxy/timeouts via env
  const cookies = process.env.YTDLP_COOKIES; // path to cookies.txt
  const proxy = process.env.YTDLP_PROXY; // e.g. http://127.0.0.1:8080
  const socketTimeout = process.env.YTDLP_SOCKET_TIMEOUT || '15';
  if (cookies) args.push('--cookies', cookies);
  if (proxy) args.push('--proxy', proxy);
  if (socketTimeout) args.push('--socket-timeout', socketTimeout);

  return args;
}

// Spawn yt-dlp safely with args (avoids Windows quoting issues) and report progress
async function runYtDlp(
  args: string[],
  opts?: { timeoutMs?: number; itemId?: string; onProgress?: (p: { percent?: number; speed?: string; eta?: string; text?: string }) => void }
): Promise<{ stdout: string; stderr: string; child?: ChildProcess }> {
  const ytdlpPath = process.platform === 'win32'
    ? path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
    : 'yt-dlp';

  const fullArgs = buildYtDlpArgs(args);
  debug('yt-dlp args:', fullArgs);

  return await new Promise<{ stdout: string; stderr: string; child?: ChildProcess }>((resolve, reject) => {
    const child = spawn(ytdlpPath, fullArgs, { shell: false });
    if (opts?.itemId) activeTasks.register(opts.itemId, child);
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error('yt-dlp timed out'));
    }, opts?.timeoutMs ?? Number(process.env.YTDLP_TIMEOUT_MS || 300000));

    const progressRegex = /\[download\]\s+(\d{1,3}(?:\.\d+)?)%.*?of.*?at\s+([^\s]+).*?ETA\s+([^\s]+)/i;

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      const m = s.match(progressRegex);
      if (m && opts?.onProgress) {
        const percent = Math.min(100, parseFloat(m[1]));
        opts.onProgress({ percent, speed: m[2], eta: m[3], text: s.trim() });
      }
    });
    child.on('error', (err) => {
      clearTimeout(timeout);
      if (opts?.itemId) activeTasks.unregister(opts.itemId);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (opts?.itemId) activeTasks.unregister(opts.itemId);
      if (code === 0) resolve({ stdout, stderr, child });
      else reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
  });
}

// Retry mechanism with exponential backoff
async function execWithRetryFactory(run: () => Promise<{ stdout: string; stderr: string }>, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}: yt-dlp ${attempt > 1 ? '(retry)' : ''}`.trim());
      const result = await run();
      return result;
    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        if (error.message.includes('timed out')) {
          throw new Error('Download timed out. The video might be too long or network is slow.');
        } else if (error.message.includes('unavailable')) {
          throw new Error('Video is unavailable. It might be private, deleted, or geo-blocked.');
        } else if (error.message.toLowerCase().includes('http')) {
          throw new Error(`Network error: ${error.message}`);
        } else {
          throw new Error(`Download failed: ${error.message}`);
        }
      }

      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  // Should never reach here
  throw new Error('Unexpected retry loop exit');
}

// Quality mapping for formats
const QUALITY_OPTIONS = {
  "mp3-320": { format: "mp3", quality: "320", label: "MP3 (320kbps - Highest)" },
  "mp3-192": { format: "mp3", quality: "192", label: "MP3 (192kbps - High)" },
  "mp3-128": { format: "mp3", quality: "128", label: "MP3 (128kbps - Standard)" },
  "m4a": { format: "m4a", quality: "0", label: "M4A (AAC - Best compression)" },
  "wav": { format: "wav", quality: "0", label: "WAV (Lossless)" },
  "flac": { format: "flac", quality: "0", label: "FLAC (Lossless)" },
  "opus": { format: "opus", quality: "0", label: "Opus (Efficient)" },
} as const;

// Video quality options
const VIDEO_QUALITY_OPTIONS = {
  "4k": { quality: "2160", label: "4K (2160p - Ultra HD)", format: "bestvideo[height>=2160]+bestaudio/best[height>=2160]/bestvideo[height>=1440]+bestaudio/best" },
  "1440p": { quality: "1440", label: "2K (1440p - Quad HD)", format: "bestvideo[height>=1440][height<2160]+bestaudio/best[height>=1440]/bestvideo[height>=1080]+bestaudio/best" },
  "1080p": { quality: "1080", label: "1080p (Full HD)", format: "bestvideo[height>=1080][height<1440]+bestaudio/best[height>=1080]/bestvideo[height>=720]+bestaudio/best" },
  "720p": { quality: "720", label: "720p (HD)", format: "bestvideo[height>=720][height<1080]+bestaudio/best[height>=720]/best" },
  "480p": { quality: "480", label: "480p (SD)", format: "bestvideo[height>=480][height<720]+bestaudio/best[height>=480]/best" },
  "360p": { quality: "360", label: "360p (Low)", format: "bestvideo[height>=360][height<480]+bestaudio/best[height>=360]/worst" },
} as const;

type DownloadFormat = keyof typeof QUALITY_OPTIONS;
type VideoQuality = keyof typeof VIDEO_QUALITY_OPTIONS;

const BodySchema = z.object({
  url: z.string().url(),
  format: z.enum(["mp3-320", "mp3-192", "mp3-128", "m4a", "wav", "flac", "opus", "4k", "1440p", "1080p", "720p", "480p", "360p"]).default("mp3-320"),
  type: z.enum(["audio", "video"]).optional().default("audio"),
});

function isYouTubeUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com");
  } catch {
    return false;
  }
}

function isPlaylistUrl(url: string) {
  return url.includes("list=");
}

function getContentType(ext: string): string {
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    case "opus":
      return "audio/opus";
    case "mp4":
      return "video/mp4";
    case "avi":
      return "video/x-msvideo";
    case "mkv":
      return "video/x-matroska";
    default:
      return "application/octet-stream";
  }
}

async function findOutputFile(dir: string, prefix: string, ext: string) {
  const files = await fsp.readdir(dir);
  const match = files.find((f) => f.startsWith(prefix) && f.toLowerCase().endsWith("." + ext));
  return match ? path.join(dir, match) : null;
}

// Basic server without complex imports for Vite dev server
export function createSimpleServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Basic ping route
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Placeholder for other routes - will be added dynamically
  app.get("/api/demo", (_req, res) => {
    res.json({ message: "Hello from Express server" });
  });

  // Search endpoint - working implementation
  app.post("/api/search", async (req, res) => {
    const SearchSchema = z.object({
      query: z.string().min(1),
      maxResults: z.number().min(1).max(50).default(5),
    });

    const parse = SearchSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid search parameters" });
    }

    const { query, maxResults } = parse.data;

    try {
      console.log('YouTube Data API search request:', { query, maxResults });
      
      // Use YouTube Data API for search
      const results = await searchYouTube({
        query,
        maxResults,
        type: 'video',
        order: 'relevance'
      });
      
      const response = {
        results,
      };
      
      console.log(`YouTube Data API search completed: ${results.length} results found`);
      
      res.json(response);
    } catch (e: any) {
      console.error("YouTube Data API search error:", e?.message || e);
      
      const msg = typeof e?.message === "string" ? e.message : "Search failed";
      res.status(500).json({ error: msg });
    }
  });

  app.get("/api/queue", (_req, res) => {
    res.json({ items: [], totalItems: 0, activeDownloads: 0 });
  });

  // Simple download endpoint
  app.post("/api/download", async (req, res) => {
    const parse = BodySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { url, format, type } = parse.data;
    if (!isYouTubeUrl(url)) {
      return res.status(400).json({ error: "Only YouTube URLs are supported" });
    }

    if (isPlaylistUrl(url)) {
      return res.status(400).json({ error: "Playlist URLs are not supported for single download. Use playlist download endpoint." });
    }

    try {
      console.log(`🚀 Starting optimized download: ${url} (${type})`);
      console.log(`🔍 Debug - format: ${format}, type: ${type}`);
      
      // Extract format and quality based on type
      let audioFormat = 'mp3';
      let audioQuality = '320';
      let videoQualityFormat = '';
      
      if (type === 'audio') {
        const qualityConfig = QUALITY_OPTIONS[format as keyof typeof QUALITY_OPTIONS];
        if (qualityConfig) {
          audioFormat = qualityConfig.format;
          audioQuality = qualityConfig.quality;
        }
        console.log(`🎵 Audio settings: format=${audioFormat}, quality=${audioQuality}`);
      } else if (type === 'video') {
        const videoConfig = VIDEO_QUALITY_OPTIONS[format as keyof typeof VIDEO_QUALITY_OPTIONS];
        if (videoConfig) {
          videoQualityFormat = videoConfig.format;
        }
        console.log(`🎬 Video settings: quality=${format}, format=${videoQualityFormat}`);
      }
      
      // Use the optimized download service
      const result = await optimizedDownloadService.optimizedDownload({
        url,
        format: type as 'audio' | 'video',
        quality: 'high',
        audioFormat,
        audioQuality,
        videoQualityFormat,
        concurrent: true,
        cache: true
      });

      console.log(`✅ Download completed: ${result.fileName} (${(result.size / 1024 / 1024).toFixed(2)} MB)`);

      // Sanitize filename for HTTP headers
      const sanitizedFilename = result.fileName
        .replace(/[^\w\s.-]/g, '_')  // Replace invalid characters with underscore
        .replace(/\s+/g, '_')       // Replace spaces with underscore
        .substring(0, 200);         // Limit length
      
      // Set response headers
      res.setHeader("Content-Type", getContentType(path.extname(result.fileName).slice(1)));
      res.setHeader("Content-Length", String(result.size));
      res.setHeader("Content-Disposition", `attachment; filename="${sanitizedFilename}"`);
      res.setHeader("X-Filename", sanitizedFilename);
      res.setHeader("Cache-Control", "public, max-age=3600");

      // Stream the file
      const stream = fs.createReadStream(result.filePath);
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "File stream error" });
        }
      });

  // Clean up file after streaming (free hosting optimization)
  res.on("close", async () => {
    try {
      // Always clean up files on free hosting to save space
      await fsp.unlink(result.filePath);
      // Clear cache more aggressively on free tier
      if (process.env.NODE_ENV === 'production') {
        optimizedDownloadService.cleanupCache();
      }
    } catch {
      // ignore cleanup errors
    }
  });

      stream.pipe(res);
    } catch (e: any) {
      console.error("❌ Download error:", e?.message || e);
      if (!res.headersSent) {
        const msg = typeof e?.message === "string" ? e.message : "Download failed";
        res.status(500).json({ error: msg });
      }
    }
  });

  app.post("/api/playlist-info", async (req, res) => {
    const parse = z.object({ url: z.string().url() }).safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { url } = parse.data;
    if (!isYouTubeUrl(url) || !isPlaylistUrl(url)) {
      return res.status(400).json({ error: "Only YouTube playlist URLs are supported" });
    }

    try {
      console.log('Getting playlist info for:', url);
      
      // Use YouTube Data API with yt-dlp fallback
      const playlistInfo = await getPlaylistInfo(url);
      
      const response = {
        title: playlistInfo.title,
        songs: playlistInfo.songs,
      };
      
      res.json(response);
    } catch (e: any) {
      console.error("yt-dlp playlist info error:", e?.stderr || e?.message || e);
      const msg = typeof e?.message === "string" ? e.message : "Failed to fetch playlist info";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/playlist-download", async (req, res) => {
    const parse = z.object({
      url: z.string().url(),
      format: z.enum(["mp3-320", "mp3-192", "mp3-128", "m4a", "wav", "flac", "opus", "mp4"]).default("mp3-320"),
      type: z.enum(["audio", "video"]).optional().default("audio"),
    }).safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { url, format, type } = parse.data;
    if (!isYouTubeUrl(url) || !isPlaylistUrl(url)) {
      return res.status(400).json({ error: "Only YouTube playlist URLs are supported" });
    }

    const isVideoDownload = type === "video" || format === "mp4";
    
    if (!isVideoDownload) {
      const qualityConfig = QUALITY_OPTIONS[format];
      if (!qualityConfig) {
        return res.status(400).json({ error: "Invalid format specified" });
      }
    }

    const tmpDir = os.tmpdir();
    const uniquePrefix = `ytmd-playlist-${Date.now()}-`;
    const template = path.join(tmpDir, `${uniquePrefix}%(title)s.%(ext)s`);

    try {
      let args: string[];
      let expectedExt: string;
      
      if (isVideoDownload) {
        args = [
          url,
          '--format', 'best[ext=mp4]',
          '--output', template,
          ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
          '--no-warnings',
        ];
        expectedExt = 'mp4';
      } else {
        const qualityConfig = QUALITY_OPTIONS[format];
        args = [
          url,
          '--extract-audio',
          '--audio-format', qualityConfig.format,
          ...(qualityConfig.quality !== '0' ? ['--audio-quality', qualityConfig.quality] : ['--audio-quality', '0']),
          '--output', template,
          ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
          '--no-warnings',
        ];
        expectedExt = qualityConfig.format;
      }

      const itemId = queueManager.addToQueue(url, format, 'Playlist Download');
      let lastPercent = 0;
      await execWithRetryFactory(() => runYtDlp(args, {
        itemId,
        onProgress: (p) => {
          if (typeof p.percent === 'number') lastPercent = p.percent;
          queueManager.updateProgress(itemId, { progress: lastPercent, speed: p.speed, eta: p.eta, status: 'downloading' as any });
        }
      }));

      const files = await fsp.readdir(tmpDir);
    const downloadedFiles = files
      .filter(f => f.startsWith(uniquePrefix) && f.toLowerCase().endsWith('.' + expectedExt))
      .map(f => path.join(tmpDir, f));

    if (downloadedFiles.length === 0) {
      throw new Error('No files downloaded');
    }

    const zipPath = path.join(tmpDir, `${uniquePrefix}playlist.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);

    for (const file of downloadedFiles) {
      archive.file(file, { name: path.basename(file) });
    }
      await archive.finalize();

      await new Promise<void>((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
      });

      const zipStat = await fsp.stat(zipPath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(zipStat.size));
      res.setHeader('Content-Disposition', `attachment; filename="playlist.${format}.zip"`);

      const zipStream = fs.createReadStream(zipPath);
      zipStream.on('error', (err) => {
        console.error('Zip stream error:', err);
        res.destroy(err);
      });

      res.on('close', async () => {
      try {
        await fsp.unlink(zipPath);
        for (const file of downloadedFiles) {
          await fsp.unlink(file);
        }
      } catch {}
        // Mark queue item completed
        const filename = `playlist.${format}.zip`;
        queueManager.completeItem(itemId, true);
      });

      zipStream.pipe(res);
    } catch (e: any) {
      console.error('yt-dlp playlist download error:', e?.message || e);
      const msg = typeof e?.message === 'string' ? e.message : 'Playlist download failed';
      res.status(500).json({ error: msg });
    }
  });

  // Music queue endpoints
  app.get("/api/music-queue", (_req, res) => {
    const status = musicQueueManager.getQueueStatus();
    res.json(status);
  });

  app.post("/api/music-queue", (req, res) => {
    const AddToQueueSchema = z.object({
      title: z.string().min(1),
      url: z.string().url(),
      thumbnail: z.string().optional(),
      duration: z.string().optional(),
      channelTitle: z.string().optional(),
    });

    const parse = AddToQueueSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid queue item data" });
    }

    const itemId = musicQueueManager.addToQueue(parse.data);
    res.json({ success: true, itemId });
  });

  app.delete("/api/music-queue/:itemId", (req, res) => {
    const { itemId } = req.params;
    const success = musicQueueManager.removeFromQueue(itemId);
    
    if (!success) {
      return res.status(404).json({ error: "Item not found in queue" });
    }
    
    res.json({ success: true });
  });

  app.put("/api/music-queue/reorder", (req, res) => {
    const ReorderQueueSchema = z.object({
      fromIndex: z.number().min(0),
      toIndex: z.number().min(0),
    });

    const parse = ReorderQueueSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid reorder data" });
    }

    const { fromIndex, toIndex } = parse.data;
    const success = musicQueueManager.reorderQueue(fromIndex, toIndex);
    
    if (!success) {
      return res.status(400).json({ error: "Invalid indices for reorder" });
    }
    
    res.json({ success: true });
  });

  app.post("/api/music-queue/play/:itemId", (req, res) => {
    const { itemId } = req.params;
    const item = musicQueueManager.playItem(itemId);
    
    if (!item) {
      return res.status(404).json({ error: "Item not found in queue" });
    }
    
    res.json({ success: true, nowPlaying: item });
  });

  app.post("/api/music-queue/next", (_req, res) => {
    const item = musicQueueManager.playNext();
    res.json({ success: true, nowPlaying: item });
  });

  app.post("/api/music-queue/previous", (_req, res) => {
    const item = musicQueueManager.playPrevious();
    res.json({ success: true, nowPlaying: item });
  });

  app.post("/api/music-queue/play-status", (req, res) => {
    const { playing } = req.body;
    if (typeof playing !== "boolean") {
      return res.status(400).json({ error: "Playing status must be boolean" });
    }
    
    musicQueueManager.setPlayingStatus(playing);
    res.json({ success: true });
  });

  app.delete("/api/music-queue", (_req, res) => {
    musicQueueManager.clearQueue();
    res.json({ success: true });
  });

  // Cache status endpoint for monitoring optimization
  app.get("/api/cache-status", (_req, res) => {
    const stats = optimizedDownloadService.getCacheStats();
    res.json({
      cache: stats,
      optimization: {
        concurrentFragments: 4,
        bufferSize: '64K',
        httpChunkSize: '10M',
        ffmpegPreset: 'ultrafast',
        caching: 'enabled'
      }
    });
  });

  return app;
}
