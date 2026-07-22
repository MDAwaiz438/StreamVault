import re

with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to extract the top part and bottom part of the file.
# The top part ends at const [progress, setProgress] = useState(0);
top_match = re.search(r'([\s\S]*?const \[progress, setProgress\] = useState\(0\);)', content)
top = top_match.group(1) if top_match else ''

# The bottom part starts at                     else videoRef.current.requestPictureInPicture();
bottom_match = re.search(r'(                    else videoRef\.current\.requestPictureInPicture\(\);[\s\S]*)', content)
bottom = bottom_match.group(1) if bottom_match else ''

middle = r'''
  const [buffer, setBuffer] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeoutRef = useRef(null);
  
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsMenuState, setSettingsMenuState] = useState('main'); // 'main' | 'quality' | 'subtitles'
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  
  const videoRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const hlsRef = useRef(null);
  const retryCounts = useRef({});

  useEffect(() => {
    // Load saved values on mount
    if (typeof window !== 'undefined') {
      const savedTmdb = localStorage.getItem('sv_tmdbId');
      if (savedTmdb) setTmdbId(savedTmdb);
      
      const savedS = localStorage.getItem('sv_season');
      if (savedS) setSeason(savedS);
      
      const savedE = localStorage.getItem('sv_episode');
      if (savedE) setEpisode(savedE);
      
      const savedType = localStorage.getItem('sv_mediaType');
      if (savedType) setMediaType(savedType);
    }

    const isAutomated = navigator.webdriver || 
      !!window.cdc_adoQpoasnfa76pfcZLmcfl_Array || 
      (navigator.languages && navigator.languages.length === 0);
    if (isAutomated) {
      setIsBot(true);
      setApiKey('corrupted-bot-key');
    }

    const handleClickOutside = () => {
      setShowSettingsMenu(false);
      setShowDownloadMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Save values whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (tmdbId) localStorage.setItem('sv_tmdbId', tmdbId);
      if (season) localStorage.setItem('sv_season', season);
      if (episode) localStorage.setItem('sv_episode', episode);
      if (mediaType) localStorage.setItem('sv_mediaType', mediaType);
    }
  }, [tmdbId, season, episode, mediaType]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    if (isPlaying) {
      hideControlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const fmt = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  };

  const updateServerState = (serverId, state, label, streamData = null) => {
    setServers(prev => prev.map(s => 
      s.id === serverId ? { ...s, state, label, streamData: streamData || s.streamData } : s
    ));
  };

  const decryptURL = (encryptedData) => {
    try {
      const parts = encryptedData.split(':');
      const key = window.CryptoJS.enc.Utf8.parse('vidsrc_super_secret_key_12345678');
      const iv = window.CryptoJS.enc.Hex.parse(parts[0]);
      const cp = window.CryptoJS.lib.CipherParams.create({ ciphertext: window.CryptoJS.enc.Hex.parse(parts[1]) });
      return window.CryptoJS.AES.decrypt(cp, key, { iv, mode: window.CryptoJS.mode.CBC, padding: window.CryptoJS.pad.Pkcs7 }).toString(window.CryptoJS.enc.Utf8);
    } catch (e) { return null; }
  };

  const destroyPlayer = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    setLevels([]);
    setCurrentLevel(-1);
  }, []);

  const playStream = useCallback((serverId, streamData) => {
    setActiveServer(serverId);
    activeServerRef.current = serverId;
    setStatus(Playing from );
    destroyPlayer();

    const video = videoRef.current;
    if (!video) return;

    let streamUrl = streamData.streamUrl;
    if (streamData.encryptedStream && window.CryptoJS) {
      streamUrl = decryptURL(streamData.encryptedStream);
    }
    
    let proxyUrl = "/api/proxy?url=" + encodeURIComponent(streamUrl) + "&server=" + serverId + "&apiKey=" + apiKey;
    if (streamData.headers) {
      proxyUrl += "&headers=" + encodeURIComponent(JSON.stringify(streamData.headers));
    }
    while (video.firstChild) video.removeChild(video.firstChild);
    if (streamData.subtitleUrl) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.label = 'Subtitles';
      track.srclang = 'en';
      track.src = streamData.subtitleUrl;
      track.default = true;
      video.appendChild(track);
    }

    if (streamUrl.includes('.mp4')) {
      video.src = proxyUrl;
      video.play().catch(() => {});
      video.onerror = () => setStatus(? Failed to play  (native error));
    } else if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls();
      hlsRef.current = hls;
      hls.loadSource(proxyUrl);
      hls.attachMedia(video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setLevels(hls.levels);
      });

      hls.on(window.Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setStatus(? Failed to play  (: ));
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
            if (data.details === 'manifestLoadError' && data.response && data.response.code >= 400) {
              retryCounts.current[serverId] = (retryCounts.current[serverId] || 0) + 1;
              if (retryCounts.current[serverId] <= 1) {
                setStatus(?? Link expired for . Refetching...);
                hls.destroy();
                fetchSingleServer(serverId, true);
              } else {
                setStatus(?  upstream is down);
                hls.destroy();
              }
            } else {
              hls.destroy();
            }
          } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            hls.destroy();
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxyUrl;
      video.play().catch(() => {});
    }
  }, [apiKey, destroyPlayer, servers]);
  const currentServers = servers;

  const fetchSingleServer = (serverId, forceAutoPlay = false) => {
    updateServerState(serverId, 'loading', '? Fetching...');

    let apiUrl = /api/extract?tmdbId=&server=&nocache=true&apiKey=;
    if (mediaType === 'tv') apiUrl += &type=tv&s=&e=;
    if (serverId === 'nxsha') {
      if (advServer) apiUrl += &advServer=;
      if (advLang) apiUrl += &advLang=;
      if (advSub) apiUrl += &advSub=;
      if (advOneServer) apiUrl += &advOneServer=true;
    }

    fetch(apiUrl)
      .then(res => { if (!res.ok) throw new Error(HTTP ); return res.json(); })
      .then(data => {
        if (data.streamUrl || data.iframeUrl || data.encryptedStream) {
          updateServerState(serverId, 'ready', '? Ready', data);
          if (!activeServerRef.current || forceAutoPlay) {
            playStream(serverId, data);
          }
        } else {
          updateServerState(serverId, 'failed', '? No stream');
        }
      })
      .catch(() => { 
        updateServerState(serverId, 'failed', '? Error');
      });
  };

  const handleFetchAll = () => {
    if (!tmdbId) { alert("Enter a TMDB ID first!"); return; }
    setActiveServer(null);
    activeServerRef.current = null;
    setServers(prev => prev.map(s => ({ ...s, state: '', label: '—', streamData: null })));
    retryCounts.current = {};
    destroyPlayer();
    setStatus('Fetching streams...');

    servers.forEach(s => fetchSingleServer(s.id));
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    setProgress((vid.currentTime / vid.duration) * 100);
    setCurrentTime(fmt(vid.currentTime));
    setDuration(fmt(vid.duration));
  };

  const handleProgress = () => {
    const vid = videoRef.current;
    if (!vid || !vid.buffered.length || !vid.duration) return;
    setBuffer((vid.buffered.end(vid.buffered.length - 1) / vid.duration) * 100);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const vid = videoRef.current;
    if (vid && vid.duration) vid.currentTime = pct * vid.duration;
  };

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play(); else vid.pause();
  };

  const handleLevelSelect = (index) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      setCurrentLevel(index);
    }
  };

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/hls.js@latest" strategy="lazyOnload" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js" strategy="lazyOnload" />

      {/* Ambient background glow */}
      <div className="fixed inset-0 -z-10 bg-slate-950 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-8 min-h-screen">
        
        {/* Header */}
        <header className="flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Stream<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Vault</span>
          </h1>
        </header>

        {/* Search & Config Bar */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center shadow-2xl animate-in fade-in slide-in-from-top-6 duration-700 delay-150">
          
          <div className="flex bg-slate-950/50 rounded-lg p-1 border border-slate-800">
            <button 
              className={px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 }
              onClick={() => { setMediaType('movie'); setTmdbId('533535'); }}
            >Movies</button>
            <button 
              className={px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 }
              onClick={() => { setMediaType('tv'); setTmdbId('1399'); setSeason('1'); setEpisode('1'); }}
            >TV Shows</button>
          </div>

          <div className="flex-1 flex gap-3 w-full">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="text" 
                  value={tmdbId} 
                  onChange={e => setTmdbId(e.target.value)} 
                  placeholder="Enter TMDB ID (e.g. 533535)" 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>

            {mediaType === 'tv' && (
              <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-300">
                <input 
                  type="number" min="1" placeholder="S" value={season} onChange={e => setSeason(e.target.value)} 
                  className="w-16 bg-slate-950 border border-slate-800 text-slate-200 text-center py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <input 
                  type="number" min="1" placeholder="E" value={episode} onChange={e => setEpisode(e.target.value)} 
                  className="w-16 bg-slate-950 border border-slate-800 text-slate-200 text-center py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            )}
            
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => setShowAdv(!showAdv)}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium transition-all duration-300 flex items-center justify-center gap-2 flex-1 md:flex-none"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={handleFetchAll}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] flex-1 md:flex-none"
            >
              <Zap className="w-4 h-4" fill="currentColor" /> Fetch Streams
            </button>
          </div>
        </div>

        {/* Advanced Options Drawer */}
        <div className={overflow-hidden transition-all duration-500 ease-in-out }>
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Nxsha Advanced Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <select value={advServer} onChange={e => setAdvServer(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none">
                <option value="">Any Server</option>
                <option value="MbPly-[Multi-Lang]">MbPly-[Multi-Lang]</option>
                <option value="ZetPly">ZetPly</option>
                <option value="OrVid">OrVid</option>
              </select>
              <select value={advLang} onChange={e => setAdvLang(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none">
                <option value="">Any Audio</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
              <select value={advSub} onChange={e => setAdvSub(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none">
                <option value="">No Subtitles Filter</option>
                <option value="en">English Subs</option>
                <option value="hi">Hindi Subs</option>
              </select>
              <label className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-slate-900 transition-colors">
                <input type="checkbox" checked={advOneServer} onChange={e => setAdvOneServer(e.target.checked)} className="rounded text-indigo-500 focus:ring-indigo-500 bg-slate-800 border-slate-700 w-4 h-4" />
                <span className="text-sm text-slate-300 font-medium">Strict Lock</span>
              </label>
            </div>
          </div>
        </div>

        {/* Server Status Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          {currentServers.map(s => (
            <div key={s.id} 
                 onClick={() => { if (s.streamData) playStream(s.id, s.streamData); }}
                 className={elative overflow-hidden rounded-xl p-4 border transition-all duration-300 cursor-pointer group
                   }
            >
              {activeServer === s.id && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              )}
              <div className="font-semibold text-slate-200 mb-1 group-hover:text-white transition-colors">{s.name}</div>
              <div className={	ext-xs font-medium 
                }
              >{s.label}</div>
            </div>
          ))}
        </div>

        {/* Status Message */}
        {status && (
          <div className="text-center text-sm font-medium text-slate-400 animate-in fade-in duration-300">
            {status}
          </div>
        )}

        {/* Video Player Area */}
        <div 
          ref={playerWrapperRef} 
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          className={elative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group transition-all duration-500
            }
        >
          <video 
            ref={videoRef} 
            className="w-full h-full object-contain"
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onProgress={handleProgress}
            onClick={togglePlay}
          ></video>

          {/* Big Center Play Button (JW Player Style) */}
          {!isPlaying && activeServer && (
            <button 
              onClick={togglePlay}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 bg-black/60 hover:bg-black text-white rounded flex items-center justify-center transition-colors duration-200 z-10 border border-white/20"
            >
              <Play className="w-8 h-8 ml-1" fill="currentColor" />
            </button>
          )}

          {/* Custom Controls Overlay */}
          <div className={bsolute bottom-0 left-0 w-full flex flex-col transition-opacity duration-300
            }>
            
            {/* Scrubber (Cyan/Blue, flush on top of controls) */}
            <div className="relative h-[3px] bg-white/20 w-full cursor-pointer group/scrubber hover:h-[5px] transition-all" onClick={handleSeek}>
              <div className="absolute top-0 left-0 h-full bg-white/40 transition-all duration-200" style={{ width: ${buffer}% }}></div>
              <div className="absolute top-0 left-0 h-full bg-[#00a8e8]" style={{ width: ${progress}% }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[10px] h-[10px] bg-[#00a8e8] rounded-full shadow scale-0 group-hover/scrubber:scale-100 transition-transform origin-center"></div>
              </div>
            </div>

            {/* Bottom Row Controls */}
            <div className="flex items-center gap-5 bg-black px-4 py-2.5">
              <button onClick={togglePlay} className="text-white/90 hover:text-white transition-colors">
                {isPlaying ? <Pause className="w-[18px] h-[18px]" fill="currentColor" /> : <Play className="w-[18px] h-[18px]" fill="currentColor" />}
              </button>
              
              {/* Volume */}
              <div className="flex items-center gap-2 group/vol relative">
                <button onClick={() => { 
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }} className="text-white/90 hover:text-white transition-colors">
                  {isMuted || volume === 0 ? <VolumeX className="w-[18px] h-[18px]" /> : <Volume2 className="w-[18px] h-[18px]" />}
                </button>
                <div className="w-0 overflow-hidden group-hover/vol:w-16 transition-all duration-300 ease-out origin-left flex items-center">
                  <input 
                    type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} 
                    onChange={e => {
                      setVolume(parseFloat(e.target.value));
                      if (e.target.value > 0) setIsMuted(false);
                      if (videoRef.current) videoRef.current.volume = e.target.value;
                    }} 
                    className="w-16 h-1 bg-white/30 rounded-none appearance-none outline-none accent-[#00a8e8]"
                  />
                </div>
              </div>

              {/* Time */}
              <div className="text-white/90 text-[11px] font-medium tracking-wide">
                {currentTime} <span className="text-white/40 mx-1">/</span> {duration}
              </div>

              <div className="flex-1"></div>

              {/* Right Side Controls */}
              <button 
                onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); }}
                className="text-white/90 hover:text-white transition-colors relative"
                title="-10s"
              >
                <RotateCcw className="w-[18px] h-[18px]" />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] font-bold mt-[1px]">10</span>
              </button>

              <button 
                onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10); }}
                className="text-white/90 hover:text-white transition-colors relative"
                title="+10s"
              >
                <RotateCw className="w-[18px] h-[18px]" />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] font-bold mt-[1px]">10</span>
              </button>

              {/* Settings Menu (JWPlayer Style) */}
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowSettingsMenu(!showSettingsMenu); setSettingsMenuState('main'); }}
                  className={	ransition-colors flex items-center justify-center }
                  title="Settings"
                >
                  <Settings className={w-[18px] h-[18px] transition-transform duration-300 } />
                </button>
                {showSettingsMenu && (
                  <div className="absolute bottom-[calc(100%+15px)] right-[-15px] bg-black/95 rounded-md min-w-[160px] shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-white/10 overflow-hidden text-white font-sans">
                    {settingsMenuState === 'main' && (
                      <div className="py-2">
                        <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('quality'); }} className="w-full px-4 py-2 text-[13px] font-medium flex items-center justify-between hover:bg-white/10 transition-colors">
                          <span className="flex items-center gap-2">Quality</span>
                          <span className="flex items-center gap-1 text-white/50 text-[11px]">{currentLevel === -1 ? 'Auto' : (levels[currentLevel]?.height ? ${levels[currentLevel].height}p : '')} <ChevronRight className="w-3 h-3" /></span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('subtitles'); }} className="w-full px-4 py-2 text-[13px] font-medium flex items-center justify-between hover:bg-white/10 transition-colors">
                          <span className="flex items-center gap-2">Subtitles</span>
                          <span className="flex items-center gap-1 text-white/50 text-[11px]">Off <ChevronRight className="w-3 h-3" /></span>
                        </button>
                      </div>
                    )}
                    {settingsMenuState === 'quality' && (
                      <div className="py-2">
                        <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('main'); }} className="w-full px-3 py-2 text-[13px] font-semibold flex items-center gap-2 hover:bg-white/10 transition-colors border-b border-white/10 mb-1">
                          <ChevronLeft className="w-4 h-4" /> Quality
                        </button>
                        <button onClick={() => handleLevelSelect(-1)} className={w-full text-left px-4 py-2 text-[13px] font-medium flex items-center justify-between transition-colors }>
                          Auto {currentLevel === -1 && <Check className="w-4 h-4" />}
                        </button>
                        {levels
                          .map((lvl, i) => ({ ...lvl, index: i }))
                          .filter(lvl => [1080, 720, 480].includes(lvl.height))
                          .sort((a, b) => b.height - a.height)
                          .map((lvl) => (
                          <button key={lvl.index} onClick={() => handleLevelSelect(lvl.index)} className={w-full text-left px-4 py-2 text-[13px] font-medium flex items-center justify-between transition-colors }>
                            {lvl.height}p {currentLevel === lvl.index && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {settingsMenuState === 'subtitles' && (
                      <div className="py-2">
                        <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('main'); }} className="w-full px-3 py-2 text-[13px] font-semibold flex items-center gap-2 hover:bg-white/10 transition-colors border-b border-white/10 mb-1">
                          <ChevronLeft className="w-4 h-4" /> Subtitles
                        </button>
                        <button className="w-full text-left px-4 py-2 text-[13px] font-medium flex items-center justify-between transition-colors text-[#00a8e8] bg-white/5">
                          Off <Check className="w-4 h-4" />
                        </button>
                        {Array.from(videoRef.current?.textTracks || []).filter(t => t.kind === 'captions').map((t, i) => (
                          <button key={i} className="w-full text-left px-4 py-2 text-[13px] font-medium flex items-center justify-between transition-colors hover:bg-white/10 opacity-50 cursor-not-allowed">
                            {t.label || t.language || 'English'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={() => {
                  if (videoRef.current && videoRef.current.requestPictureInPicture) {
                    if (document.pictureInPictureElement) document.exitPictureInPicture();
'''

new_content = top + middle + bottom
with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
