import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { PlaylistInfoResponse, PlaylistSong, DownloadFormat, SimpleDownloadFormat, VideoQuality, QUALITY_OPTIONS, VIDEO_QUALITY_OPTIONS, SIMPLE_FORMAT_OPTIONS } from "@shared/api";
import { SearchPanel } from "@/components/SearchPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Search, Download, Youtube, Globe } from "lucide-react";

const simpleFormats = Object.entries(SIMPLE_FORMAT_OPTIONS).map(([key, value]) => ({
  value: key as SimpleDownloadFormat,
  label: value.label,
}));

export default function Index() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<SimpleDownloadFormat>("audio");
  const [audioQuality, setAudioQuality] = useState<DownloadFormat>("mp3-320");
  const [videoQuality, setVideoQuality] = useState<VideoQuality>("4k");
  const [loading, setLoading] = useState(false);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfoResponse | null>(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [pastedUrl, setPastedUrl] = useState("");

  const isPlaylistUrl = (url: string) => url.includes("list=");

  const fetchPlaylistInfo = useCallback(async () => {
    if (!url.trim() || !isPlaylistUrl(url.trim())) return;

    try {
      setPlaylistLoading(true);
      const res = await fetch("/api/playlist-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err?.error || `Request failed (${res.status})`);
      }

      const data: PlaylistInfoResponse = await res.json();
      setPlaylistInfo(data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to fetch playlist info");
      setPlaylistInfo(null);
    } finally {
      setPlaylistLoading(false);
    }
  }, [url]);

  const onDownload = useCallback(async () => {
    if (!url.trim()) {
      toast.error("Please paste a YouTube URL");
      return;
    }

    const isPlaylist = isPlaylistUrl(url.trim());
    const endpoint = isPlaylist ? "/api/playlist-download" : "/api/download";
    
    // Convert simple format to detailed format  
    const actualFormat = format === "audio" ? audioQuality : videoQuality;

    try {
      setLoading(true);
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: url.trim(), 
          format: actualFormat,
          type: format
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err?.error || `Request failed (${res.status})`);
      }

      const filename = isPlaylist
        ? `playlist.${format}.zip`
        : (res.headers
            .get("Content-Disposition")
            ?.split("filename=")?.[1]
            ?.replace(/^\"|\"$/g, "") || `audio.${format}`);

      const blob = await res.blob();
      const urlObject = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObject;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlObject);
      
      toast.success(`${isPlaylist ? "Playlist" : "File"} downloaded successfully!`);
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setLoading(false);
    }
  }, [url, format, audioQuality, videoQuality]);

  const handleSelectFromSearch = useCallback((searchUrl: string, title?: string) => {
    setUrl(searchUrl);
    setPlaylistInfo(null);
    if (isPlaylistUrl(searchUrl)) {
      fetchPlaylistInfo();
    }
    // Show toast to guide user
    toast.success(`URL added! Check the "Paste URL" section to download.`);
  }, [fetchPlaylistInfo]);

  const handleDirectDownload = useCallback(async (videoUrl: string, title?: string) => {
    try {
      setLoading(true);
      
      // Convert simple format to detailed format
      const actualFormat = format === "audio" ? audioQuality : videoQuality;
      
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: videoUrl, 
          format: actualFormat,
          type: format
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Download failed (${res.status})`);
      }

      const filename = res.headers
        .get("Content-Disposition")
        ?.split("filename=")?.[1]
        ?.replace(/^\"|\"$/g, "") || `audio.${format}`;

      const blob = await res.blob();
      const urlObject = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObject;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlObject);
      
      toast.success(`"${title || 'Video'}" downloaded successfully!`);
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setLoading(false);
    }
  }, [format, audioQuality, videoQuality]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container max-w-7xl py-4 md:py-6 lg:py-12 px-4">
        {/* Header */}
        <header className="text-center mb-6 md:mb-12 relative">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <div className="p-2 md:p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl md:rounded-2xl shadow-lg">
              <Youtube className="h-6 w-6 md:h-8 md:w-8 text-white" />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                YouTube Downloader
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Search, preview, and download YouTube videos instantly
              </p>
            </div>
          </div>
          <div className="absolute top-0 right-0">
            <ThemeToggle />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {/* Left Side - Search */}
          <div className="space-y-4 md:space-y-6">
            <Card className="border-0 shadow-lg md:shadow-xl bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Search className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  Search & Download
                </CardTitle>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Find any video or song on YouTube and download it instantly
                </p>
              </CardHeader>
              <CardContent className="space-y-4 px-4 md:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground min-w-fit">Format:</span>
                  <Select value={format} onValueChange={(v) => setFormat(v as SimpleDownloadFormat)}>
                    <SelectTrigger className="w-full sm:w-28 h-10 md:h-8 border-0 bg-background/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {simpleFormats.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.value === "audio" ? "🎵 Audio" : "🎬 Video"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {format === "audio" && (
                    <>
                      <span className="text-sm font-medium text-muted-foreground min-w-fit">Quality:</span>
                      <Select value={audioQuality} onValueChange={(v) => setAudioQuality(v as DownloadFormat)}>
                        <SelectTrigger className="w-full sm:w-44 h-10 md:h-8 border-0 bg-background/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(QUALITY_OPTIONS).map(([key, option]) => (
                            <SelectItem key={key} value={key}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  
                  {format === "video" && (
                    <>
                      <span className="text-sm font-medium text-muted-foreground min-w-fit">Quality:</span>
                      <Select value={videoQuality} onValueChange={(v) => setVideoQuality(v as VideoQuality)}>
                        <SelectTrigger className="w-full sm:w-44 h-10 md:h-8 border-0 bg-background/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(VIDEO_QUALITY_OPTIONS).map(([key, option]) => (
                            <SelectItem key={key} value={key}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
                <SearchPanel 
                  onSelectVideo={handleSelectFromSearch}
                  onDirectDownload={handleDirectDownload}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Side - URL Paste & Playlist */}
          <div className="space-y-4 md:space-y-6">
            <Card className="border-0 shadow-lg md:shadow-xl bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3 md:pb-4 px-4 md:px-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Globe className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  Paste URL
                </CardTitle>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Have a YouTube URL? Paste it here for direct download
                </p>
              </CardHeader>
              <CardContent className="space-y-4 px-4 md:px-6">
                <div className="space-y-3">
                  <Input
                    placeholder="https://youtube.com/watch?v=... or playlist URL"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setPlaylistInfo(null);
                    }}
                    onBlur={fetchPlaylistInfo}
                    className="h-12 text-base border-2 focus:border-primary/50"
                  />
                  
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <Select value={format} onValueChange={(v) => setFormat(v as SimpleDownloadFormat)}>
                          <SelectTrigger className="w-full sm:w-32 h-12 sm:h-10">
                            <SelectValue />
                          </SelectTrigger>
                        <SelectContent>
                          {simpleFormats.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                        {format === "audio" && (
                          <Select value={audioQuality} onValueChange={(v) => setAudioQuality(v as DownloadFormat)}>
                            <SelectTrigger className="flex-1 h-12 sm:h-10">
                              <SelectValue />
                            </SelectTrigger>
                          <SelectContent>
                            {Object.entries(QUALITY_OPTIONS).map(([key, option]) => (
                              <SelectItem key={key} value={key}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                        {format === "video" && (
                          <Select value={videoQuality} onValueChange={(v) => setVideoQuality(v as VideoQuality)}>
                            <SelectTrigger className="flex-1 h-12 sm:h-10">
                              <SelectValue />
                            </SelectTrigger>
                          <SelectContent>
                            {Object.entries(VIDEO_QUALITY_OPTIONS).map(([key, option]) => (
                              <SelectItem key={key} value={key}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-center sm:justify-end">
                      <Button
                      onClick={onDownload}
                      disabled={loading || playlistLoading || !url.trim()}
                      className="w-full sm:w-auto px-8 h-12 sm:h-10 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-base sm:text-sm"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                          <span>Downloading...</span>
                        </div>
                      ) : playlistInfo ? (
                        `Download All (${playlistInfo.songs.length})`
                      ) : (
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </div>
                      )}
                    </Button>
                    </div>
                  </div>
                </div>

                {/* Playlist Preview */}
                {playlistInfo && (
                  <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold text-base">{playlistInfo.title}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {playlistInfo.songs.length} songs
                      </Badge>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {playlistInfo.songs.slice(0, 10).map((song, index) => (
                        <div key={song.id} className="flex items-center gap-3 p-2 bg-background/50 rounded text-sm">
                          <span className="text-xs text-muted-foreground w-6 text-center">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{song.title}</p>
                            {song.duration && (
                              <p className="text-xs text-muted-foreground">{song.duration}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {playlistInfo.songs.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          ... and {playlistInfo.songs.length - 10} more songs
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">⚡</p>
                    <p className="text-sm font-medium">Lightning Fast</p>
                    <p className="text-xs text-muted-foreground">YouTube Data API</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">🎵</p>
                    <p className="text-sm font-medium">High Quality</p>
                    <p className="text-xs text-muted-foreground">Audio & Video</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
