const fs = require('fs');
const path = require('path');
const dir = '/Users/vandijk/Downloads/Telegram Desktop/SC';

function walk(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git') continue;
    const filePath = path.join(directory, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath);
    } else if (filePath.match(/\.(html|js|css|json)$/)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('CryptoPlexTrade')) {
        const newContent = content.replace(/CryptoPlexTrade/g, 'CryptoPlexTrade');
        fs.writeFileSync(filePath, newContent);
        console.log(`Updated ${filePath}`);
      }
    }
  }
}
walk(dir);
