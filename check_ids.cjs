const fs = require('fs');
const app = fs.readFileSync('src/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const re = /\$\('([a-zA-Z0-9_-]+)'\)/g;
const ids = new Set();
let m;
while ((m = re.exec(app)) !== null) {
  ids.add(m[1]);
}
const sorted = [...ids].sort();
console.log('IDs in app.js (' + sorted.length + '):', sorted);
const missing = sorted.filter(id => !html.includes(`id="${id}"`) && !html.includes(`id='${id}'`));
console.log('Missing in index.html:', missing);
