const https = require('https');
const http  = require('http');

const stores = [
  ['horus3d',     'https://horus3d.cl'],
  ['evstore',     'https://evstore.cl'],
  ['make3d',      'https://www.make3d.cl'],
  ['inkpact',     'https://inkpact.cl'],
  ['afel',        'https://afel.cl'],
  ['tecnosistec', 'https://tecnosistec.cl'],
  ['tugadget',    'https://tugadget.cl'],
  ['makerschile', 'https://makerschile.cl'],
  ['cimech3d',    'https://www.cimech3d.cl'],
  ['capital3d',   'https://capital3d.cl'],
  ['maxi3d',      'https://www.maxi3d.cl'],
  ['imperio3d',   'https://imperio3d.com'],
];

function fetch(url, depth=0) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {headers:{'User-Agent':'Mozilla/5.0'}}, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && depth < 3) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        res.destroy();
        resolve(fetch(loc, depth+1));
        return;
      }
      let html = '';
      res.on('data', d => html += d.toString());
      res.on('end', () => resolve({ url, html, status: res.statusCode }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function checkAll() {
  for (const [id, baseUrl] of stores) {
    try {
      const { url, html } = await fetch(baseUrl);
      // Try apple-touch-icon first (usually higher quality PNG)
      const appleMatch = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i) ||
                         html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i);
      const iconMatch  = html.match(/<link[^>]*rel=["'](?:shortcut icon|icon)["'][^>]*href=["']([^"']+)["']/i) ||
                         html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut icon|icon)["']/i);
      
      const raw = (appleMatch || iconMatch)?.[1];
      if (raw) {
        const resolved = raw.startsWith('http') ? raw : new URL(raw, url).href;
        console.log(id + ': ' + resolved);
      } else {
        console.log(id + ': NOT_FOUND (from ' + url + ')');
      }
    } catch(e) {
      console.log(id + ': ERR: ' + e.message);
    }
  }
}

checkAll();
