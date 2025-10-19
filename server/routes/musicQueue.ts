import type { RequestHandler } from "express";
import { z } from "zod";
import { musicQueueManager } from "../queue/MusicQueueManager";
import { AddToMusicQueueRequest, ReorderMusicQueueRequest } from "@shared/api";

const AddToQueueSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  thumbnail: z.string().optional(),
  duration: z.string().optional(),
  channelTitle: z.string().optional(),
});

const ReorderQueueSchema = z.object({
  fromIndex: z.number().min(0),
  toIndex: z.number().min(0),
});

// GET /api/music-queue - Get current music queue status
export const handleMusicQueueStatus: RequestHandler = (req, res) => {
  const status = musicQueueManager.getQueueStatus();
  res.json(status);
};

// POST /api/music-queue - Add item to music queue
export const handleAddToMusicQueue: RequestHandler = (req, res) => {
  const parse = AddToQueueSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Invalid queue item data" });
  }

  const itemId = musicQueueManager.addToQueue(parse.data);
  res.json({ success: true, itemId });
};

// DELETE /api/music-queue/:itemId - Remove item from music queue
export const handleRemoveFromMusicQueue: RequestHandler = (req, res) => {
  const { itemId } = req.params;
  const success = musicQueueManager.removeFromQueue(itemId);
  
  if (!success) {
    return res.status(404).json({ error: "Item not found in queue" });
  }
  
  res.json({ success: true });
};

// PUT /api/music-queue/reorder - Reorder queue items
export const handleReorderMusicQueue: RequestHandler = (req, res) => {
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
};

// POST /api/music-queue/play/:itemId - Play specific item
export const handlePlayMusicItem: RequestHandler = (req, res) => {
  const { itemId } = req.params;
  const item = musicQueueManager.playItem(itemId);
  
  if (!item) {
    return res.status(404).json({ error: "Item not found in queue" });
  }
  
  res.json({ success: true, nowPlaying: item });
};

// POST /api/music-queue/next - Play next item
export const handlePlayNext: RequestHandler = (req, res) => {
  const item = musicQueueManager.playNext();
  res.json({ success: true, nowPlaying: item });
};

// POST /api/music-queue/previous - Play previous item
export const handlePlayPrevious: RequestHandler = (req, res) => {
  const item = musicQueueManager.playPrevious();
  res.json({ success: true, nowPlaying: item });
};

// POST /api/music-queue/play-status - Set playing status
export const handleSetPlayingStatus: RequestHandler = (req, res) => {
  const { playing } = req.body;
  if (typeof playing !== "boolean") {
    return res.status(400).json({ error: "Playing status must be boolean" });
  }
  
  musicQueueManager.setPlayingStatus(playing);
  res.json({ success: true });
};

// DELETE /api/music-queue - Clear entire queue
export const handleClearMusicQueue: RequestHandler = (req, res) => {
  musicQueueManager.clearQueue();
  res.json({ success: true });
};