import type { RequestHandler } from "express";
import { z } from "zod";
import path from "node:path";
import { QUALITY_OPTIONS } from "@shared/api";
import { queueManager } from "../queue/QueueManager";
import os from "node:os";
import fs from "node:fs";
import fsp from "node:fs/promises";
import ytdlp from "yt-dlp-exec";
import ffmpegPath from "ffmpeg-static";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const BodySchema = z.object({
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

export { isPlaylistUrl };

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
    default:
      return "application/octet-stream";
  }
}

async function findOutputFile(dir: string, prefix: string, ext: string) {
  const files = await fsp.readdir(dir);
  const match = files.find((f) => f.startsWith(prefix) && f.toLowerCase().endsWith("." + ext));
  return match ? path.join(dir, match) : null;
}

export const handleDownload: RequestHandler = async (req, res) => {
  const parse = BodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { url, format } = parse.data;
  if (!isYouTubeUrl(url)) {
    return res.status(400).json({ error: "Only YouTube URLs are supported" });
  }

  if (isPlaylistUrl(url)) {
    return res.status(400).json({ error: "Playlist URLs are not supported for single download. Use playlist download endpoint." });
  }

  const qualityConfig = QUALITY_OPTIONS[format];
  if (!qualityConfig) {
    return res.status(400).json({ error: "Invalid format specified" });
  }

  const tmpDir = os.tmpdir();
  const uniquePrefix = `ytmd-${Date.now()}-`;
  const template = path.join(tmpDir, `${uniquePrefix}%(title)s.%(ext)s`);

  try {
    // Use direct command execution for Windows compatibility
    const ytdlpPath = process.platform === 'win32' 
      ? path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
      : 'yt-dlp';
    
    const ffmpegArg = ffmpegPath ? `--ffmpeg-location "${ffmpegPath}"` : '';
    const qualityArg = qualityConfig.quality !== '0' ? `--audio-quality ${qualityConfig.quality}` : '--audio-quality 0';
    const command = `"${ytdlpPath}" "${url}" --extract-audio --audio-format ${qualityConfig.format} ${qualityArg} --no-playlist --output "${template}" ${ffmpegArg} --no-warnings`;
    
    console.log('Executing:', command);
    await execAsync(command);

    const filePath = await findOutputFile(tmpDir, uniquePrefix, qualityConfig.format);
    if (!filePath) {
      throw new Error("Failed to locate output file");
    }

    const fileName = path.basename(filePath);
    const stat = await fsp.stat(filePath);

    res.setHeader("Content-Type", getContentType(qualityConfig.format));
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("X-Filename", fileName);

    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      res.destroy(err);
    });

    res.on("close", async () => {
      try {
        await fsp.unlink(filePath);
      } catch (e) {
        // ignore
      }
    });

    stream.pipe(res);
  } catch (e: any) {
    console.error("yt-dlp error:", e?.stderr || e?.message || e);
    const msg = typeof e?.message === "string" ? e.message : "Download failed";
    res.status(500).json({ error: msg });
  }
};
