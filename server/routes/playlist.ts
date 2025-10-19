import type { RequestHandler } from "express";
import { z } from "zod";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import fsp from "node:fs/promises";
import archiver from "archiver";
import ytdlp from "yt-dlp-exec";
import ffmpegPath from "ffmpeg-static";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
import { PlaylistInfoResponse, PlaylistSong, QUALITY_OPTIONS } from "@shared/api";
import { getPlaylistInfo } from "../services/youtubeApi";

const PlaylistInfoSchema = z.object({
  url: z.string().url(),
});

const PlaylistDownloadSchema = z.object({
  url: z.string().url(),
  format: z.enum(["mp3-320", "mp3-192", "mp3-128", "m4a", "wav", "flac", "opus"]).default("mp3-320"),
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

export const handlePlaylistInfo: RequestHandler = async (req, res) => {
  const parse = PlaylistInfoSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { url } = parse.data;
  if (!isYouTubeUrl(url) || !isPlaylistUrl(url)) {
    return res.status(400).json({ error: "Only YouTube playlist URLs are supported" });
  }

  try {
    console.log('Getting playlist info for URL:', url);
    
    // Use YouTube Data API with yt-dlp fallback
    const playlistInfo = await getPlaylistInfo(url);
    
    const response: PlaylistInfoResponse = {
      title: playlistInfo.title,
      songs: playlistInfo.songs,
    };

    res.json(response);
  } catch (e: any) {
    console.error("yt-dlp playlist info error:", e?.stderr || e?.message || e);
    const msg = typeof e?.message === "string" ? e.message : "Failed to fetch playlist info";
    res.status(500).json({ error: msg });
  }
};

export const handlePlaylistDownload: RequestHandler = async (req, res) => {
  const parse = PlaylistDownloadSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { url, format } = parse.data;
  if (!isYouTubeUrl(url) || !isPlaylistUrl(url)) {
    return res.status(400).json({ error: "Only YouTube playlist URLs are supported" });
  }

  const qualityConfig = QUALITY_OPTIONS[format];
  if (!qualityConfig) {
    return res.status(400).json({ error: "Invalid format specified" });
  }

  const tmpDir = os.tmpdir();
  const uniquePrefix = `ytmd-playlist-${Date.now()}-`;
  const template = path.join(tmpDir, `${uniquePrefix}%(title)s.%(ext)s`);

  try {
    // Use direct command execution for Windows compatibility
    const ytdlpPath = process.platform === 'win32' 
      ? path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
      : 'yt-dlp';
    
    const ffmpegArg = ffmpegPath ? `--ffmpeg-location "${ffmpegPath}"` : '';
    const qualityArg = qualityConfig.quality !== '0' ? `--audio-quality ${qualityConfig.quality}` : '--audio-quality 0';
    const command = `"${ytdlpPath}" "${url}" --extract-audio --audio-format ${qualityConfig.format} ${qualityArg} --output "${template}" ${ffmpegArg} --no-warnings`;
    
    console.log('Executing playlist download:', command);
    await execAsync(command);

    // Find all downloaded files
    const files = await fsp.readdir(tmpDir);
    const audioFiles = files
      .filter(f => f.startsWith(uniquePrefix) && f.toLowerCase().endsWith("." + qualityConfig.format))
      .map(f => path.join(tmpDir, f));

    if (audioFiles.length === 0) {
      throw new Error("No files downloaded");
    }

    // Create zip archive
    const zipPath = path.join(tmpDir, `${uniquePrefix}playlist.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    for (const file of audioFiles) {
      const fileName = path.basename(file);
      archive.file(file, { name: fileName });
    }

    await archive.finalize();

    // Wait for zip to finish
    await new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    const zipStat = await fsp.stat(zipPath);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", String(zipStat.size));
    res.setHeader("Content-Disposition", `attachment; filename="playlist.${format}.zip"`);

    const zipStream = fs.createReadStream(zipPath);
    zipStream.on("error", (err) => {
      console.error("Zip stream error:", err);
      res.destroy(err);
    });

    res.on("close", async () => {
      try {
        // Clean up files
        await fsp.unlink(zipPath);
        for (const file of audioFiles) {
          await fsp.unlink(file);
        }
      } catch (e) {
        // ignore
      }
    });

    zipStream.pipe(res);
  } catch (e: any) {
    console.error("yt-dlp playlist download error:", e?.stderr || e?.message || e);
    const msg = typeof e?.message === "string" ? e.message : "Playlist download failed";
    res.status(500).json({ error: msg });
  }
};
