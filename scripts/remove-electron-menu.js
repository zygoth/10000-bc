const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'build', 'electron.js');

if (!fs.existsSync(filePath)) {
  console.error('File ./build/electron.js not found. Run npm run build first.');
  process.exit(1);
}

const oldText = '// In production, set the initial browser path to the local bundle generated';
const newText = 'mainWindow.setMenuBarVisibility(false); mainWindow.removeMenu(); mainWindow.setMenu(null); // In production, set the initial browser path to the local bundle generated';

const source = fs.readFileSync(filePath, 'utf8');
if (!source.includes(oldText)) {
  console.warn('Expected replacement marker not found. Skipping menu patch.');
  process.exit(0);
}

fs.writeFileSync(filePath, source.replace(oldText, newText), 'utf8');
console.log('Patched build/electron.js to remove window menu bar.');
