# 🚀 YouTube Downloader - Cloud Deployment Guide

## **Prerequisites**
- YouTube Data API key
- Git repository (GitHub/GitLab)
- Cloud platform account

---

## **1. Railway (Recommended - Easiest)**

### Steps:
1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy on Railway**:
   - Go to [railway.app](https://railway.app)
   - Connect GitHub repo
   - Add environment variable: `YOUTUBE_API_KEY=your_key_here`
   - Deploy automatically

### Why Railway?
- ✅ Handles yt-dlp and ffmpeg automatically
- ✅ $5/month for generous usage
- ✅ Zero configuration needed

---

## **2. Render (Great Free Tier)**

### Steps:
1. **Create Render account**: [render.com](https://render.com)
2. **Connect GitHub repo**
3. **Configure**:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Add Environment Variables:
     ```
     YOUTUBE_API_KEY=your_key_here
     NODE_ENV=production
     ```

### Free Tier Limits:
- ✅ Free for 750 hours/month
- ⚠️  Spins down after 15min inactivity
- ✅ Automatic HTTPS

---

## **3. Docker + Any Cloud**

### Build & Deploy:
```bash
# Build Docker image
docker build -t youtube-downloader .

# Test locally
docker run -p 5000:5000 -e YOUTUBE_API_KEY=your_key youtube-downloader

# Deploy to any cloud that supports Docker:
# - Google Cloud Run
# - AWS Fargate  
# - DigitalOcean Apps
# - Fly.io
```

---

## **4. Vercel (Requires Modification)**

⚠️ **Note**: Vercel has limitations with binary dependencies (yt-dlp, ffmpeg)

You'll need to use serverless-friendly alternatives or external APIs.

---

## **Environment Variables Needed:**

```bash
YOUTUBE_API_KEY=your_youtube_api_key_here
NODE_ENV=production
PORT=5000
```

---

## **Post-Deployment Checklist:**

- [ ] YouTube API key configured
- [ ] HTTPS enabled
- [ ] Download functionality tested
- [ ] 4K video download tested
- [ ] Audio quality options tested
- [ ] Error handling working

---

## **Troubleshooting:**

### Common Issues:
1. **"yt-dlp not found"**: Use Docker deployment or Railway
2. **"ffmpeg not found"**: Make sure platform supports binary dependencies
3. **Large file timeouts**: Increase server timeout limits
4. **API rate limits**: Monitor YouTube API quota

### Platform-Specific Notes:
- **Railway**: Works out of the box
- **Render**: May need custom build script for binaries
- **Heroku**: Use buildpacks for Python/FFmpeg
- **Vercel**: Not recommended for binary dependencies

---

## **Monitoring & Scaling:**

- Monitor API usage (YouTube Data API has quotas)
- Set up error logging
- Consider CDN for static assets
- Monitor disk usage for temp files