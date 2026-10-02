// 本地预览服务器：只服务 site/，把缓存头写对，并在构建产物变化时通知页面重载。
// python3 -m http.server 只发 Last-Modified，没有 Cache-Control，浏览器会按文件年龄猜新鲜度；
// 而整站的版本号 ?v= 写在 index.html 里，index.html 一旦被缓存，app.js、样式和数据就全退回旧构建。
// 所以这里：HTML/JS/CSS/JSON 一律 no-store，只有按内容打戳的 media/ 允许长缓存。
// 缓存头只管「要不要回源」，管不到已经打开的那一页：本站是 hash 路由，改 URL 的片段不会重新取文档，
// 页面数据又是首次加载时一次性抓进内存的，所以产物变了得由这里推一声，页面自己 reload。
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../site');
const arg = (name, fallback) => process.argv.find((item) => item.startsWith(`--${name}=`))?.split('=')[1] || fallback;
const host = arg('host', process.env.SERVE_HOST || '127.0.0.1');
const port = Number(arg('port', process.env.SERVE_PORT || 8765));

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.ico': 'image/x-icon', '.map': 'application/json; charset=utf-8',
};

// 追加到每个 HTML 末尾。
// 1. 彻底注销 localhost 下可能存在的旧 ServiceWorker 和 CacheStorage。
// 2. 监听 pageshow 与 visibilitychange：当浏览器恢复休眠标签页或切回标签页时，检测服务端签名，若有更新立即刷新。
// 3. 建立 EventSource 连接，并在握手时带上当前页面签名；若服务端已有新签名，连接建立瞬间就触发 reload。
const liveSnippet = (sig) => `<script>
(function() {
  window.__BUILD_SIG__ = ${JSON.stringify(sig)};
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(rs) {
      for (var i = 0; i < rs.length; i++) rs[i].unregister();
    });
  }
  if ('caches' in window) {
    caches.keys().then(function(ks) {
      for (var i = 0; i < ks.length; i++) caches.delete(ks[i]);
    });
  }
  window.addEventListener('pageshow', function(e) {
    if (e.persisted || (window.performance && window.performance.navigation && window.performance.navigation.type === 2)) {
      location.reload();
    }
  });
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      fetch('/__sig').then(function(r) { return r.text(); }).then(function(s) {
        if (s && window.__BUILD_SIG__ && s !== window.__BUILD_SIG__) {
          location.reload();
        }
      }).catch(function() {});
    }
  });
  try {
    var es = new EventSource('/__live?sig=' + encodeURIComponent(window.__BUILD_SIG__ || ''));
    es.onmessage = function() { location.reload(); };
  } catch(e) {}
})();
</script>\n`;

const liveClients = new Set();

function liveStream(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  res.write('retry: 1000\n\n');
  const url = new URL(req.url, `http://${host}`);
  const clientSig = url.searchParams.get('sig');
  if (clientSig && clientSig !== lastSignature) {
    res.write('data: reload\n\n');
  }
  liveClients.add(res);
  // 纯注释帧不会触发 onmessage，只是让空闲连接不被当成死掉。
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
    liveClients.delete(res);
  });
}

// 一次 build 会同步重写 160 多个产物，fs.watch 的事件要分十几批才送完，按事件防抖实测仍会推十几次、
// 把同一页连刷十几遍。所以这里不听事件流，只轮询几个关键产物的 mtime 签名：
// data/search.json 是 build() 的最后一笔，签名连续两次采样一致才算这波写完，于是一次构建只推一次重载。
// media/ 不进签名——换图会落几十个文件，而它们各自带内容戳、换图必换 URL，不值得打断阅读。
const liveMarkers = ['index.html', 'data/search.json', 'qing-content.js', 'templates.js', 'app.js', 'styles.css'];
const liveSignature = () => liveMarkers
  .map((name) => Math.floor(fs.statSync(path.join(siteDir, name), { throwIfNoEntry: false })?.mtimeMs || 0))
  .join('|');

let lastSignature = liveSignature();
let pendingSignature = null;
setInterval(() => {
  const current = liveSignature();
  if (current === lastSignature) { pendingSignature = null; return; }
  if (pendingSignature !== current) { pendingSignature = current; return; }
  lastSignature = current;
  pendingSignature = null;
  if (!liveClients.size) return;
  console.log(`实时重载 → ${liveClients.size} 个页面`);
  for (const client of liveClients) client.write('data: reload\n\n');
}, 400).unref();

const server = http.createServer((req, res) => {
  const raw = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
  if (raw === '/__live') { liveStream(req, res); return; }
  if (raw === '/__sig') {
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
    });
    res.end(lastSignature);
    return;
  }
  const rel = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  const file = path.resolve(siteDir, rel);
  if (!file.startsWith(`${siteDir}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'cache-control': 'no-store' }).end('not found');
    return;
  }
  // media 的文件名旁挂着内容戳，换图必换 URL，可以放心缓存一年；其余每次回源。
  const isMedia = rel.startsWith('media/');
  const cache = isMedia
    ? 'public, max-age=31536000, immutable'
    : 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
  const stat = fs.statSync(file);
  const ext = path.extname(file).toLowerCase();
  const headers = {
    'content-type': mime[ext] || 'application/octet-stream',
    'cache-control': cache,
    'pragma': 'no-cache',
    'expires': '0',
    'last-modified': stat.mtime.toUTCString(),
  };
  if (!isMedia) {
    headers['clear-site-data'] = '"cache"';
  }
  // HTML 每次现读现拼，注入的脚本不在磁盘文件里，所以长度不能照抄 stat。
  if (ext === '.html') {
    const body = Buffer.from(fs.readFileSync(file, 'utf8').replace('</body>', `${liveSnippet(lastSignature)}</body>`));
    res.writeHead(200, { ...headers, 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }
  res.writeHead(200, { ...headers, 'content-length': stat.size });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
});

if (!fs.existsSync(path.join(siteDir, 'index.html'))) {
  console.error(`FAIL: ${siteDir} 里没有 index.html，先运行 npm run build`);
  process.exitCode = 1;
  process.exit(1);
}

server.listen(port, host, () => {
  console.log(`预览 http://${host}:${port}/ （根目录 ${siteDir}）`);
  console.log('改完内容先 npm run build（或开着 npm run watch），页面会自己重载；关掉本命令即停止服务。');
});
