import type { RequestHandler } from "express";
import { queueManager } from "../queue/QueueManager";
import { QueueStatusResponse } from "@shared/api";

export const handleQueueStatus: RequestHandler = (req, res) => {
  const status = queueManager.getQueueStatus();
  res.json(status);
};

export const handleQueuePause: RequestHandler = (req, res) => {
  const { itemId } = req.params;
  queueManager.pauseItem(itemId);
  res.json({ success: true });
};

export const handleQueueResume: RequestHandler = (req, res) => {
  const { itemId } = req.params;
  queueManager.resumeItem(itemId);
  res.json({ success: true });
};

export const handleQueueRemove: RequestHandler = (req, res) => {
  const { itemId } = req.params;
  queueManager.removeItem(itemId);
  res.json({ success: true });
};

export const handleQueueClear: RequestHandler = (req, res) => {
  queueManager.clearCompleted();
  res.json({ success: true });
};