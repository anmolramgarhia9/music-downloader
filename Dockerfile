# Use Node.js Alpine for smaller image
FROM node:18-alpine

# Install system dependencies for yt-dlp and ffmpeg
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    && pip3 install yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared ./shared

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server ./server
COPY client ./client
COPY *.json *.js ./

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