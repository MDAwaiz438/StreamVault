export default {
  extract: async ({ tmdbId, type, s, e, req, res, cache, cacheKey, encryptURL, fallback, server }) => {
    const iframeUrl = type === 'tv' 
      ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${s}&e=${e}` 
      : `https://www.2embed.cc/embed/${tmdbId}`;

    clearTimeout(fallback);
    return res.json({ isIframe: true, iframeUrl, server });
  }
};
