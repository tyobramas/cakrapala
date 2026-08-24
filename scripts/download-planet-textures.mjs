import fs from 'fs';
import path from 'path';
import https from 'https';

const TEXTURES_DIR = path.resolve('public/textures/planets');
if (!fs.existsSync(TEXTURES_DIR)) {
  fs.mkdirSync(TEXTURES_DIR, { recursive: true });
}

// Open NASA / Solar System Scope free texture mirrors
const textureUrls = {
  sun: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/sun.jpg',
  earth: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
  moon: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg',
  mars: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/mars_1k_color.jpg',
  mercury: 'https://raw.githubusercontent.com/joshhartley/planetary-system/master/public/textures/mercury.jpg',
  venus: 'https://raw.githubusercontent.com/joshhartley/planetary-system/master/public/textures/venus_atmosphere.jpg',
  jupiter: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/jupiter.jpg',
  saturn: 'https://raw.githubusercontent.com/joshhartley/planetary-system/master/public/textures/saturn.jpg',
  saturn_ring: 'https://raw.githubusercontent.com/joshhartley/planetary-system/master/public/textures/saturn_ring.png',
  uranus: 'https://raw.githubusercontent.com/joshhartley/planetary-system/master/public/textures/uranus.jpg',
  neptune: 'https://raw.githubusercontent.com/joshhartley/planetary-system/master/public/textures/neptune.jpg',
};

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destPath));
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('🌌 Downloading photorealistic planet textures...');
  for (const [key, url] of Object.entries(textureUrls)) {
    const ext = url.endsWith('.png') ? '.png' : '.jpg';
    const dest = path.join(TEXTURES_DIR, `${key}${ext}`);
    try {
      await downloadFile(url, dest);
      console.log(`✓ ${key} texture saved -> ${dest}`);
    } catch (err) {
      console.warn(`! Could not fetch ${key} from primary source: ${err.message}`);
    }
  }
  console.log('✅ Texture download process finished.');
}

main();
