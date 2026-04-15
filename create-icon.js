import fs from 'fs';
import path from 'path';

// 256x256 solid blue PNG
const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAADRJREFUGBntwQEBAAAAgiD/r25IQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfBuCAAAB0ni46AAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Data, 'base64');

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

fs.writeFileSync(path.join('public', 'icon.png'), buffer);
console.log('Icon created successfully at public/icon.png');
