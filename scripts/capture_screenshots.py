import subprocess
import time
import os

CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUTPUT_DIR = "/Users/bramastyokusumo/Documents/laravel/cakrapala/docs/screenshots"

PAGES = [
    ("landing.png", "http://localhost:3000", 6000),
    ("solar_system.png", "http://localhost:3000/solar-system", 7000),
    ("sky_map.png", "http://localhost:3000/sky", 7000),
    ("asteroid_radar.png", "http://localhost:3000/explore", 6000),
    ("satellite_fleet.png", "http://localhost:3000/iss", 7000),
    ("satellite_catalog.png", "http://localhost:3000/iss/catalog", 5000),
    ("space_codex.png", "http://localhost:3000/codex", 5000),
]

os.makedirs(OUTPUT_DIR, exist_ok=True)

for filename, url, budget in PAGES:
    out_path = os.path.join(OUTPUT_DIR, filename)
    print(f"Capturing {url} -> {out_path} (budget: {budget}ms)...")
    cmd = [
        CHROME_BIN,
        "--headless=new",
        "--window-size=1600,1000",
        f"--virtual-time-budget={budget}",
        f"--screenshot={out_path}",
        url
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(out_path):
        size = os.path.getsize(out_path)
        print(f"Saved {filename} ({size / 1024:.1f} KB)")
    else:
        print(f"Failed to capture {filename}")

print("All screenshots capture completed.")
