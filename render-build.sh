#!/bin/bash
echo "🔧 Starting Render build process..."

# Install Python and yt-dlp
echo "📦 Installing system dependencies..."
apt-get update -y
apt-get install -y python3 python3-pip ffmpeg

# Install yt-dlp globally
echo "📺 Installing yt-dlp..."
pip3 install yt-dlp

# Install Node.js dependencies (including dev dependencies for build)
echo "📦 Installing npm dependencies..."
npm install

# Build the client using npx to ensure vite is found
echo "🏗️ Building client..."
npx vite build

echo "✅ Build completed successfully!"
