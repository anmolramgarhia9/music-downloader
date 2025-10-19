import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer as createHttpServer } from "http";
import { setupWebSocket } from "./websocket";
import { handleDemo } from "./routes/demo";
import { handleDownload } from "./routes/download";
import { handlePlaylistInfo, handlePlaylistDownload } from "./routes/playlist";
import { handleSearch } from "./routes/search";
import { 
  handleQueueStatus, 
  handleQueuePause, 
  handleQueueResume, 
  handleQueueRemove, 
  handleQueueClear 
} from "./routes/queue";
import {
  handleMusicQueueStatus,
  handleAddToMusicQueue,
  handleRemoveFromMusicQueue,
  handleReorderMusicQueue,
  handlePlayMusicItem,
  handlePlayNext,
  handlePlayPrevious,
  handleSetPlayingStatus,
  handleClearMusicQueue
} from "./routes/musicQueue";
import { queueManager } from "./queue/QueueManager";
import { musicQueueManager } from "./queue/MusicQueueManager";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/download", handleDownload);
  app.post("/api/playlist-info", handlePlaylistInfo);
  app.post("/api/playlist-download", handlePlaylistDownload);
  
  // Search routes
  app.post("/api/search", handleSearch);
  
  // Download queue management routes
  app.get("/api/queue", handleQueueStatus);
  app.post("/api/queue/:itemId/pause", handleQueuePause);
  app.post("/api/queue/:itemId/resume", handleQueueResume);
  app.delete("/api/queue/:itemId", handleQueueRemove);
  app.post("/api/queue/clear-completed", handleQueueClear);

  // Music queue management routes
  app.get("/api/music-queue", handleMusicQueueStatus);
  app.post("/api/music-queue", handleAddToMusicQueue);
  app.delete("/api/music-queue/:itemId", handleRemoveFromMusicQueue);
  app.put("/api/music-queue/reorder", handleReorderMusicQueue);
  app.post("/api/music-queue/play/:itemId", handlePlayMusicItem);
  app.post("/api/music-queue/next", handlePlayNext);
  app.post("/api/music-queue/previous", handlePlayPrevious);
  app.post("/api/music-queue/play-status", handleSetPlayingStatus);
  app.delete("/api/music-queue", handleClearMusicQueue);

  return app;
}

export function createServerWithWebSocket() {
  const app = createServer();
  const server = createHttpServer(app);
  setupWebSocket(server);
  return server;
}
