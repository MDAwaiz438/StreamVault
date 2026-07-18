import fs from 'fs';

const CAP_PATH = 'captures.json';
const KEY_TEXT = 'Z9#rL!v2K*5qP&7mXw';

function findApiResponse(data){
  return data.find(e=>e.type==='response' && e.url && e.url.includes('/api/movie')) || null;
}

async function run(){
  const raw = JSON.parse(fs.readFileSync(CAP_PATH,'utf8'));
  const resp = findApiResponse(raw);
  if(!resp){ console.error('api/movie response not found'); process.exit(2) }
  let body = resp.body;
  if(typeof body!=='string') body = String(body);
  // body should be JSON string
  const obj = JSON.parse(body);
  const {iv, tag, data} = obj;
  if(!iv || !tag || !data){ console.error('missing iv/tag/data in payload'); console.log(Object.keys(obj)); process.exit(3) }

  const ivBuf = Buffer.from(iv,'base64');
  const tagBuf = Buffer.from(tag,'base64');
  const dataBuf = Buffer.from(data,'base64');
  const cipher = new Uint8Array(dataBuf.length + tagBuf.length);
  cipher.set(dataBuf,0);
  cipher.set(tagBuf,dataBuf.length);

  const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(KEY_TEXT));
  const key = await crypto.subtle.importKey('raw', keyHash, {name:'AES-GCM'}, false, ['decrypt']);
  let plain;
  try{
    const dec = await crypto.subtle.decrypt({name:'AES-GCM', iv: ivBuf}, key, cipher.buffer);
    plain = new TextDecoder().decode(dec);
  }catch(e){ console.error('decryption failed', e); process.exit(4) }

  let parsed;
  try{ parsed = JSON.parse(plain) }catch(e){ console.error('failed to parse decrypted JSON'); console.log(plain); process.exit(5) }

  console.log('Decrypted payload summary:');
  if(parsed.sources) console.log(JSON.stringify(parsed.sources, null, 2));
  else console.log(parsed);
}

run();
