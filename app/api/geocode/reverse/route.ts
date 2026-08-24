import { NextRequest, NextResponse } from "next/server";

export interface GeocodeResult {
  name: string;
  region?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  source?: string;
}

// In-memory cache for reverse geocoding results (keyed by rounded lat,lng)
const geocodeCache = new Map<string, { data: GeocodeResult; expiresAt: number }>();

// Curated major world cities for offline reverse geocoding fallback
interface OfflineCity {
  name: string;
  region?: string;
  country: string;
  lat: number;
  lng: number;
  tz: number;
}

const OFFLINE_CITIES: OfflineCity[] = [
  // Southeast Asia & East Asia
  { name: "Bogor", region: "West Java", country: "Indonesia", lat: -6.595, lng: 106.8166, tz: 7 },
  { name: "Jakarta", region: "DKI Jakarta", country: "Indonesia", lat: -6.2088, lng: 106.8456, tz: 7 },
  { name: "Bandung", region: "West Java", country: "Indonesia", lat: -6.9175, lng: 107.6191, tz: 7 },
  { name: "Surabaya", region: "East Java", country: "Indonesia", lat: -7.2575, lng: 112.7521, tz: 7 },
  { name: "Yogyakarta", region: "DI Yogyakarta", country: "Indonesia", lat: -7.7956, lng: 110.3695, tz: 7 },
  { name: "Medan", region: "North Sumatra", country: "Indonesia", lat: 3.5952, lng: 98.6722, tz: 7 },
  { name: "Denpasar (Bali)", region: "Bali", country: "Indonesia", lat: -8.6705, lng: 115.2126, tz: 8 },
  { name: "Makassar", region: "South Sulawesi", country: "Indonesia", lat: -5.1477, lng: 119.4327, tz: 8 },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198, tz: 8 },
  { name: "Kuala Lumpur", country: "Malaysia", lat: 3.139, lng: 101.6869, tz: 8 },
  { name: "Bangkok", country: "Thailand", lat: 13.7563, lng: 100.5018, tz: 7 },
  { name: "Hanoi", country: "Vietnam", lat: 21.0285, lng: 105.8542, tz: 7 },
  { name: "Ho Chi Minh City", country: "Vietnam", lat: 10.8231, lng: 106.6297, tz: 7 },
  { name: "Manila", country: "Philippines", lat: 14.5995, lng: 120.9842, tz: 8 },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, tz: 9 },
  { name: "Osaka", country: "Japan", lat: 34.6937, lng: 135.5023, tz: 9 },
  { name: "Kyoto", country: "Japan", lat: 35.0116, lng: 135.7681, tz: 9 },
  { name: "Sapporo", country: "Japan", lat: 43.0618, lng: 141.3545, tz: 9 },
  { name: "Seoul", country: "South Korea", lat: 37.5665, lng: 126.978, tz: 9 },
  { name: "Beijing", country: "China", lat: 39.9042, lng: 116.4074, tz: 8 },
  { name: "Shanghai", country: "China", lat: 31.2304, lng: 121.4737, tz: 8 },
  { name: "Hong Kong", country: "Hong Kong SAR", lat: 22.3193, lng: 114.1694, tz: 8 },
  { name: "Taipei", country: "Taiwan", lat: 25.033, lng: 121.5654, tz: 8 },

  // South & Central Asia
  { name: "New Delhi", country: "India", lat: 28.6139, lng: 77.209, tz: 5.5 },
  { name: "Mumbai", country: "India", lat: 19.076, lng: 72.8777, tz: 5.5 },
  { name: "Bengaluru", country: "India", lat: 12.9716, lng: 77.5946, tz: 5.5 },
  { name: "Dhaka", country: "Bangladesh", lat: 23.8103, lng: 90.4125, tz: 6 },
  { name: "Karachi", country: "Pakistan", lat: 24.8607, lng: 67.0011, tz: 5 },
  { name: "Kathmandu", country: "Nepal", lat: 27.7172, lng: 85.324, tz: 5.75 },
  { name: "Colombo", country: "Sri Lanka", lat: 6.9271, lng: 79.8612, tz: 5.5 },
  { name: "Tashkent", country: "Uzbekistan", lat: 41.2995, lng: 69.2401, tz: 5 },
  { name: "Almaty", country: "Kazakhstan", lat: 43.222, lng: 76.8512, tz: 5 },

  // Middle East & North Africa
  { name: "Dubai", country: "United Arab Emirates", lat: 25.2048, lng: 55.2708, tz: 4 },
  { name: "Abu Dhabi", country: "United Arab Emirates", lat: 24.4539, lng: 54.3773, tz: 4 },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lng: 46.6753, tz: 3 },
  { name: "Mecca", country: "Saudi Arabia", lat: 21.3891, lng: 39.8579, tz: 3 },
  { name: "Cairo", country: "Egypt", lat: 30.0444, lng: 31.2357, tz: 2 },
  { name: "Alexandria", country: "Egypt", lat: 31.2001, lng: 29.9187, tz: 2 },
  { name: "Istanbul", country: "Turkey", lat: 41.0082, lng: 28.9784, tz: 3 },
  { name: "Ankara", country: "Turkey", lat: 39.9334, lng: 32.8597, tz: 3 },
  { name: "Tehran", country: "Iran", lat: 35.6892, lng: 51.389, tz: 3.5 },
  { name: "Doha", country: "Qatar", lat: 25.2854, lng: 51.531, tz: 3 },
  { name: "Casablanca", country: "Morocco", lat: 33.5731, lng: -7.5898, tz: 1 },

  // Europe
  { name: "London", country: "United Kingdom", lat: 51.5074, lng: -0.1278, tz: 0 },
  { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522, tz: 1 },
  { name: "Berlin", country: "Germany", lat: 52.52, lng: 13.405, tz: 1 },
  { name: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, tz: 1 },
  { name: "Madrid", country: "Spain", lat: 40.4168, lng: -3.7038, tz: 1 },
  { name: "La Palma (Observatory)", region: "Canary Islands", country: "Spain", lat: 28.7567, lng: -17.8819, tz: 0 },
  { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041, tz: 1 },
  { name: "Brussels", country: "Belgium", lat: 50.8503, lng: 4.3517, tz: 1 },
  { name: "Vienna", country: "Austria", lat: 48.2082, lng: 16.3738, tz: 1 },
  { name: "Zurich", country: "Switzerland", lat: 47.3769, lng: 8.5417, tz: 1 },
  { name: "Athens", country: "Greece", lat: 37.9838, lng: 23.7275, tz: 2 },
  { name: "Stockholm", country: "Sweden", lat: 59.3293, lng: 18.0686, tz: 1 },
  { name: "Oslo", country: "Norway", lat: 59.9139, lng: 10.7522, tz: 1 },
  { name: "Helsinki", country: "Finland", lat: 60.1699, lng: 24.9384, tz: 2 },
  { name: "Copenhagen", country: "Denmark", lat: 55.6761, lng: 12.5683, tz: 1 },
  { name: "Reykjavik", country: "Iceland", lat: 64.1466, lng: -21.9426, tz: 0 },
  { name: "Warsaw", country: "Poland", lat: 52.2297, lng: 21.0122, tz: 1 },
  { name: "Prague", country: "Czech Republic", lat: 50.0755, lng: 14.4378, tz: 1 },
  { name: "Moscow", country: "Russia", lat: 55.7558, lng: 37.6173, tz: 3 },
  { name: "Saint Petersburg", country: "Russia", lat: 59.9343, lng: 30.3351, tz: 3 },
  { name: "Kyiv", country: "Ukraine", lat: 50.4501, lng: 30.5234, tz: 2 },

  // North America
  { name: "New York", region: "New York", country: "United States", lat: 40.7128, lng: -74.006, tz: -5 },
  { name: "Los Angeles", region: "California", country: "United States", lat: 34.0522, lng: -118.2437, tz: -8 },
  { name: "Chicago", region: "Illinois", country: "United States", lat: 41.8781, lng: -87.6298, tz: -6 },
  { name: "Houston", region: "Texas", country: "United States", lat: 29.7604, lng: -95.3698, tz: -6 },
  { name: "San Francisco", region: "California", country: "United States", lat: 37.7749, lng: -122.4194, tz: -8 },
  { name: "Seattle", region: "Washington", country: "United States", lat: 47.6062, lng: -122.3321, tz: -8 },
  { name: "Miami", region: "Florida", country: "United States", lat: 25.7617, lng: -80.1918, tz: -5 },
  { name: "Honolulu (Mauna Kea)", region: "Hawaii", country: "United States", lat: 19.8206, lng: -155.4681, tz: -10 },
  { name: "Anchorage", region: "Alaska", country: "United States", lat: 61.2181, lng: -149.9003, tz: -9 },
  { name: "Toronto", region: "Ontario", country: "Canada", lat: 43.6532, lng: -79.3832, tz: -5 },
  { name: "Vancouver", region: "British Columbia", country: "Canada", lat: 49.2827, lng: -123.1207, tz: -8 },
  { name: "Montreal", region: "Quebec", country: "Canada", lat: 45.5017, lng: -73.5673, tz: -5 },
  { name: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332, tz: -6 },
  { name: "Cancun", country: "Mexico", lat: 21.1619, lng: -86.8515, tz: -5 },
  { name: "Havana", country: "Cuba", lat: 23.1136, lng: -82.3666, tz: -5 },

  // South America
  { name: "São Paulo", region: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333, tz: -3 },
  { name: "Rio de Janeiro", region: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729, tz: -3 },
  { name: "Brasília", country: "Brazil", lat: -15.8267, lng: -47.9218, tz: -3 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6037, lng: -58.3816, tz: -3 },
  { name: "Santiago", country: "Chile", lat: -33.4489, lng: -70.6693, tz: -4 },
  { name: "Atacama (Paranal VLT)", region: "Antofagasta", country: "Chile", lat: -24.6272, lng: -70.4042, tz: -4 },
  { name: "Lima", country: "Peru", lat: -12.0464, lng: -77.0428, tz: -5 },
  { name: "Bogotá", country: "Colombia", lat: 4.711, lng: -74.0721, tz: -5 },

  // Africa
  { name: "Johannesburg", country: "South Africa", lat: -26.2041, lng: 28.0473, tz: 2 },
  { name: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241, tz: 2 },
  { name: "Nairobi", country: "Kenya", lat: -1.2921, lng: 36.8219, tz: 3 },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792, tz: 1 },
  { name: "Addis Ababa", country: "Ethiopia", lat: 9.032, lng: 38.7482, tz: 3 },

  // Oceania
  { name: "Sydney", region: "New South Wales", country: "Australia", lat: -33.8688, lng: 151.2093, tz: 10 },
  { name: "Melbourne", region: "Victoria", country: "Australia", lat: -37.8136, lng: 144.9631, tz: 10 },
  { name: "Brisbane", region: "Queensland", country: "Australia", lat: -27.4698, lng: 153.0251, tz: 10 },
  { name: "Perth", region: "Western Australia", country: "Australia", lat: -31.9505, lng: 115.8605, tz: 8 },
  { name: "Auckland", country: "New Zealand", lat: -36.8485, lng: 174.7633, tz: 12 },
  { name: "Wellington", country: "New Zealand", lat: -41.2865, lng: 174.7762, tz: 12 },

  // Polar & Remote
  { name: "Svalbard (Longyearbyen)", country: "Norway", lat: 78.2232, lng: 15.6267, tz: 1 },
  { name: "Nuuk", country: "Greenland", lat: 64.1814, lng: -51.6941, tz: -2 },
  { name: "Amundsen-Scott Station", country: "Antarctica (South Pole)", lat: -90.0, lng: 0.0, tz: 12 },
  { name: "McMurdo Station", country: "Antarctica (Ross Island)", lat: -77.846, lng: 166.676, tz: 12 },
];

