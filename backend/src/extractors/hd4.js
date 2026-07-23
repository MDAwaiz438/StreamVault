export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    const iframeUrl = type === 'tv' 
      ? `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}` 
      : `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;

    clearTimeout(fallback);
    return res.json({ isIframe: true, iframeUrl, server });
  }
};
