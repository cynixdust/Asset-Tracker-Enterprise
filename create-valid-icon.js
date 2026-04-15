import fs from 'fs';
import { PNG } from 'pngjs';
import path from 'path';

const width = 256;
const height = 256;
const png = new PNG({ width, height });

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (width * y + x) << 2;
    png.data[idx] = 0;     // Red
    png.data[idx + 1] = 0; // Green
    png.data[idx + 2] = 255; // Blue
    png.data[idx + 3] = 255; // Alpha
  }
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

png.pack().pipe(fs.createWriteStream(path.join('public', 'icon.png')))
  .on('finish', () => {
    console.log('Valid 256x256 PNG created at public/icon.png');
  });
