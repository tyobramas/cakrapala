// lib/osint/layers/sea/sentinel.ts
// ─────────────────────────────────────────────────────────────────────────────
// AIS Sentinel Values, Quality Evaluator & Category Mapping
//
// ITU-R M.1371 / Digitraffic standards:
//   - Heading 511, COG >= 360.0, ROT -128, SOG >= 102.3 are sentinel "not available".
//   - Raw 'timestamp' is 0..59 second-of-minute, NOT epoch. 62/63 indicate degraded/inop.
//   - 'timestampExternal' is the authoritative epoch milliseconds.
// ─────────────────────────────────────────────────────────────────────────────

export interface RotResult {
  rotDegMin?: number;
  fastTurn?: 'left' | 'right';
  raw?: number;
}

export interface SogResult {
  sogKnots?: number;
  speedMs?: number;
}

export interface NavStatResult {
  code: number;
  labelId: string;
  labelEn: string;
  isSpecial: boolean;
  isEmergency: boolean;
}

export interface ShipTypeResult {
  code: number;
  category: 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'military' | 'tug' | 'sailing' | 'pleasure' | 'high_speed' | 'pilot_sar' | 'other';
  labelId: string;
  labelEn: string;
  severity: number; // visual scale channel (not danger, unless SART)
}

export type VesselFreshness = 'fresh' | 'stale' | 'last_known' | 'drop';

/**
 * Parses AIS true heading in degrees.
 * 511 = not available. Valid range: 0..359.
 */
export function parseHeading(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const num = Number(val);
  if (isNaN(num)) return undefined;
  if (num === 511) return undefined;
  if (num < 0 || num > 359) return undefined;
  return num;
}

/**
 * Parses AIS Course Over Ground (COG) in degrees.
 * 360.0 or >= 360 = not available. Valid range: 0..359.9.
 */
export function parseCog(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const num = Number(val);
  if (isNaN(num)) return undefined;
  if (num >= 360.0 || num < 0) return undefined;
  return num;
}

/**
 * Parses AIS Rate of Turn (ROT).
 * -128 = not available.
 * -127 = turning left fast (> 5° / 30s).
 * +127 = turning right fast (> 5° / 30s).
 * -126..126 = valid precision sensor rate.
 */
export function parseRot(val: unknown): RotResult {
  if (val === null || val === undefined || val === '') {
    return { raw: undefined };
  }
  const num = Number(val);
  if (isNaN(num) || num === -128) {
    return { raw: undefined };
  }
  if (num === -127) {
    return { fastTurn: 'left', raw: num };
  }
  if (num === 127) {
    return { fastTurn: 'right', raw: num };
  }
  return { rotDegMin: num, raw: num };
}

/**
 * Parses AIS Speed Over Ground (SOG) in knots and converts to m/s.
 * 102.3 or >= 102.3 = not available. Valid range: 0..102.2.
 */
export function parseSog(val: unknown): SogResult {
  if (val === null || val === undefined || val === '') return {};
  const num = Number(val);
  if (isNaN(num) || num >= 102.3 || num < 0) return {};
  return {
    sogKnots: num,
    speedMs: num * 0.514444,
  };
}

/**
 * Navigational status definitions (0..15).
 * Highlights: 2, 3, 6, and 14 (emergency).
 */
const NAV_STAT_MAP: Record<number, { id: string; en: string; special: boolean; emergency: boolean }> = {
  0: { id: 'Berlayar dengan mesin', en: 'Under way using engine', special: false, emergency: false },
  1: { id: 'Berlabuh jangkar', en: 'At anchor', special: true, emergency: false },
  2: { id: 'Tidak di bawah kendali', en: 'Not under command', special: true, emergency: false },
  3: { id: 'Kemampuan olah gerak terbatas', en: 'Restricted manoeuvrability', special: true, emergency: false },
  4: { id: 'Dibatasi sarat air', en: 'Constrained by draught', special: false, emergency: false },
  5: { id: 'Tertambat (moored)', en: 'Moored', special: false, emergency: false },
  6: { id: 'Kandas (aground)', en: 'Aground', special: true, emergency: false },
  7: { id: 'Menangkap ikan', en: 'Engaged in fishing', special: false, emergency: false },
  8: { id: 'Berlayar dengan layar', en: 'Under way sailing', special: false, emergency: false },
  11: { id: 'Menunda di belakang', en: 'Power-driven vessel towing astern', special: false, emergency: false },
  12: { id: 'Mendorong / menunda di lambung', en: 'Pushing ahead / towing alongside', special: false, emergency: false },
  14: { id: 'DARURAT: AIS-SART / MOB / EPIRB Aktif', en: 'EMERGENCY: AIS-SART / MOB / EPIRB active', special: true, emergency: true },
  15: { id: 'Tidak terdefinisi', en: 'Undefined', special: false, emergency: false },
};

