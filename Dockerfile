# Use Node.js Alpine for smaller image
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl

# Create virtual environment and install yt-dlp
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install yt-dlp \
    && ln -s /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp

# Create app directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install ALL dependencies (including dev deps for build)
RUN npm install

# Copy source code
COPY . .

# Build the client
RUN npm run build

# Create temp directory for downloads
RUN mkdir -p /tmp/downloads && chmod 777 /tmp/downloads

# Expose port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV TMPDIR=/tmp/downloads

# Start the application
CMD ["npm", "start"]