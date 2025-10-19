import { google } from 'googleapis';
import { SearchResult } from '@shared/api';
import { spawn } from 'child_process';
import path from 'node:path';

const API_KEY = process.env.YOUTUBE_API_KEY;
const hasValidApiKey = API_KEY && API_KEY !== 'your_youtube_api_key_here' && API_KEY !== 'AIzaSyDemoKeyPleaseReplaceWithReal';

let youtube: any = null;
if (hasValidApiKey) {
  youtube = google.youtube({
    version: 'v3',
    auth: API_KEY
  });
  console.log('YouTube Data API initialized with API key');
} else {
  console.log('No valid YouTube API key found, will fallback to yt-dlp for search');
}

export interface YouTubeSearchOptions {
  query: string;
  maxResults?: number;
  type?: 'video' | 'channel' | 'playlist';
  order?: 'relevance' | 'date' | 'rating' | 'viewCount' | 'title';
}

async function searchYouTubeWithYtDlp(options: YouTubeSearchOptions): Promise<SearchResult[]> {
  const { query, maxResults = 10 } = options;
  
  console.log('Using yt-dlp fallback for search:', { query, maxResults });
  
  const ytdlpPath = process.platform === 'win32' 
    ? path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
    : 'yt-dlp';
  
  const args = [
    `ytsearch${maxResults}:${query}`,
    '--dump-json',
    '--no-warnings',
    '--quiet'
  ];
  
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpPath, args, { 
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const lines = stdout.trim().split('\n');
          const jsonLines = lines.filter(line => line.trim().startsWith('{'));
          const results: SearchResult[] = [];
          
          for (const line of jsonLines) {
            try {
              const info = JSON.parse(line);
              
              if (info.id && info.title && info.webpage_url) {
                const thumbnailUrl = info.thumbnails && info.thumbnails.length > 0 
                  ? info.thumbnails[info.thumbnails.length - 1].url 
                  : info.thumbnail || '';
                
                const duration = info.duration 
                  ? `${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}` 
                  : undefined;
                
                results.push({
                  id: info.id,
                  title: info.title,
                  url: info.webpage_url,
                  thumbnail: thumbnailUrl,
                  duration,
                  viewCount: info.view_count,
                  channelTitle: info.uploader || info.channel || 'Unknown',
                  publishedAt: info.upload_date,
                });
              }
            } catch (parseError) {
              console.log('Failed to parse yt-dlp result:', parseError);
            }
          }
          
          console.log(`yt-dlp search completed: ${results.length} results found`);
          resolve(results);
        } catch (error) {
          reject(new Error(`Failed to parse yt-dlp output: ${error}`));
        }
      } else {
        reject(new Error(`yt-dlp exited with code ${code}. stderr: ${stderr}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
    
    // Set timeout for search
    setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Search timeout'));
    }, 30000);
  });
}

export async function searchYouTube(options: YouTubeSearchOptions): Promise<SearchResult[]> {
  const { query, maxResults = 10, type = 'video', order = 'relevance' } = options;

  // Use YouTube Data API if available, otherwise fallback to yt-dlp
  if (hasValidApiKey && youtube) {
    try {
      console.log('YouTube API search:', { query, maxResults, type, order });

      // First, search for videos
      const searchResponse = await youtube.search.list({
        part: ['snippet'],
        q: query,
        maxResults,
        type: [type],
        order,
        videoCategoryId: type === 'video' ? '10' : undefined, // Music category
        regionCode: 'US',
      });

      const items = searchResponse.data.items || [];
      console.log(`Found ${items.length} items from YouTube API`);

      if (items.length === 0) {
        return [];
      }

      // Get video IDs for detailed information
      const videoIds = items
        .filter(item => item.id?.videoId)
        .map(item => item.id!.videoId!)
        .filter(Boolean);

      if (videoIds.length === 0) {
        return [];
      }

      // Get video details (duration, view count, etc.)
      const videosResponse = await youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: videoIds,
      });

      const videoDetails = videosResponse.data.items || [];
      console.log(`Got details for ${videoDetails.length} videos`);

      // Combine search results with video details
      const results: SearchResult[] = [];

      for (const item of items) {
        if (!item.id?.videoId) continue;

        const videoId = item.id.videoId;
        const details = videoDetails.find(v => v.id === videoId);
        
        const snippet = item.snippet!;
        const thumbnails = snippet.thumbnails;
        
        // Get the best quality thumbnail available
        const thumbnail = thumbnails?.maxres?.url || 
                         thumbnails?.high?.url || 
                         thumbnails?.medium?.url || 
                         thumbnails?.default?.url || '';

        // Parse duration from ISO 8601 format (PT4M13S -> 4:13)
        let duration: string | undefined;
        if (details?.contentDetails?.duration) {
          duration = parseDuration(details.contentDetails.duration);
        }

        // Parse view count
        const viewCount = details?.statistics?.viewCount ? 
          parseInt(details.statistics.viewCount) : undefined;

        results.push({
          id: videoId,
          title: snippet.title || 'Untitled',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail,
          duration,
          viewCount,
          channelTitle: snippet.channelTitle || 'Unknown',
          publishedAt: snippet.publishedAt || undefined,
        });
      }

      console.log(`Returning ${results.length} search results from YouTube API`);
      return results;

    } catch (error: any) {
      console.error('YouTube API error, falling back to yt-dlp:', error?.message);
      
      if (error.code === 403) {
        console.log('API quota exceeded, using yt-dlp fallback');
      }
      
      // Fallback to yt-dlp on API error
      return searchYouTubeWithYtDlp(options);
    }
  } else {
    // Use yt-dlp fallback
    return searchYouTubeWithYtDlp(options);
  }
}

/**
 * Parse YouTube duration from ISO 8601 format (PT4M13S) to MM:SS format
 */
function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Extract playlist ID from YouTube URL
 */
function extractPlaylistId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('list');
  } catch {
    return null;
  }
}

/**
 * Get playlist information using YouTube Data API
 */
export async function getPlaylistInfo(playlistUrl: string) {
  const playlistId = extractPlaylistId(playlistUrl);
  
  if (!playlistId) {
    throw new Error('Invalid playlist URL');
  }

  // Use YouTube Data API if available, otherwise fallback to yt-dlp
  if (hasValidApiKey && youtube) {
    try {
      console.log('Getting playlist info via YouTube API:', playlistId);

      // Get playlist details
      const playlistResponse = await youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        id: [playlistId],
      });

      const playlist = playlistResponse.data.items?.[0];
      if (!playlist) {
        throw new Error('Playlist not found');
      }

      // Get playlist items
      const playlistItemsResponse = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: playlistId,
        maxResults: 50, // YouTube API limit per request
      });

      const items = playlistItemsResponse.data.items || [];
      
      // Get video IDs for detailed information
      const videoIds = items
        .filter(item => item.contentDetails?.videoId)
        .map(item => item.contentDetails!.videoId!)
        .filter(Boolean);

      if (videoIds.length === 0) {
        return {
          title: playlist.snippet?.title || 'Unknown Playlist',
          songs: []
        };
      }

      // Get video details in batches (YouTube API allows up to 50 IDs per request)
      const videos: any[] = [];
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50);
        const videosResponse = await youtube.videos.list({
          part: ['snippet', 'contentDetails', 'statistics'],
          id: batch,
        });
        videos.push(...(videosResponse.data.items || []));
      }

      console.log(`Got playlist info: ${playlist.snippet?.title}, ${videos.length} videos`);

      // Format the results
      const songs = videos.map(video => {
        const snippet = video.snippet;
        const duration = video.contentDetails?.duration 
          ? parseDuration(video.contentDetails.duration) 
          : undefined;

        return {
          id: video.id,
          title: snippet?.title || 'Untitled',
          url: `https://www.youtube.com/watch?v=${video.id}`,
          duration,
          artist: snippet?.channelTitle || 'Unknown',
          album: playlist.snippet?.title,
          thumbnail: snippet?.thumbnails?.medium?.url || 
                    snippet?.thumbnails?.default?.url || '',
          viewCount: video.statistics?.viewCount ? 
            parseInt(video.statistics.viewCount) : undefined,
          uploadDate: snippet?.publishedAt,
          description: snippet?.description?.substring(0, 200) + '...' || undefined,
        };
      });

      return {
        title: playlist.snippet?.title || 'Unknown Playlist',
        songs
      };

    } catch (error: any) {
      console.error('YouTube API playlist error, falling back to yt-dlp:', error?.message);
      
      if (error.code === 403) {
        console.log('API quota exceeded for playlist, using yt-dlp fallback');
      }
      
      // Fallback to yt-dlp
      return getPlaylistInfoWithYtDlp(playlistUrl);
    }
  } else {
    // Use yt-dlp fallback
    return getPlaylistInfoWithYtDlp(playlistUrl);
  }
}

