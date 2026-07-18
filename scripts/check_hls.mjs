import fs from 'fs';

function parseAttributes(s){
  const out={};
  s.split(',').forEach(p=>{
    const [k,v]=p.split('=');
    if(!k) return;
    out[k.trim()]=v?.trim()?.replace(/^"|"$/g,'')||'';
  });
  return out;
}

async function fetchText(u){
  const res = await fetch(u, {headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36','Referer':'https://player.nhdapi.com/'}});
  return {ok:res.ok,status:res.status,headers:res.headers,body: await res.text()};
}

async function fetchHead(u){
  const res = await fetch(u, {method:'HEAD', headers:{'User-Agent':'Mozilla/5.0','Referer':'https://player.nhdapi.com/'}});
  return {ok:res.ok,status:res.status,headers:res.headers};
}

async function fetchRange(u, outFile){
  const res = await fetch(u, {headers:{'User-Agent':'Mozilla/5.0','Referer':'https://player.nhdapi.com/','Range':'bytes=0-16383'}});
  const ok = res.ok || res.status===206;
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(outFile, Buffer.from(buffer));
  return {ok:ok, status: res.status, size: buffer.byteLength, headers: res.headers};
}

async function main(){
  const url = process.argv[2];
  if(!url){ console.error('Usage: node check_hls.mjs <master.m3u8>'); process.exit(2) }

  console.log('Fetching master playlist:', url);
  const master = await fetchText(url);
  if(!master.ok){ console.error('Failed to fetch master', master.status); process.exit(3) }
  const lines = master.body.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const variants=[];
  for(let i=0;i<lines.length;i++){
    const line = lines[i];
    if(line.startsWith('#EXT-X-STREAM-INF')){
      const attrLine = line.split(':')[1]||'';
      const attrs = parseAttributes(attrLine);
      const uri = lines[i+1] || '';
      variants.push({attrs, uri: new URL(uri, url).toString()});
    }
  }

  if(variants.length===0){
    console.log('No variants found — maybe this is a media playlist. Listing segments instead.');
    const segs = master.body.split(/\r?\n/).filter(l=>l && !l.startsWith('#'));
    console.log('Segments:', segs.slice(0,10));
    process.exit(0);
  }

  console.log('Found variants:');
  variants.forEach((v,idx)=>{
    console.log(`#${idx}: ${v.uri}`);
    console.log('   attrs:', v.attrs);
  });

  const first = variants[0].uri;
  console.log('\nFetching first variant playlist:', first);
  const varRes = await fetchText(first);
  if(!varRes.ok){ console.error('Failed to fetch variant playlist', varRes.status); process.exit(4) }
  const segLines = varRes.body.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const segments = segLines.filter(l=>!l.startsWith('#'));
  console.log('First 10 segments:', segments.slice(0,10).map(s=>new URL(s, first).toString()));

  const firstSeg = segments[0] ? new URL(segments[0], first).toString() : null;
  if(!firstSeg){ console.error('No segments found'); process.exit(5) }
  console.log('\nAttempting to download first segment (range request):', firstSeg);
  const outFile = 'first_segment.bin';
  const r = await fetchRange(firstSeg, outFile);
  console.log('Segment fetch status:', r.status, 'saved bytes:', r.size, 'to', outFile);
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1) });
