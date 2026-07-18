import { createHmac } from 'node:crypto';

const CINEMA_API = 'https://cinema.bz/api';
const STREAM_TOKEN_KEY = 'a2cfc9eaa2a3690b5d4f6b5f958dbdeae52a097283d375bd253ee7c7062524f5';
const STREAM_URL_KEY = 'f16a6b92fcd6eed3e9476297f893f2505c32f79bc6efef9b6c95496aa5914548';

function createStreamToken(tmdbId) {
  return createHmac('sha256', STREAM_TOKEN_KEY)
    .update(`${tmdbId}:${Math.floor(Date.now() / 60000)}`)
    .digest('hex');
}

function decodeStreamUrl(value) {
  if (!value || value.startsWith('http://') || value.startsWith('https://')) return value;

  try {
    const encoded = Buffer.from(value, 'base64').toString('binary');
    let decoded = '';
    for (let index = 0; index < encoded.length; index += 1) {
      decoded += String.fromCharCode(
        encoded.charCodeAt(index) ^ STREAM_URL_KEY.charCodeAt(index % STREAM_URL_KEY.length),
      );
    }
    return decoded;
  } catch {
    return value;
  }
}

function getEndpoints(tmdbId, type, season, episode) {
  const suffix = type === 'tv' ? `tv/${tmdbId}/${season}/${episode}` : `movie/${tmdbId}`;
  return [
    { path: `/ipcloud/${suffix}`, method: 'GET' },
    { path: `/tcloud/${suffix}`, method: 'GET' },
    { path: `/cookiebakers/${suffix}`, method: 'POST' },
    { path: `/ngcloud/${suffix}`, method: 'GET' }
  ];
}

export default {
  extract: async ({ tmdbId, type, s, e, res, cache, cacheKey, encryptURL, fallback, server }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
      const season = Number.parseInt(s, 10) || 1;
      const episode = Number.parseInt(e, 10) || 1;
      const token = createStreamToken(tmdbId);
      const endpoints = getEndpoints(tmdbId, type, season, episode);

      console.log(`[cinema.bz] Fetching ${type} ${tmdbId} directly by TMDB ID`);

      const attempts = await Promise.allSettled(
        endpoints.map(async ({ path, method }) => {
          const response = await fetch(`${CINEMA_API}${path}`, {
            method,
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              Origin: 'https://cinema.bz',
              Referer: 'https://cinema.bz/',
              'X-Stream-Token': token,
            },
          });

          if (!response.ok) throw new Error(`${path} returned ${response.status}`);
          const payload = await response.json();
          const url = decodeStreamUrl(payload?.stream?.url);
          if (!url?.startsWith('http')) throw new Error(`${path} returned no stream URL`);
          return url;
        }),
      );

      const fulfilled = attempts.filter(({ status }) => status === 'fulfilled');
      // Prefer non-workers.dev URLs (more reliable) over workers.dev (often 521 for TV)
      const result = fulfilled.find(({ value }) => !value.includes('workers.dev')) || fulfilled[0];
      
      console.log(`[cinema.bz] Attempts for ${tmdbId}:`, attempts.map(a => a.status === 'fulfilled' ? 'OK: ' + a.value : 'ERR: ' + a.reason));

      if (!result) {
        const reasons = attempts
          .filter(({ status }) => status === 'rejected')
          .map(({ reason }) => reason.message)
          .join('; ');
        throw new Error(`Cinema did not return a stream for TMDB ID ${tmdbId}${reasons ? `: ${reasons}` : ''}`);
      }

      const streamUrl = result.value;
      cache.set(cacheKey, { url: streamUrl, timestamp: Date.now() });
      clearTimeout(fallback);
      if (!res.headersSent) res.json({ encryptedStream: encryptURL(streamUrl), cached: false, server });
    } catch (error) {
      clearTimeout(fallback);
      console.error('[cinema.bz] TMDB-ID extraction failed:', error.message);
      if (!res.headersSent) res.status(502).json({ error: error.message });
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  },
};
