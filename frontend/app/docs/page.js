'use client';

import { useState } from 'react';
import { Copy, Check, Terminal, Code2, PlaySquare, FileJson } from 'lucide-react';

export default function DocsPage() {
  const [copied, setCopied] = useState('');

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const CodeBlock = ({ id, code, language = 'html' }) => (
    <div className="relative group rounded-xl bg-slate-900 border border-white/10 overflow-hidden mb-6">
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{language}</span>
        <button
          onClick={() => handleCopy(code, id)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          {copied === id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <code className="text-sm font-mono text-slate-300 whitespace-pre">{code}</code>
      </div>
    </div>
  );

  return (
    <div className="text-slate-200 py-20 px-6 sm:px-12 lg:px-24 w-full">
      <div className="max-w-4xl mx-auto space-y-16">
        
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">API Documentation</h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            Everything you need to integrate our high-speed, ad-free streaming player and JSON API into your own platform.
          </p>
        </div>

        {/* Embed Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><PlaySquare size={24} /></div>
            <h2 className="text-2xl font-semibold text-white">Embed Player</h2>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-medium text-slate-200">Movies</h3>
            <p className="text-slate-400">Embed a movie simply by passing its TMDB ID.</p>
            <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm text-blue-300 break-all">
              https://yourdomain.com/embed/movie/&#123;tmdbId&#125;
            </div>
            
            <h3 className="text-xl font-medium text-slate-200 pt-4">TV Series</h3>
            <p className="text-slate-400">Embed a TV show episode using its TMDB ID, season, and episode number.</p>
            <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm text-blue-300 break-all">
              https://yourdomain.com/embed/tv/&#123;tmdbId&#125;/&#123;season&#125;/&#123;episode&#125;
            </div>

            <div className="pt-6">
              <h4 className="font-semibold text-white mb-3">Example iFrame:</h4>
              <CodeBlock 
                id="iframe-example"
                code={`<iframe \n  src="https://yourdomain.com/embed/movie/533535"\n  width="100%" \n  height="500" \n  frameBorder="0" \n  allowFullScreen\n></iframe>`} 
              />
            </div>
          </div>
        </section>

        {/* JSON API Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="p-2 bg-green-500/20 text-green-400 rounded-lg"><FileJson size={24} /></div>
            <h2 className="text-2xl font-semibold text-white">JSON API</h2>
          </div>

          <div className="space-y-6">
            <p className="text-slate-400">
              Query our extraction cluster directly to get raw stream tokens (M3U8 / MP4). Perfect for building custom players.
            </p>
            
            <h3 className="text-xl font-medium text-slate-200">Movie Endpoint</h3>
            <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm text-green-300 break-all">
              GET /api/v1/movie/&#123;tmdbId&#125;
            </div>

            <h3 className="text-xl font-medium text-slate-200 pt-4">TV Series Endpoint</h3>
            <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm text-green-300 break-all">
              GET /api/v1/tv/&#123;tmdbId&#125;/&#123;season&#125;/&#123;episode&#125;
            </div>
          </div>
        </section>

        {/* Integration Guides */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg"><Code2 size={24} /></div>
            <h2 className="text-2xl font-semibold text-white">Integration Guides</h2>
          </div>

          <div className="space-y-12">
            
            {/* HTML */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">1. Basic HTML / Any Website</h3>
              <p className="text-slate-400">
                You can embed the player on any standard HTML page. Just copy the snippet below and paste it inside your <code className="text-pink-400 bg-pink-400/10 px-1.5 py-0.5 rounded text-sm">&lt;body&gt;</code> tags. Set width and height using standard CSS.
              </p>
              <CodeBlock 
                id="html-integration"
                code={`<iframe \n  src="https://yourdomain.com/embed/movie/533535" \n  width="100%" \n  height="500" \n  frameBorder="0" \n  allowFullScreen\n></iframe>`} 
              />
            </div>

            {/* WordPress */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">2. WordPress</h3>
              <p className="text-slate-400 leading-relaxed">
                To embed the player in WordPress, do not use the standard visual editor. Instead:<br/>
                • In the Gutenberg block editor, click <strong className="text-white">+</strong> and search for <strong>Custom HTML</strong>.<br/>
                • Paste the iframe code inside the block.<br/>
                • If using the Classic Editor, switch the tab from "Visual" to "Text" before pasting.
              </p>
            </div>

            {/* React */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">3. React / Next.js</h3>
              <p className="text-slate-400">
                When embedding in React, ensure you use camelCase attributes like <code className="text-pink-400 bg-pink-400/10 px-1.5 py-0.5 rounded text-sm">allowFullScreen</code> and <code className="text-pink-400 bg-pink-400/10 px-1.5 py-0.5 rounded text-sm">frameBorder</code> instead of lowercase.
              </p>
              <CodeBlock 
                id="react-integration"
                language="jsx"
                code={`export default function PlayerView() {\n  return (\n    <div className="w-full h-[500px]">\n      <iframe \n        src="https://yourdomain.com/embed/movie/533535"\n        frameBorder="0"\n        allowFullScreen\n        style={{ width: '100%', height: '100%' }}\n      ></iframe>\n    </div>\n  );\n}`} 
              />
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
