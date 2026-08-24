import fs from "fs";
import path from "path";
import https from "https";

const MOONS_DIR = path.resolve("public/textures/moons");
if (!fs.existsSync(MOONS_DIR)) {
  fs.mkdirSync(MOONS_DIR, { recursive: true });
}

const MOON_SOURCES = {
  moon: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/480px-FullMoon2010.jpg",
  phobos: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Phobos_colour_2008.jpg/480px-Phobos_colour_2008.jpg",
  deimos: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Deimos-MRO.jpg/480px-Deimos-MRO.jpg",
  io: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Io_highest_resolution_true_color.jpg/480px-Io_highest_resolution_true_color.jpg",
  europa: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Europa-moon-with-margins.jpg/480px-Europa-moon-with-margins.jpg",
  ganymede: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Ganymede_g1_true-edit1.jpg/480px-Ganymede_g1_true-edit1.jpg",
  callisto: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Callisto.jpg/480px-Callisto.jpg",
  titan: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Titan_in_true_color.jpg/480px-Titan_in_true_color.jpg",
  enceladus: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/PIA17202_-_Approaching_Enceladus.jpg/480px-PIA17202_-_Approaching_Enceladus.jpg",
  mimas: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Mimas_Cassini.jpg/480px-Mimas_Cassini.jpg",
  iapetus: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/PIA08384_Iapetus_Stretching_Out.jpg/480px-PIA08384_Iapetus_Stretching_Out.jpg",
  miranda: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/PIA01354_Miranda_high_res.jpg/480px-PIA01354_Miranda_high_res.jpg",
  titania: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Titania_%28moon%29_color_crop.jpg/480px-Titania_%28moon%29_color_crop.jpg",
  triton: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Triton_moon_mosaic_Voyager_2_%28large%29.jpg/480px-Triton_moon_mosaic_Voyager_2_%28large%29.jpg",
};

async function downloadFile(url, dest) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: { "User-Agent": "CakrapalaSpaceApp/1.0 (Hackathon Educational)" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve);
      }
      if (res.statusCode !== 200) {
        console.warn(`Failed to download ${url}: status ${res.statusCode}`);
        file.close();
        return resolve(false);
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close(() => resolve(true));
      });
    });
    req.on("error", (err) => {
      console.warn(`Error downloading ${url}:`, err.message);
      file.close();
      resolve(false);
    });
  });
}

async function run() {
  console.log("🌑 Downloading real NASA moon imagery...");
  for (const [name, url] of Object.entries(MOON_SOURCES)) {
    const dest = path.join(MOONS_DIR, `${name}.jpg`);
    const ok = await downloadFile(url, dest);
    if (ok) {
      console.log(`✓ Fetched moon imagery -> ${name}.jpg`);
    }
  }
  console.log("✨ Moon textures ready.");
}

run();
