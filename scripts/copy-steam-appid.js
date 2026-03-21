const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, 'steam_appid.txt');
const targetDir = path.resolve(__dirname, '..', 'dist', 'win-unpacked');
const target = path.join(targetDir, 'steam_appid.txt');

if (!fs.existsSync(source)) {
  console.warn('scripts/steam_appid.txt was not found. Skipping copy.');
  process.exit(0);
}

if (!fs.existsSync(targetDir)) {
  console.warn('dist/win-unpacked was not found. Run electron:package:win first.');
  process.exit(0);
}

fs.copyFileSync(source, target);
console.log('Copied steam_appid.txt to dist/win-unpacked/');
