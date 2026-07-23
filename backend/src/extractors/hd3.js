export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    const iframeUrl = type === 'tv' 
      ? `https://vidsrc.pro/embed/tv/${tmdbId}/${s}/${e}` 
      : `https://vidsrc.pro/embed/movie/${tmdbId}`;

    clearTimeout(fallback);
    return res.json({ isIframe: true, iframeUrl, server });
  }
};
