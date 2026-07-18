import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    const targetUrl = type === 'tv' ? `https://vidsrc.sbs/embed/tv/${tmdbId}/${s}/${e}` : `https://vidsrc.sbs/embed/movie/${tmdbId}`;
    const outFile = path.join(os.tmpdir(), `captures_dynamic_${tmdbId}_vidsrc_${Date.now()}.json`);

    exec(`node dist/playwright_extractor.js "${targetUrl}" "${outFile}"`, { timeout: 45000 }, (err, stdout, stderr) => {
      clearTimeout(fallback);
      if (res.headersSent) return;
      try {
        if (!fs.existsSync(outFile)) {
          console.error(`[EXTRACTION ERROR] vidsrc No output file generated. Stderr:`, stderr);
          return res.status(404).json({error: `Stream URL not found on vidsrc.sbs`});
        }
        const captures = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        try { fs.unlinkSync(outFile); } catch(e) {}
        const streamReq = captures.find(c => c.type === 'request' && c.method === 'DECODED');
        if (streamReq) {
          cache.set(cacheKey, { url: streamReq.url, timestamp: Date.now() });
          return res.json({ 
            encryptedStream: encryptURL(streamReq.url), 
            server 
          });
        }
      } catch(e) {
        console.error(`[EXTRACTION ERROR] vidsrc parse error:`, e);
        return res.status(500).json({error: 'Extraction failed'});
      }
      res.status(404).json({error: `Stream URL not found on vidsrc.sbs`});
    });
  }
};