export function parseNavStat(val: unknown): NavStatResult {
  const code = Number(val);
  if (isNaN(code) || !(code in NAV_STAT_MAP)) {
    return {
      code: isNaN(code) ? 15 : code,
      labelId: 'Tidak terdefinisi',
      labelEn: 'Undefined',
      isSpecial: false,
      isEmergency: false,
    };
  }
  const entry = NAV_STAT_MAP[code];
  return {
    code,
    labelId: entry.id,
    labelEn: entry.en,
    isSpecial: entry.special,
    isEmergency: entry.emergency,
  };
}

/**
 * Maps numeric AIS shipType code to category, readable labels, and visual scale severity.
 */
export function parseShipType(code: unknown): ShipTypeResult {
  const c = Number(code);
  if (isNaN(c)) {
    return {
      code: 0,
      category: 'other',
      labelId: 'Lainnya',
      labelEn: 'Other',
      severity: 0.4,
    };
  }

  if (c === 30) {
    return { code: c, category: 'fishing', labelId: 'Kapal Nelayan', labelEn: 'Fishing Vessel', severity: 0.5 };
  }
  if (c === 35 || c === 55) {
    return { code: c, category: 'military', labelId: 'Militer / Penegak Hukum', labelEn: 'Military / Law Enforcement', severity: 0.7 };
  }
  if (c === 36) {
    return { code: c, category: 'sailing', labelId: 'Kapal Layar', labelEn: 'Sailing Vessel', severity: 0.3 };
  }
  if (c === 37) {
    return { code: c, category: 'pleasure', labelId: 'Kapal Pesiar / Yacht', labelEn: 'Pleasure Craft', severity: 0.3 };
  }
  if (c >= 40 && c <= 49) {
    return { code: c, category: 'high_speed', labelId: 'Kapal Cepat (HSC)', labelEn: 'High Speed Craft', severity: 0.6 };
  }
  if (c === 50 || c === 51) {
    return { code: c, category: 'pilot_sar', labelId: 'Kapal Pandu / SAR', labelEn: 'Pilot / SAR Vessel', severity: 0.5 };
  }
  if (c === 31 || c === 32 || c === 52) {
    return { code: c, category: 'tug', labelId: 'Kapal Tunda (Tug)', labelEn: 'Tug / Towing', severity: 0.5 };
  }
  if (c >= 60 && c <= 69) {
    return { code: c, category: 'passenger', labelId: 'Kapal Penumpang / Ferry', labelEn: 'Passenger Ship', severity: 0.8 };
  }
  if (c >= 70 && c <= 79) {
    return { code: c, category: 'cargo', labelId: 'Kapal Kargo / Barang', labelEn: 'Cargo Vessel', severity: 1.0 };
  }
  if (c >= 80 && c <= 89) {
    return { code: c, category: 'tanker', labelId: 'Kapal Tanker', labelEn: 'Tanker', severity: 1.0 };
  }

  return {
    code: c,
    category: 'other',
    labelId: 'Lainnya / Khusus',
    labelEn: 'Other / Special Craft',
    severity: 0.4,
  };
}

/**
 * Classifies position freshness based on seconds since position timestamp.
 *   <= 5 min (300 s)  -> fresh (DR allowed)
 *   5m .. 1 hr        -> stale (dimmed, no DR)
 *   1 hr .. 12 hr     -> last_known (hollow circle)
 *   > 12 hr (43200 s) -> drop
 */
export function classifyFreshness(ageSeconds: number): VesselFreshness {
  if (ageSeconds <= 300) return 'fresh';
  if (ageSeconds <= 3600) return 'stale';
  if (ageSeconds <= 43200) return 'last_known';
  return 'drop';
}

/**
 * Evaluates whether position is reliable.
 * In AIS, raw 'timestamp' is 0..59 second.
 * 62 = Dead reckoning mode
 * 63 = Positioning system inoperative
 * posAcc = false indicates lower accuracy (> 10m)
 */
export function isPositionReliable(tsSecond: unknown, posAcc: unknown): boolean {
  const ts = Number(tsSecond);
  if (ts === 62 || ts === 63) return false;
  if (posAcc === false) return false;
  return true;
}
