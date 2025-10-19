import type { RequestHandler } from "express";
import { z } from "zod";
import { SearchRequest, SearchResponse, SearchResult } from "@shared/api";
import { searchYouTube } from "../services/youtubeApi";

const SearchSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().min(1).max(50).default(10),
});

export const handleSearch: RequestHandler = async (req, res) => {
  console.log('Search request:', req.body);
  const parse = SearchSchema.safeParse(req.body);
  if (!parse.success) {
    console.error('Invalid search parameters:', parse.error);
    return res.status(400).json({ error: "Invalid search parameters" });
  }

  const { query, maxResults } = parse.data;

  try {
    console.log('Starting YouTube Data API search:', { query, maxResults });
    
    // Use YouTube Data API for search
    const results = await searchYouTube({
      query,
      maxResults,
      type: 'video',
      order: 'relevance'
    });
    
    const response: SearchResponse = {
      results,
    };
    
    console.log(`Search completed: ${results.length} results found`);
    res.json(response);
  } catch (e: any) {
    console.error("YouTube Data API search error:", e?.message || e);
    const msg = typeof e?.message === "string" ? e.message : "Search failed";
    res.status(500).json({ error: msg });
  }
};