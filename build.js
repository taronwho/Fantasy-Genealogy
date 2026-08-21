/* Sestaví jednosouborové verze aplikace.
 *   node build.js
 *   → dist/kroniky-rodu.html   samostatný soubor (stačí otevřít v prohlížeči)
 *   → dist/artifact.html       tentýž obsah bez obalu <html>/<head>/<body>
 *                              (pro publikování jako stránka)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').trimEnd();
}

let body = html;

// vložíme styl
body = body.replace(/[ \t]*<link rel="stylesheet" href="([^"]+)">/g, (m, href) =>
  '<style>\n' + read(href) + '\n</style>');

// vložíme skripty v původním pořadí
body = body.replace(/[ \t]*<script src="([^"]+)"><\/script>/g, (m, src) =>
  '<script>\n' + read(src) + '\n</script>');

const external = body.match(/<(?:link|script|img)[^>]+(?:href|src)="(?!data:)([^"]+)"/g);
if (external) {
  console.error('Pozor: v souboru zůstaly externí odkazy:', external.join(', '));
  process.exit(1);
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'kroniky-rodu.html'), body);

// verze pro publikování: bez <!doctype>, <html>, <head> a <body>
const head = body.slice(body.indexOf('<head>') + 6, body.indexOf('</head>'));
const inner = body.slice(body.indexOf('<body') , body.lastIndexOf('</body>'));
const fragment = head
  .replace(/[ \t]*<meta[^>]*>\n?/g, '')
  .trim() + '\n\n' + inner.replace(/^<body[^>]*>\n?/, '').trim() + '\n';
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), fragment);

const kb = n => (n / 1024).toFixed(0) + ' kB';
console.log('dist/kroniky-rodu.html', kb(body.length));
console.log('dist/artifact.html    ', kb(fragment.length));
