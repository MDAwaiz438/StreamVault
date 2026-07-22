'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import { Play, Pause, Volume2, VolumeX, Settings, Download, Maximize, Search, ChevronDown, ChevronRight, ChevronLeft, Check, Zap, RotateCcw, RotateCw, Subtitles, PictureInPicture, Type, Code2 } from 'lucide-react';
import DocsPage from './docs/page';

export default function PlayerPage() {
  const [isBot, setIsBot] = useState(false);
  const [apiKey, setApiKey] = useState('vidsrc-secure-key-2026');
  
  const [mediaType, setMediaType] = useState('movie');
  const [tmdbId, setTmdbId] = useState('533535'); // Default Deadpool & Wolverine
  const [season, setSeason] = useState('1');
  const [episode, setEpisode] = useState('1');
  
  const [advServer, setAdvServer] = useState('');
  const [advLang, setAdvLang] = useState('');
  const [advSub, setAdvSub] = useState('');
  const [advOneServer, setAdvOneServer] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const [status, setStatus] = useState('');
  const [activeServer, setActiveServer] = useState(null);
  const activeServerRef = useRef(null);
  
  const [servers, setServers] = useState([
    { id: 'hd', name: 'HD', state: '', label: '—', streamData: null },
    { id: 'hd1', name: 'HD 1', state: '', label: '—', streamData: null },
    { id: 'hd2', name: 'HD 2', state: '', label: '—', streamData: null },
    { id: 'hd3', name: 'HD 3', state: '', label: '—', streamData: null },
    { id: 'hd4', name: 'HD 4', state: '', label: '—', streamData: null }
  ]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
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
  const [activeSubtitle, setActiveSubtitle] = useState(0); // -1 for off, 0 for first track
  const [subtitles, setSubtitles] = useState([]); // Array of subtitle objects
  const settingsMenuRef = useRef(null);
  
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

    const handleClickOutside = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setShowSettingsMenu(false);
      }
      setShowDownloadMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    setActiveSubtitle(0);
    setSubtitles([]);
  }, []);

  const playStream = useCallback((serverId, streamData) => {
    setActiveServer(serverId);
    activeServerRef.current = serverId;
    setStatus(`Playing from ${servers.find(s => s.id === serverId)?.name || serverId}`);
    destroyPlayer();

    const video = videoRef.current;
    if (!video) return;

    if (!streamData.encryptedStream && !streamData.streamUrl) {
      setStatus(`❌ Invalid stream data for ${serverId}`);
      return;
    }

    let proxyUrl = streamData.encryptedStream 
      ? `http://localhost:5000/api/play/${streamData.encryptedStream}`
      : `http://localhost:5000/api/play/${streamData.streamUrl}`; // Fallback if not encrypted (should not happen for our sources)
      
    if (streamData.headers) {
      proxyUrl += "?headers=" + encodeURIComponent(JSON.stringify(streamData.headers));
    }

    while (video.firstChild) video.removeChild(video.firstChild);
    if (streamData.subtitleUrl) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.label = 'English';
      track.srclang = 'en';
      track.src = streamData.subtitleUrl;
      track.default = true;
      video.appendChild(track);
      setSubtitles([{ label: 'English', url: streamData.subtitleUrl }]);
    } else {
      setSubtitles([]);
    }

    // Playback logic
    const serverName = servers.find(s => s.id === serverId)?.name || serverId;
    
    if (streamData.isMp4) {
      video.src = proxyUrl;
      video.play().catch(() => {});
      video.onerror = () => setStatus(`❌ Failed to play ${serverName}`);
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
          setStatus(`❌ Failed to play ${serverName}`);
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
            if (data.details === 'manifestLoadError' && data.response && data.response.code >= 400) {
              retryCounts.current[serverId] = (retryCounts.current[serverId] || 0) + 1;
              if (retryCounts.current[serverId] <= 1) {
                setStatus(`🔄 Link expired for ${serverName}. Refetching...`);
                hls.destroy();
                fetchSingleServer(serverId, true);
              } else {
                setStatus(`❌ ${serverName} upstream is down`);
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
    updateServerState(serverId, 'loading', '⏳ Fetching...');

    let apiUrl = `/api/extract?tmdbId=${tmdbId}&server=${serverId}&nocache=true&apiKey=${apiKey}`;
    if (mediaType === 'tv') apiUrl += `&type=tv&s=${season}&e=${episode}`;
    if (serverId === 'nxsha') {
      if (advServer) apiUrl += `&advServer=${advServer}`;
      if (advLang) apiUrl += `&advLang=${advLang}`;
      if (advSub) apiUrl += `&advSub=${advSub}`;
      if (advOneServer) apiUrl += `&advOneServer=true`;
    }

    fetch(apiUrl)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => {
        if (data.streamUrl || data.iframeUrl || data.encryptedStream) {
          updateServerState(serverId, 'ready', '✅ Ready', data);
          if (!activeServerRef.current || forceAutoPlay) {
            playStream(serverId, data);
          }
        } else {
          updateServerState(serverId, 'failed', '❌ No stream');
        }
      })
      .catch(() => { 
        updateServerState(serverId, 'failed', '❌ Error');
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

  const handleSubtitleToggle = (index) => {
    setActiveSubtitle(index);
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    let captionIndex = 0;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].kind === 'captions') {
        tracks[i].mode = captionIndex === index ? 'showing' : 'hidden';
        captionIndex++;
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-sans text-white select-none">
      <Script src="https://cdn.jsdelivr.net/npm/hls.js@latest" strategy="lazyOnload" />

      {/* Ambient background glow */}
      <div className="fixed inset-0 -z-10 bg-slate-950 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-8 min-h-screen">
        
        {/* Header */}
        <header className="flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700 w-full">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Stream<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Vault</span>
            </h1>
          </div>
          
          <button 
            onClick={() => {
              document.getElementById('api-docs-section').scrollIntoView({ behavior: 'smooth' });
            }}
            className="hidden sm:flex px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-indigo-400 hover:text-indigo-300 font-medium transition-all duration-300 items-center justify-center gap-2 shadow-lg"
          >
            <Code2 className="w-4 h-4" />
            <span>API & Embed Docs</span>
          </button>
        </header>

        {/* Search & Config Bar */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center shadow-2xl animate-in fade-in slide-in-from-top-6 duration-700 delay-150">
          
          <div className="flex bg-slate-950/50 rounded-lg p-1 border border-slate-800">
            <button 
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${mediaType === 'movie' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => { setMediaType('movie'); setTmdbId('533535'); }}
            >Movies</button>
            <button 
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${mediaType === 'tv' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
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
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showAdv ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
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
                 className={`relative overflow-hidden rounded-xl p-4 border transition-all duration-300 cursor-pointer group
                   ${activeServer === s.id ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 
                     s.state === 'ready' ? 'bg-slate-900/60 border-slate-700 hover:bg-slate-800 hover:border-slate-600' :
                     s.state === 'loading' ? 'bg-slate-900/30 border-slate-800 animate-pulse' :
                     s.state === 'failed' ? 'bg-red-950/20 border-red-900/50 opacity-75' :
                     'bg-slate-900/40 border-slate-800 opacity-50'}`}
            >
              {activeServer === s.id && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              )}
              <div className="font-semibold text-slate-200 mb-1 group-hover:text-white transition-colors">{s.name}</div>
              <div className={`text-xs font-medium 
                ${s.state === 'ready' ? 'text-green-400' : 
                  s.state === 'loading' ? 'text-amber-400' : 
                  s.state === 'failed' ? 'text-red-400' : 
                  'text-slate-500'}`}
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
          className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group transition-all duration-500
            ${activeServer ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute'}`}
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
          <div className={`absolute bottom-0 left-0 w-full flex flex-col transition-opacity duration-300
            ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            
            {/* Scrubber (Cyan/Blue, flush on top of controls) */}
            <div className="relative h-[3px] bg-white/20 w-full cursor-pointer group/scrubber hover:h-[5px] transition-all" onClick={handleSeek}>
              <div className="absolute top-0 left-0 h-full bg-white/40 transition-all duration-200" style={{ width: `${buffer}%` }}></div>
              <div className="absolute top-0 left-0 h-full bg-[#00a8e8]" style={{ width: `${progress}%` }}>
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
              <div className="relative" ref={settingsMenuRef}>
                <button 
                  onClick={() => { setShowSettingsMenu(!showSettingsMenu); setSettingsMenuState('main'); }}
                  className={`transition-colors flex items-center justify-center ${showSettingsMenu ? 'text-white' : 'text-white/90 hover:text-white'}`}
                  title="Settings"
                >
                  <Settings className={`w-[18px] h-[18px] transition-transform duration-300 ${showSettingsMenu ? 'rotate-45' : ''}`} />
                </button>
                {showSettingsMenu && (
                  <div className="absolute bottom-[calc(100%+15px)] right-[-15px] bg-black/95 rounded-md min-w-[160px] shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-white/10 overflow-hidden text-white font-sans">
                    {settingsMenuState === 'main' && (
                      <div className="py-2">
                        <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('quality'); }} className="w-full px-4 py-2 text-[13px] font-medium flex items-center justify-between hover:bg-white/10 transition-colors">
                          <span className="flex items-center gap-2">Quality</span>
                          <span className="flex items-center gap-1 text-white/50 text-[11px]">{currentLevel === -1 ? 'Auto' : (levels[currentLevel]?.height ? `${levels[currentLevel].height}p` : '')} <ChevronRight className="w-3 h-3" /></span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('subtitles'); }} className="w-full px-4 py-2 text-[13px] font-medium flex items-center justify-between hover:bg-white/10 transition-colors">
                          <span className="flex items-center gap-2">Subtitles</span>
                          <span className="flex items-center gap-1 text-white/50 text-[11px]">{activeSubtitle === -1 ? 'Off' : 'English'} <ChevronRight className="w-3 h-3" /></span>
                        </button>
                      </div>
                    )}
                    {settingsMenuState === 'quality' && (
                      <div className="py-2">
                        <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('main'); }} className="w-full px-3 py-2 text-[13px] font-semibold flex items-center gap-2 hover:bg-white/10 transition-colors border-b border-white/10 mb-1">
                          <ChevronLeft className="w-4 h-4" /> Quality
                        </button>
                        <button onClick={() => handleLevelSelect(-1)} className={`w-full text-left px-4 py-2 text-[13px] font-medium flex items-center justify-between transition-colors ${currentLevel === -1 ? 'text-[#00a8e8] bg-white/5' : 'hover:bg-white/10'}`}>
                          Auto {currentLevel === -1 && <Check className="w-4 h-4" />}
                        </button>
                        {levels
                          .map((lvl, i) => ({ ...lvl, index: i }))
                          .filter(lvl => [1080, 720, 480].includes(lvl.height))
                          .sort((a, b) => b.height - a.height)
                          .map((lvl) => (
                          <button key={lvl.index} onClick={() => handleLevelSelect(lvl.index)} className={`w-full text-left px-4 py-2 text-[13px] font-medium flex items-center justify-between transition-colors ${currentLevel === lvl.index ? 'text-[#00a8e8] bg-white/5' : 'hover:bg-white/10'}`}>
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
                        <button onClick={(e) => { e.stopPropagation(); handleSubtitleToggle(-1); setSettingsMenuState('main'); }} className={`w-full text-left px-4 py-2 text-[13px] font-medium flex items-center justify-between transition-colors ${activeSubtitle === -1 ? 'text-[#00a8e8] bg-white/5' : 'hover:bg-white/10'}`}>
                          Off {activeSubtitle === -1 && <Check className="w-4 h-4" />}
                        </button>
                        {subtitles.map((t, i) => (
                          <button key={i} onClick={(e) => { handleSubtitleToggle(i); setSettingsMenuState('main'); }} className={`w-full text-left px-4 py-2 text-[13px] font-medium flex items-center justify-between transition-colors ${activeSubtitle === i ? 'text-[#00a8e8] bg-white/5' : 'hover:bg-white/10'}`}>
                            {t.label} {activeSubtitle === i && <Check className="w-4 h-4" />}
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
                    else videoRef.current.requestPictureInPicture();
                  }
                }}
                className="text-white/90 hover:text-white transition-colors"
                title="Picture in Picture"
              >
                <PictureInPicture className="w-[18px] h-[18px]" />
              </button>

              <button 
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen();
                  else playerWrapperRef.current.requestFullscreen();
                }}
                className="text-white/90 hover:text-white transition-colors"
                title="Fullscreen"
              >
                <Maximize className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <div id="api-docs-section" className="border-t border-white/10 mt-12 bg-black/40">
        <DocsPage />
      </div>

      <footer className="w-full py-6 border-t border-white/10 text-center bg-black/60">
        <p className="text-slate-500 text-sm">© 2026 StreamVault API</p>
      </footer>
    </div>
  );
}
