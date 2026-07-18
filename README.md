# Local Stream Tester

A local Express application for testing movie and TV playback through the configured provider extractors. The browser UI requests all enabled providers concurrently, plays the first successful result, and lets you switch to another ready provider.

This is a local development tool. Provider availability, catalog coverage, and playback behavior can change without notice. Use it only with content and services you are authorized to access.

## Features

- Movie and TV episode lookup by TMDB ID
- Concurrent extraction with provider status tabs
- HLS playback through hls.js and native MP4 playback
- Local proxy for media playlists, segments, and captions
- Two-hour in-memory stream cache
- Configurable Nxsha language, subtitle, and server options

## Requirements

- Node.js 18 or later
- npm
- Playwright Chromium, for the extractors that use browser automation

## Install and run

```bash
npm install
npx playwright install chromium
npm start
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

To use a different port:

```powershell
$env:PORT = 3001
npm start
```

## Using the tester

1. Select **Movie** or **TV Series**.
2. Enter a TMDB ID. For TV, also enter season and episode numbers.
3. Select **Fetch All Servers**.
4. The first provider that returns a playable stream starts automatically. Select a green provider tab to switch streams.

## Enabled providers

The UI currently requests these extractors:

| UI label | Extractor | Method |
| --- | --- | --- |
| Server 1 (VidSrc) | `src/extractors/vidsrc.js` | Browser-assisted capture |
| Server 2 (Cinema) | `src/extractors/cinema.js` | Direct provider API with fallbacks |
| Server 3 (VidLink) | `src/extractors/vidlink.js` | Browser-assisted capture |
| Server 4 (Nxsha) | `src/extractors/nxsha.js` | Browser-assisted capture |
| Server 5 (Fmovies) | `src/extractors/fmovies.js` | Direct API request |

Additional extractors in `src/extractors/` are not currently displayed in the UI.

## Project structure

```text
public/index.html             Browser UI and hls.js player
server.js                     Express API, cache, encryption, and media proxy
src/extractors/               Provider-specific extraction modules
playwright_extractor.ts       Shared browser-assisted capture utility
```

## API

### `GET /api/extract`

Extracts a stream for a provider. Requests must originate from the local UI (`localhost:3000` or `127.0.0.1:3000`).

| Parameter | Required | Description |
| --- | --- | --- |
| `tmdbId` | Yes | TMDB movie or series ID |
| `server` | Yes | Extractor name, such as `cinema` or `nxsha` |
| `type` | No | `movie` (default) or `tv` |
| `s` | TV only | Season number; defaults to `1` |
| `e` | TV only | Episode number; defaults to `1` |
| `nocache` | No | Set to `true` to bypass the in-memory cache |

Nxsha also supports `advServer`, `advLang`, `advSub`, and `advOneServer`.

Successful responses provide an `encryptedStream` value, which the local UI decrypts before requesting `/proxy`. Do not expose this endpoint or the proxy publicly: they are intended for local testing only.

## Development

Build the TypeScript utility:

```bash
npm run build
```

The application logs extractor and proxy failures to the terminal. When diagnosing a provider issue, test both the extraction response and the resulting playlist or media request; a returned URL alone does not guarantee that playback is available.

## License and disclaimer

This project is not affiliated with any external provider. You are responsible for complying with applicable laws, rights-holder requirements, and each service's terms of use.