/**
 * Determine geographic marine or ocean water body if point is in open sea
 */
function identifyWaterBody(lat: number, lng: number): string {
  if (lat > 66) return "Arctic Ocean";
  if (lat < -60) return "Southern Ocean";
  if (lat >= 30 && lat <= 45 && lng >= -5 && lng <= 36) return "Mediterranean Sea";
  if (lat >= 10 && lat <= 25 && lng >= -85 && lng <= -60) return "Caribbean Sea";
  if (lat >= 5 && lat <= 25 && lng >= 50 && lng <= 75) return "Arabian Sea";
  if (lat >= 8 && lat <= 22 && lng >= 80 && lng <= 95) return "Bay of Bengal";
  if (lat >= 3 && lat <= 22 && lng >= 105 && lng <= 120) return "South China Sea";
  if (lat >= -8 && lat <= 0 && lng >= 106 && lng <= 118) return "Java Sea";
  if (lat >= -25 && lat <= -10 && lng >= 145 && lng <= 165) return "Coral Sea";
  if (lat >= 53 && lat <= 66 && lng >= 10 && lng <= 30) return "Baltic Sea";
  if (lat >= 51 && lat <= 61 && lng >= -4 && lng <= 9) return "North Sea";
  if (lat >= 0 && lat <= 30 && lng >= 32 && lng <= 43) return "Red Sea";
  if (lat >= 24 && lat <= 30 && lng >= 48 && lng <= 56) return "Persian Gulf";
  if (lat >= 18 && lat <= 30 && lng >= -98 && lng <= -80) return "Gulf of Mexico";

  // Major oceanic basins
  if (lng >= -70 && lng <= 20 && lat >= -60 && lat <= 66) return "Atlantic Ocean";
  if (lng >= 20 && lng <= 120 && lat >= -60 && lat <= 30) return "Indian Ocean";
  return "Pacific Ocean";
}

