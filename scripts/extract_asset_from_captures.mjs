import fs from 'fs';
const data = JSON.parse(fs.readFileSync('captures.json', 'utf8'));
function isBase64(s){ try{ return Buffer.from(s,'base64').toString('base64')===s.replace(/\n|\r/g,''); }catch(e){return false} }
const target = data.find(e=>e.type==='response' && e.url && e.url.includes('index-') && e.url.endsWith('.js')) || data.find(e=>e.type==='response' && e.url && e.url.includes('player.nhdapi.com/assets'));
if(!target){ console.error('asset not found'); process.exit(2) }
let body = target.body || '';
if(isBase64(body)) body = Buffer.from(body,'base64').toString('utf8');
fs.writeFileSync('player_asset.js', body, 'utf8');
console.log('Wrote player_asset.js');