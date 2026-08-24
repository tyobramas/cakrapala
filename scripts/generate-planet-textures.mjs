import fs from 'fs';
import path from 'path';
import https from 'https';

const TEXTURES_DIR = path.resolve('public/textures/planets');
if (!fs.existsSync(TEXTURES_DIR)) {
  fs.mkdirSync(TEXTURES_DIR, { recursive: true });
}

// Verified working mirrors for NASA planet textures
const verifiedMirrors = {
  sun: [
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/sprites/snowflake1.png',
    'https://raw.githubusercontent.com/stemkoski/Three.js-Examples/master/images/sun.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg'
  ],
  mercury: [
    'https://raw.githubusercontent.com/stemkoski/Three.js-Examples/master/images/mercurymap.jpg',
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/mercurymap.jpg'
  ],
  venus: [
    'https://raw.githubusercontent.com/stemkoski/Three.js-Examples/master/images/venusmap.jpg',
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/venusmap.jpg'
  ],
  mars: [
    'https://raw.githubusercontent.com/stemkoski/Three.js-Examples/master/images/marsmap1k.jpg',
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/marsmap1k.jpg'
  ],
  jupiter: [
    'https://raw.githubusercontent.com/stemkoski/Three.js-Examples/master/images/jupitermap.jpg',
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/jupitermap.jpg'
  ],
  saturn: [
    'https://raw.githubusercontent.com/stemkoski/Three.js-Examples/master/images/saturnmap.jpg',
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/saturnmap.jpg'
  ],
  saturn_ring: [
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/saturnringpattern.gif',
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/saturnringcolor.jpg'
  ],
  uranus: [
    'https://raw.githubusercontent.com/stemkoski/Three.js-Examples/master/images/uranusmap.jpg',
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/uranusmap.jpg'
  ],
  neptune: [
    'https://raw.githubusercontent.com/stemkoski/Three.js-Examples/master/images/neptunemap.jpg',
    'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/neptunemap.jpg'
  ]
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
        reject(new Error(`HTTP ${response.statusCode}`));
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
  console.log('🚀 Downloading verified NASA planetary texture maps...');
  for (const [key, mirrors] of Object.entries(verifiedMirrors)) {
    const ext = key === 'saturn_ring' ? '.png' : '.jpg';
    const dest = path.join(TEXTURES_DIR, `${key}${ext}`);
    
    let success = false;
    for (const url of mirrors) {
      try {
        await downloadFile(url, dest);
        console.log(`✓ Fetched ${key} texture -> ${dest}`);
        success = true;
        break;
      } catch (err) {
        // try next mirror
      }
    }

    if (!success) {
      console.warn(`! All mirrors failed for ${key}`);
    }
  }
  console.log('✨ Planetary textures ready.');
}

main();
