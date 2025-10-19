#!/bin/bash
echo "🔧 Starting Render build process..."

# Install Python and yt-dlp
echo "📦 Installing system dependencies..."
apt-get update -y
apt-get install -y python3 python3-pip ffmpeg

# Install yt-dlp globally
echo "📺 Installing yt-dlp..."
pip3 install yt-dlp

# Install Node.js dependencies
echo "📦 Installing npm dependencies..."
npm ci --production

# Build the client
echo "🏗️ Building client..."
npm run build:client

# Build the server
echo "🏗️ Building server..."
npm run build:server

echo "✅ Build completed successfully!"