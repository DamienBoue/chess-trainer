// After `expo export --platform web`: make the static site fit GitHub Pages
// and phones. The page gets the manifest and the home-screen icons (install
// as an app), and 404.html serves the app for deep links (/chess-trainer/parties
// reloaded), since Pages has no rewrite rules.
import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve(process.argv[2] ?? 'dist')
const base = '/chess-trainer'
const index = path.join(dist, 'index.html')
let html = fs.readFileSync(index, 'utf8')
const head = [
  `<link rel="manifest" href="${base}/manifest.webmanifest">`,
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
  '<meta name="theme-color" content="#1a1a1a">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black">',
  '<meta name="apple-mobile-web-app-title" content="Chess Trainer">',
].join('')
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `${head}</head>`)
html = html.replace(/<html lang="[^"]*"/, '<html lang="fr"')
fs.writeFileSync(index, html)
fs.writeFileSync(path.join(dist, '404.html'), html)
console.log(`postexport: manifest + icons in ${index}, 404.html written`)