/**
 * Get playlist info using yt-dlp fallback
 */
async function getPlaylistInfoWithYtDlp(playlistUrl: string) {
  console.log('Using yt-dlp fallback for playlist info:', playlistUrl);
  
  const ytdlpPath = process.platform === 'win32' 
    ? path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
    : 'yt-dlp';
  
  const args = [
    playlistUrl,
    '--dump-json',
    '--flat-playlist',
    '--no-warnings'
  ];
  
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpPath, args, { 
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const lines = stdout.trim().split('\n');
          const jsonLines = lines.filter(line => line.trim().startsWith('{'));
          
          if (jsonLines.length === 0) {
            throw new Error('No JSON data found in yt-dlp output');
          }
          
          let playlistTitle = 'YouTube Playlist';
          let songs: any[] = [];
          
          for (const line of jsonLines) {
            try {
              const info = JSON.parse(line);
              
              if (info._type === 'playlist' || info.entries) {
                playlistTitle = info.title || info.playlist_title || 'YouTube Playlist';
                if (info.entries) {
                  songs = info.entries.map((entry: any) => ({
                    id: entry.id,
                    title: entry.title,
                    url: `https://www.youtube.com/watch?v=${entry.id}`,
                    duration: entry.duration 
                      ? `${Math.floor(entry.duration / 60)}:${(entry.duration % 60).toString().padStart(2, '0')}` 
                      : undefined,
                    artist: entry.uploader || entry.channel,
                    thumbnail: entry.thumbnail,
                    viewCount: entry.view_count,
                    uploadDate: entry.upload_date,
                    description: entry.description ? entry.description.substring(0, 200) + '...' : undefined,
                  }));
                }
              } else if (info._type === 'url' || info.id) {
                songs.push({
                  id: info.id,
                  title: info.title,
                  url: `https://www.youtube.com/watch?v=${info.id}`,
                  duration: info.duration 
                    ? `${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}` 
                    : undefined,
                  artist: info.uploader || info.channel,
                  thumbnail: info.thumbnail,
                  viewCount: info.view_count,
                  uploadDate: info.upload_date,
                  description: info.description ? info.description.substring(0, 200) + '...' : undefined,
                });
                
                if (info.playlist_title) {
                  playlistTitle = info.playlist_title;
                }
              }
            } catch (parseError) {
              console.log('Failed to parse yt-dlp playlist line:', parseError);
            }
          }
          
          if (songs.length === 0) {
            throw new Error('No songs found in playlist');
          }
          
          console.log(`yt-dlp playlist info completed: ${playlistTitle}, ${songs.length} songs`);
          
          resolve({
            title: playlistTitle,
            songs,
          });
        } catch (error) {
          reject(new Error(`Failed to parse yt-dlp playlist output: ${error}`));
        }
      } else {
        reject(new Error(`yt-dlp playlist failed with code ${code}. stderr: ${stderr}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
    
    // Set timeout
    setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Playlist info timeout'));
    }, 60000); // 60 second timeout for playlists
  });
}

/**
 * Get video information by video ID
 */
export async function getVideoInfo(videoId: string) {
  try {
    const response = await youtube.videos.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      id: [videoId],
    });

    const video = response.data.items?.[0];
    if (!video) {
      throw new Error('Video not found');
    }

    return {
      id: video.id!,
      title: video.snippet?.title || 'Untitled',
      url: `https://www.youtube.com/watch?v=${video.id}`,
      thumbnail: video.snippet?.thumbnails?.maxres?.url || 
                video.snippet?.thumbnails?.high?.url || '',
      duration: video.contentDetails?.duration ? 
        parseDuration(video.contentDetails.duration) : undefined,
      viewCount: video.statistics?.viewCount ? 
        parseInt(video.statistics.viewCount) : undefined,
      channelTitle: video.snippet?.channelTitle || 'Unknown',
      publishedAt: video.snippet?.publishedAt || undefined,
      description: video.snippet?.description || undefined,
    };
  } catch (error: any) {
    console.error('YouTube API getVideoInfo error:', error);
    throw new Error(`Failed to get video info: ${error.message}`);
  }
}