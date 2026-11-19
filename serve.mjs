// Tiny static server with caching disabled (avoids stale JS while developing). Usage: node serve.mjs
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'},root=process.cwd();
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,path.normalize(p));
 if(!f.startsWith(root)){r.writeHead(403).end();return;}
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404).end('Not found');return;}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}).end(d);});
}).listen(8080,()=>console.log('Open http://localhost:8080'));