/**
 * Calculate Great-Circle distance in km between two lat/lng pairs
 */
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Offline nearest city resolver
 */
function resolveOfflineGeocode(lat: number, lng: number): GeocodeResult {
  let nearestCity = OFFLINE_CITIES[0];
  let minDistance = 999999;

  for (const city of OFFLINE_CITIES) {
    const dist = getDistanceKm(lat, lng, city.lat, city.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestCity = city;
    }
  }

  const tzHours = Math.round(lng / 15);

  if (minDistance < 250) {
    return {
      name: nearestCity.name,
      region: nearestCity.region,
      country: nearestCity.country,
      latitude: parseFloat(lat.toFixed(4)),
      longitude: parseFloat(lng.toFixed(4)),
      timezoneOffsetHours: nearestCity.tz ?? tzHours,
      source: "offline-near",
    };
  }

  const ocean = identifyWaterBody(lat, lng);
  const latStr = lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
  const lngStr = lng >= 0 ? `${lng.toFixed(1)}°E` : `${Math.abs(lng).toFixed(1)}°W`;

  return {
    name: `${ocean} (${latStr}, ${lngStr})`,
    country: minDistance < 600 ? `Near ${nearestCity.country}` : `${ocean} (International Waters)`,
    latitude: parseFloat(lat.toFixed(4)),
    longitude: parseFloat(lng.toFixed(4)),
    timezoneOffsetHours: tzHours,
    source: "offline-ocean",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: "Missing lat/lng query parameters" }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Invalid coordinate bounds" }, { status: 400 });
  }

  // Cache key rounded to 2 decimal places (~1.1 km)
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const now = Date.now();
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data);
  }

  // Primary Provider: BigDataCloud Reverse Geocoding Client API (Free, fast, no auth needed)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;

    const res = await fetch(bdcUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const country = data.countryName || "";
      const city = data.city || data.locality || data.principalSubdivision || "";
      const region = data.principalSubdivision || "";

      if (country && country.trim().length > 0) {
        const placeName = city || region || country;
        const tzHours = Math.round(lng / 15);

        const result: GeocodeResult = {
          name: placeName,
          region: region && region !== placeName ? region : undefined,
          country: country,
          latitude: parseFloat(lat.toFixed(4)),
          longitude: parseFloat(lng.toFixed(4)),
          timezoneOffsetHours: tzHours,
          source: "bigdatacloud",
        };

        geocodeCache.set(cacheKey, { data: result, expiresAt: now + 86400 * 1000 });
        return NextResponse.json(result);
      }
    }
  } catch {
    // Continue to fallback provider
  }

  // Secondary Provider: OpenStreetMap Nominatim API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&zoom=10&format=json&addressdetails=1`;

    const res = await fetch(osmUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Cakrapala-Earth-Observatory/1.0 (NASA Celestial Observatory App)",
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const country = addr.country || "";
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        addr.state ||
        addr.region ||
        "";
      const region = addr.state || addr.region || addr.county || "";

      if (country && country.trim().length > 0) {
        const placeName = city || country;
        const tzHours = Math.round(lng / 15);

        const result: GeocodeResult = {
          name: placeName,
          region: region && region !== placeName ? region : undefined,
          country: country,
          latitude: parseFloat(lat.toFixed(4)),
          longitude: parseFloat(lng.toFixed(4)),
          timezoneOffsetHours: tzHours,
          source: "nominatim",
        };

        geocodeCache.set(cacheKey, { data: result, expiresAt: now + 86400 * 1000 });
        return NextResponse.json(result);
      }
    }
  } catch {
    // Continue to offline fallback
  }

  // Tertiary Provider: Accurate Offline Cities & Ocean Geocoder
  const offlineResult = resolveOfflineGeocode(lat, lng);
  geocodeCache.set(cacheKey, { data: offlineResult, expiresAt: now + 86400 * 1000 });
  return NextResponse.json(offlineResult);
}
