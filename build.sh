#!/bin/bash
# Install system dependencies for free hosting
apt-get update
apt-get install -y python3 python3-pip ffmpeg

# Install yt-dlp
pip3 install yt-dlp

# Install npm dependencies
npm install

# Build the application
npm run build