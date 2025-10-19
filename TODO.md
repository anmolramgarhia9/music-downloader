# TODO: Enhance YouTube Music Downloader for Playlist Support

## Steps to Complete

- [x] Add archiver dependency to package.json for zipping files
- [x] Update shared/api.ts with new types for playlist info and download
- [x] Add new route /api/playlist-info in server/index.ts
- [x] Create server/routes/playlist.ts for fetching playlist info and handling zip download
- [x] Update server/routes/download.ts to support playlist zip download
- [x] Update client/pages/Index.tsx to detect playlist URLs, fetch and display songs, add download all button

## Progress Tracking

- [ ] Step 1: Add archiver dependency
- [ ] Step 2: Update shared types
- [ ] Step 3: Add playlist-info route
- [ ] Step 4: Create playlist.ts route handler
- [ ] Step 5: Modify download.ts for playlists
- [ ] Step 6: Update client UI for playlists
