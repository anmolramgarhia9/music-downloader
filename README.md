# YouTube Downloader

A modern, full-stack YouTube downloader web application built with React, TypeScript, Express, and yt-dlp.

## 🚀 Features

- **Search & Discovery**: Search YouTube videos with YouTube Data API v3
- **Direct Downloads**: Download individual videos in multiple audio/video formats
- **Playlist Support**: Bulk download entire YouTube playlists as ZIP files
- **Multiple Formats**: MP3, M4A, WAV, FLAC, OPUS audio + MP4 video
- **Quality Options**: Various bitrate and resolution presets
- **Optimized Performance**: Parallel downloads, caching, and FFmpeg processing
- **Modern UI**: Clean, responsive interface with dark/light theme
- **Real-time Progress**: WebSocket-based download progress updates
- **Queue Management**: Background download queuing system

## 🛠️ Tech Stack

### Frontend

- **React 18** with TypeScript
- **Vite** for fast development and building
- **shadcn/ui** for modern UI components
- **Tailwind CSS** for styling
- **Sonner** for toast notifications

### Backend

- **Express.js** with TypeScript
- **yt-dlp** for YouTube downloading
- **FFmpeg** for media processing
- **YouTube Data API v3** for search functionality
- **WebSocket** for real-time updates

### Infrastructure

- **ngrok** for public tunneling
- **Archiver** for ZIP file creation
- **Zod** for request validation

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **ngrok** (for public access)
- **YouTube Data API Key** (optional, falls back to yt-dlp)

## 🚀 Quick Start

### Option 1: One-Click Windows Launcher (Recommended)

1. **Double-click `start-app.bat`** (or run `start-app.ps1` in PowerShell)
2. The script will automatically:
   - Start the development server (`npm run dev`)
   - Launch ngrok tunnel (`ngrok http 8080`)
   - Open both in separate command windows

### Option 2: Manual Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start development server:**

   ```bash
   npm run dev
   ```

3. **Start ngrok tunnel (in separate terminal):**

   ```bash
   ngrok http 8080
   ```

4. **Access the app:**
   - Local: http://localhost:8080
   - Public: Use the ngrok URL (e.g., https://xxxxx.ngrok-free.dev)

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# YouTube Data API Key (optional)
YOUTUBE_API_KEY=your_api_key_here

# Ping message for health check
PING_MESSAGE=Hello from YouTube Downloader

# yt-dlp settings (optional)
YTDLP_COOKIES=path/to/cookies.txt
YTDLP_PROXY=http://127.0.0.1:8080
YTDLP_SOCKET_TIMEOUT=15
YTDLP_TIMEOUT_MS=300000

# Debug mode
DEBUG_YTDLP=0
```

### YouTube API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create credentials (API Key)
5. Add the API key to your `.env` file

## 📁 Project Structure

```
vortex-works/
├── client/                 # React frontend
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   └── ...
├── server/                # Express backend
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic services
│   ├── queue/             # Download queue management
│   └── ...
├── shared/                # Shared types and utilities
├── public/                # Static assets
├── start-app.bat          # Windows batch launcher
├── start-app.ps1          # PowerShell launcher
└── package.json
```

## 🎯 Usage

### Searching Videos

1. Use the search bar to find YouTube videos
2. Click "Add URL" to add videos to the download queue
3. Or click "Download" for immediate download

### Direct URL Download

1. Paste a YouTube URL in the "Paste URL" section
2. Select format (Audio/Video) and quality
3. Click "Download" to start downloading

### Playlist Downloads

1. Paste a YouTube playlist URL
2. The app will show playlist preview with song count
3. Click "Download All" to download entire playlist as ZIP

## 🔄 API Endpoints

### Core Endpoints

- `GET /api/ping` - Health check
- `POST /api/search` - Search YouTube videos
- `POST /api/download` - Download single video
- `POST /api/playlist-info` - Get playlist information
- `POST /api/playlist-download` - Download entire playlist

### Queue Management

- `GET /api/queue` - Get download queue status
- `POST /api/queue/:itemId/pause` - Pause download
- `POST /api/queue/:itemId/resume` - Resume download
- `DELETE /api/queue/:itemId` - Remove from queue
- `POST /api/queue/clear-completed` - Clear completed downloads

### Music Queue (UI Only)

- `GET /api/music-queue` - Get music queue
- `POST /api/music-queue` - Add to music queue
- `DELETE /api/music-queue/:itemId` - Remove from music queue
- `PUT /api/music-queue/reorder` - Reorder music queue

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Windows Launchers
./start-app.bat      # Launch with ngrok (Windows)
./start-app.ps1      # Launch with ngrok (PowerShell)
```

### Building for Production

```bash
npm run build
npm run preview
```

## 🔒 Security & Performance

- **Rate Limiting**: Built-in request throttling
- **Input Validation**: Zod schema validation for all requests
- **Error Handling**: Comprehensive error handling with fallbacks
- **Caching**: Intelligent file caching with TTL
- **Concurrent Downloads**: Parallel processing for better performance
- **Resource Cleanup**: Automatic cleanup of temporary files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for educational purposes only. Please respect YouTube's Terms of Service and copyright laws.

## ⚠️ Disclaimer

This application is intended for personal use only. Downloading copyrighted content may violate YouTube's Terms of Service and local copyright laws. Use at your own risk.

## 🆘 Troubleshooting

### Common Issues

**ngrok not found:**

- Install ngrok from https://ngrok.com/download
- Add ngrok to your system PATH

**Port 8080 already in use:**

- Kill the process using port 8080
- Or change the port in `vite.config.ts`

**YouTube API quota exceeded:**

- The app will automatically fall back to yt-dlp
- Consider getting a YouTube Data API key for better search results

**Download fails:**

- Check your internet connection
- Try a different video/playlist
- Some videos may be region-locked or private

### Getting Help

- Check the terminal output for error messages
- Ensure all dependencies are installed
- Verify your environment variables are set correctly

---

**Happy downloading! 🎵📥**
