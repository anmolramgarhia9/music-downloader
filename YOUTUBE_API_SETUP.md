# YouTube Data API Setup

This application uses the YouTube Data API v3 for fast and reliable search functionality. While it can fallback to yt-dlp for search when no API key is provided, using the YouTube Data API is recommended for better performance and reliability.

## Getting a YouTube Data API Key

1. **Go to Google Cloud Console**: Visit [https://console.developers.google.com/](https://console.developers.google.com/)

2. **Create a new project** (or select existing one):
   - Click "Select a project" → "NEW PROJECT"
   - Enter a project name (e.g., "YouTube Music Downloader")
   - Click "CREATE"

3. **Enable YouTube Data API v3**:
   - Go to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click on it and press "ENABLE"

4. **Create API credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "CREATE CREDENTIALS" → "API key"
   - Copy the generated API key

5. **Configure the application**:
   - Open the `.env` file in the project root
   - Replace `your_youtube_api_key_here` with your actual API key:
     ```
     YOUTUBE_API_KEY=AIzaSyYourActualAPIKeyHere
     ```

## API Quotas

The YouTube Data API has daily quotas:
- **Free tier**: 10,000 units per day
- **Search operation**: ~100 units per request
- This allows ~100 searches per day

If you exceed the quota, the application will automatically fallback to yt-dlp for search.

## Fallback Behavior

- **With API key**: Fast YouTube Data API search
- **Without API key or quota exceeded**: Automatic fallback to yt-dlp search
- **Downloads**: Always use yt-dlp (more reliable for actual downloading)

## Benefits of YouTube Data API

- ⚡ **Faster searches** (< 1 second vs 5-10 seconds with yt-dlp)
- 📊 **Better metadata** (accurate view counts, high-quality thumbnails)
- 🚀 **More reliable** (less likely to be blocked or rate-limited)
- 🔍 **Advanced search** (can search by categories, dates, etc.)

The application works perfectly without an API key, but the search experience will be significantly better with one!