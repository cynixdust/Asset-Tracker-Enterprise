import https from 'https';
import fs from 'fs';
import path from 'path';

const url = 'https://raw.githubusercontent.com/electron/electron/main/build/icons/256x256.png';
const dest = path.join('public', 'icon.png');

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

const file = fs.createWriteStream(dest);
https.get(url, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: ${response.statusCode}`);
    process.exit(1);
  }
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download completed');
  });
}).on('error', (err) => {
  fs.unlink(dest, () => {});
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
