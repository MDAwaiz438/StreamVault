'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import { Play, Pause, Volume2, VolumeX, Settings, Maximize, ChevronRight, ChevronLeft, Check, RotateCcw, RotateCw, PictureInPicture } from 'lucide-react';

export default function EmbedPlayer({ mediaType, tmdbId, season, episode }) {
  const [apiKey] = useState('vidsrc-secure-key-2026');
  
  const [status, setStatus] = useState('Initializing...');
  const [streams, setStreams] = useState([]);
  
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
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [activeSubtitle, setActiveSubtitle] = useState(0);
  const [subtitles, setSubtitles] = useState([]);
  const settingsMenuRef = useRef(null);
  
  const videoRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const playStream = useCallback((streamData) => {
    destroyPlayer();
    const video = videoRef.current;
    if (!video) return;
    
    if (!streamData.encryptedStream && !streamData.streamUrl) {
      setStatus('❌ Invalid stream data');
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
    if (streamData.isMp4) {
      video.src = proxyUrl;
      video.play().catch(() => {});
      video.onerror = () => setStatus(`❌ Failed to play`);
    } else if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls();
      hlsRef.current = hls;
      hls.loadSource(proxyUrl);
      hls.attachMedia(video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setLevels(hls.levels);
        setStatus('');
      });

      hls.on(window.Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setStatus(`❌ Failed to play`);
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxyUrl;
      video.play().catch(() => {});
      setStatus('');
    }
  }, [apiKey, destroyPlayer]);

  useEffect(() => {
    let mounted = true;
    const fetchStreams = async () => {
      setStatus('⏳ Searching for streams...');
      try {
        let apiUrl = `http://localhost:5000/api/v1/${mediaType}/${tmdbId}`;
        if (mediaType === 'tv') apiUrl += `/${season}/${episode}`;
        apiUrl += `?apiKey=${apiKey}`;

        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        
        if (!mounted) return;
        
        if (data.streams && data.streams.length > 0) {
          setStreams(data.streams);
          setStatus('✅ Streams found. Starting playback...');
          // Give CryptoJS time to load if it hasn't
          setTimeout(() => {
             playStream(data.streams[0]);
          }, 500);
        } else {
          setStatus('❌ No streams found for this media.');
        }
      } catch (err) {
        if (mounted) setStatus(`❌ Failed to fetch streams: ${err.message}`);
      }
    };

    fetchStreams();
    return () => { mounted = false; };
  }, [mediaType, tmdbId, season, episode, apiKey, playStream]);

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
    <div className="fixed inset-0 bg-black w-full h-full text-sans select-none">
      <Script src="https://cdn.jsdelivr.net/npm/hls.js@latest" strategy="lazyOnload" />

      {status && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/80">
          <div className="bg-slate-900/90 text-white px-6 py-3 rounded-full shadow-2xl border border-white/10 flex items-center gap-3">
             {status}
          </div>
        </div>
      )}

      <div 
        ref={playerWrapperRef} 
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className="relative w-full h-full bg-black overflow-hidden group"
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
        {!isPlaying && streams.length > 0 && (
          <button 
            onClick={togglePlay}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-14 bg-black/60 hover:bg-black text-white rounded-lg flex items-center justify-center transition-colors duration-200 z-10 border border-white/20"
          >
            <Play className="w-10 h-10 ml-1" fill="currentColor" />
          </button>
        )}

        {/* Custom Controls Overlay */}
        <div className={`absolute bottom-0 left-0 w-full flex flex-col transition-opacity duration-300 bg-gradient-to-t from-black/80 to-transparent
          ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          
          {/* Scrubber */}
          <div className="relative h-[4px] bg-white/20 w-full cursor-pointer group/scrubber hover:h-[6px] transition-all" onClick={handleSeek}>
            <div className="absolute top-0 left-0 h-full bg-white/40 transition-all duration-200" style={{ width: `${buffer}%` }}></div>
            <div className="absolute top-0 left-0 h-full bg-[#00a8e8]" style={{ width: `${progress}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[12px] h-[12px] bg-[#00a8e8] rounded-full shadow scale-0 group-hover/scrubber:scale-100 transition-transform origin-center"></div>
            </div>
          </div>

          {/* Bottom Row Controls */}
          <div className="flex items-center gap-5 px-5 py-3">
            <button onClick={togglePlay} className="text-white/90 hover:text-white transition-colors">
              {isPlaying ? <Pause className="w-[20px] h-[20px]" fill="currentColor" /> : <Play className="w-[20px] h-[20px]" fill="currentColor" />}
            </button>
            
            {/* Volume */}
            <div className="flex items-center gap-2 group/vol relative">
              <button onClick={() => { 
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }} className="text-white/90 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-[20px] h-[20px]" /> : <Volume2 className="w-[20px] h-[20px]" />}
              </button>
              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 ease-out origin-left flex items-center">
                <input 
                  type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} 
                  onChange={e => {
                    setVolume(parseFloat(e.target.value));
                    if (e.target.value > 0) setIsMuted(false);
                    if (videoRef.current) videoRef.current.volume = e.target.value;
                  }} 
                  className="w-20 h-1.5 bg-white/30 rounded-full appearance-none outline-none accent-[#00a8e8]"
                />
              </div>
            </div>

            {/* Time */}
            <div className="text-white/90 text-[12px] font-medium tracking-wide">
              {currentTime} <span className="text-white/40 mx-1">/</span> {duration}
            </div>

            <div className="flex-1"></div>

            {/* Right Side Controls */}
            <button 
              onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); }}
              className="text-white/90 hover:text-white transition-colors relative"
              title="-10s"
            >
              <RotateCcw className="w-[20px] h-[20px]" />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold mt-[1px]">10</span>
            </button>

            <button 
              onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10); }}
              className="text-white/90 hover:text-white transition-colors relative"
              title="+10s"
            >
              <RotateCw className="w-[20px] h-[20px]" />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold mt-[1px]">10</span>
            </button>

            {/* Settings Menu */}
            <div className="relative" ref={settingsMenuRef}>
              <button 
                onClick={() => { setShowSettingsMenu(!showSettingsMenu); setSettingsMenuState('main'); }}
                className={`transition-colors flex items-center justify-center ${showSettingsMenu ? 'text-white' : 'text-white/90 hover:text-white'}`}
                title="Settings"
              >
                <Settings className={`w-[20px] h-[20px] transition-transform duration-300 ${showSettingsMenu ? 'rotate-45' : ''}`} />
              </button>
              {showSettingsMenu && (
                <div className="absolute bottom-[calc(100%+15px)] right-[-15px] bg-black/95 rounded-lg min-w-[180px] shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-white/10 overflow-hidden text-white">
                  {settingsMenuState === 'main' && (
                    <div className="py-2">
                      <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('quality'); }} className="w-full px-4 py-2.5 text-[14px] font-medium flex items-center justify-between hover:bg-white/10 transition-colors">
                        <span className="flex items-center gap-2">Quality</span>
                        <span className="flex items-center gap-1 text-white/50 text-[12px]">{currentLevel === -1 ? 'Auto' : (levels[currentLevel]?.height ? `${levels[currentLevel].height}p` : '')} <ChevronRight className="w-4 h-4" /></span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('subtitles'); }} className="w-full px-4 py-2.5 text-[14px] font-medium flex items-center justify-between hover:bg-white/10 transition-colors">
                        <span className="flex items-center gap-2">Subtitles</span>
                        <span className="flex items-center gap-1 text-white/50 text-[12px]">{activeSubtitle === -1 ? 'Off' : 'English'} <ChevronRight className="w-4 h-4" /></span>
                      </button>
                    </div>
                  )}
                  {settingsMenuState === 'quality' && (
                    <div className="py-2">
                      <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('main'); }} className="w-full px-3 py-2 text-[14px] font-semibold flex items-center gap-2 hover:bg-white/10 transition-colors border-b border-white/10 mb-1">
                        <ChevronLeft className="w-5 h-5" /> Quality
                      </button>
                      <button onClick={() => handleLevelSelect(-1)} className={`w-full text-left px-4 py-2.5 text-[14px] font-medium flex items-center justify-between transition-colors ${currentLevel === -1 ? 'text-[#00a8e8] bg-white/5' : 'hover:bg-white/10'}`}>
                        Auto {currentLevel === -1 && <Check className="w-4 h-4" />}
                      </button>
                      {levels
                        .map((lvl, i) => ({ ...lvl, index: i }))
                        .filter(lvl => [1080, 720, 480].includes(lvl.height))
                        .sort((a, b) => b.height - a.height)
                        .map((lvl) => (
                        <button key={lvl.index} onClick={() => handleLevelSelect(lvl.index)} className={`w-full text-left px-4 py-2.5 text-[14px] font-medium flex items-center justify-between transition-colors ${currentLevel === lvl.index ? 'text-[#00a8e8] bg-white/5' : 'hover:bg-white/10'}`}>
                          {lvl.height}p {currentLevel === lvl.index && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                  {settingsMenuState === 'subtitles' && (
                    <div className="py-2">
                      <button onClick={(e) => { e.stopPropagation(); setSettingsMenuState('main'); }} className="w-full px-3 py-2 text-[14px] font-semibold flex items-center gap-2 hover:bg-white/10 transition-colors border-b border-white/10 mb-1">
                        <ChevronLeft className="w-5 h-5" /> Subtitles
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleSubtitleToggle(-1); setSettingsMenuState('main'); }} className={`w-full text-left px-4 py-2.5 text-[14px] font-medium flex items-center justify-between transition-colors ${activeSubtitle === -1 ? 'text-[#00a8e8] bg-white/5' : 'hover:bg-white/10'}`}>
                        Off {activeSubtitle === -1 && <Check className="w-4 h-4" />}
                      </button>
                      {subtitles.map((t, i) => (
                        <button key={i} onClick={(e) => { e.stopPropagation(); handleSubtitleToggle(i); setSettingsMenuState('main'); }} className={`w-full text-left px-4 py-2.5 text-[14px] font-medium flex items-center justify-between transition-colors ${activeSubtitle === i ? 'text-[#00a8e8] bg-white/5' : 'hover:bg-white/10'}`}>
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
              <PictureInPicture className="w-[20px] h-[20px]" />
            </button>

            <button 
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen();
                else playerWrapperRef.current.requestFullscreen();
              }}
              className="text-white/90 hover:text-white transition-colors"
              title="Fullscreen"
            >
              <Maximize className="w-[20px] h-[20px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
