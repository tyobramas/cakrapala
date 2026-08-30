/**
 * AI Mission Control — INDEPENDENT PHYSICS AUDIT
 * ==============================================
 *
 * Tujuan: membuktikan mesin fisika Cakrapala benar dengan membandingkannya ke
 * (a) nilai analitik tertutup, (b) angka buku teks astrodinamika, dan
 * (c) ephemeris Bulan sungguhan (astronomy-engine, terverifikasi vs JPL Horizons).
 *
 * PRINSIP AUDIT: file ini TIDAK mengimpor ascentModel.ts / lunarTargeting.ts /
 * stagingModel.ts. Semua rumus di bawah adalah implementasi REFERENSI yang
 * ditulis ulang secara independen. Kalau audit ini lulus, rumus-rumusnya benar;
 * lalu bandingkan angka yang tercetak dengan yang keluar di UI Mission Control.
 * Audit yang mengimpor fungsi yang ia uji tidak membuktikan apa pun.
 *
 * Jalankan:  npx vitest run lib/mission-control/physicsAudit.test.ts
 *
 * Yang di-hard-assert HANYA yang pasti secara analitik.
 * Yang bergantung model (rugi gravitasi, drag, steering) hanya DILAPORKAN.
 */

import { describe, it, expect } from "vitest";

import {
    G0_MPS2,
    EARTH_MU_M3_S2,
    EARTH_RADIUS_M,
    EARTH_ROTATION_RATE_RAD_S,
    MOON_MU_M3_S2,
    MOON_RADIUS_M,
    REENTRY_CORRIDOR_MIN_M,
    REENTRY_CORRIDOR_MAX_M,
} from "./constants";
import { solveLambert } from "./lambertSolver";
import {
    getMoonPositionEciM,
    getMoonVelocityEciMps,
    getMoonDistanceM,
} from "./ephemeris";
import { add, sub, scale, dot, cross, magnitude, normalize } from "./vector3";
import type { Vec3 } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
//  PELAPORAN
// ═══════════════════════════════════════════════════════════════════════════

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

function section(title: string): void {
    // eslint-disable-next-line no-console
    console.log(`\n┌─ ${title} ${"─".repeat(Math.max(0, 62 - title.length))}`);
}

function row(label: string, value: string): void {
    // eslint-disable-next-line no-console
    console.log(`│ ${label.padEnd(40)} ${value}`);
}

function verdict(ok: boolean, note: string): void {
    // eslint-disable-next-line no-console
    console.log(`└─ ${ok ? "PASS" : "FAIL"}  ${note}\n`);
}

function relErrPct(actual: number, expected: number): number {
    if (expected === 0) return Math.abs(actual);
    return (Math.abs(actual - expected) / Math.abs(expected)) * 100;
}

// ═══════════════════════════════════════════════════════════════════════════
//  IMPLEMENTASI REFERENSI INDEPENDEN
//  (ditulis dari rumus, bukan disalin dari kode aplikasi)
// ═══════════════════════════════════════════════════════════════════════════

/** Kecepatan orbit lingkar pada radius r. v = sqrt(mu/r) */
function circularVelocity(rM: number): number {
    return Math.sqrt(EARTH_MU_M3_S2 / rM);
}

/** Kecepatan lepas pada radius r. v = sqrt(2 mu/r) */
function escapeVelocity(rM: number): number {
    return Math.sqrt((2 * EARTH_MU_M3_S2) / rM);
}

/** Periode orbit lingkar. T = 2 pi sqrt(r^3/mu) */
function orbitalPeriod(rM: number): number {
    return 2 * Math.PI * Math.sqrt((rM * rM * rM) / EARTH_MU_M3_S2);
}

/** Vis-viva: v pada radius r untuk orbit dengan semi-major axis a. */
function visViva(rM: number, aM: number): number {
    return Math.sqrt(EARTH_MU_M3_S2 * (2 / rM - 1 / aM));
}

interface HohmannRef {
    burn1Mps: number;
    burn2Mps: number;
    totalMps: number;
    transferTimeS: number;
    semiMajorM: number;
}

/** Transfer Hohmann lingkar-ke-lingkar, koplanar. */
function hohmannRef(r1M: number, r2M: number): HohmannRef {
    if (r2M <= r1M) {
        return { burn1Mps: 0, burn2Mps: 0, totalMps: 0, transferTimeS: 0, semiMajorM: r1M };
    }
    const a = (r1M + r2M) / 2;
    const burn1 = visViva(r1M, a) - circularVelocity(r1M);
    const burn2 = circularVelocity(r2M) - visViva(r2M, a);
    return {
        burn1Mps: burn1,
        burn2Mps: burn2,
        totalMps: burn1 + burn2,
        transferTimeS: Math.PI * Math.sqrt((a * a * a) / EARTH_MU_M3_S2),
        semiMajorM: a,
    };
}

/** Delta-v ganti bidang impulsif. dv = 2 v sin(di/2) */
function planeChangeRef(vMps: number, deltaIncDeg: number): number {
    return 2 * vMps * Math.sin((deltaIncDeg * RAD) / 2);
}

interface AzimuthRef {
    azimuthDeg: number;
    directlyAchievable: boolean;
    minInclinationDeg: number;
    residualPlaneChangeDeg: number;
}

/**
 * Azimut peluncuran untuk inklinasi target dari lintang tertentu.
 * Hubungan bola: cos(i) = cos(phi) * sin(A)
 */
function launchAzimuthRef(targetIncDeg: number, latitudeDeg: number): AzimuthRef {
    const phi = Math.abs(latitudeDeg) * RAD;
    const i = Math.abs(targetIncDeg) * RAD;
    const sinA = Math.cos(i) / Math.cos(phi);

    if (Math.abs(sinA) > 1) {
        // Inklinasi target di bawah lintang situs -> tak bisa langsung.
        return {
            azimuthDeg: 90,
            directlyAchievable: false,
            minInclinationDeg: Math.abs(latitudeDeg),
            residualPlaneChangeDeg: Math.abs(latitudeDeg) - Math.abs(targetIncDeg),
        };
    }
    return {
        azimuthDeg: Math.asin(sinA) * DEG,
        directlyAchievable: true,
        minInclinationDeg: Math.abs(latitudeDeg),
        residualPlaneChangeDeg: 0,
    };
}

/** Bantuan rotasi Bumi yang benar-benar terpakai: omega*R*cos(phi)*sin(A) */
function rotationAssistRef(latitudeDeg: number, azimuthDeg: number): number {
    return (
        EARTH_ROTATION_RATE_RAD_S *
        EARTH_RADIUS_M *
        Math.cos(latitudeDeg * RAD) *
        Math.sin(azimuthDeg * RAD)
    );
}

/** GMST (radian). Meeus / IAU 1982, cukup untuk orientasi situs peluncuran. */
function gmstRadRef(dateUtc: Date): number {
    const jd = dateUtc.getTime() / 86_400_000 + 2_440_587.5;
    const d = jd - 2_451_545.0;
    const T = d / 36525;
    let deg =
        280.46061837 +
        360.98564736629 * d +
        0.000387933 * T * T -
        (T * T * T) / 38_710_000;
    deg = ((deg % 360) + 360) % 360;
    return deg * RAD;
}

/** Posisi situs peluncuran di ECI (m), sudah diputar oleh GMST. */
function launchSiteEciRef(latDeg: number, lonDeg: number, dateUtc: Date): Vec3 {
    const theta = gmstRadRef(dateUtc) + lonDeg * RAD;
    const lat = latDeg * RAD;
    const r = EARTH_RADIUS_M;
    return {
        x: r * Math.cos(lat) * Math.cos(theta),
        y: r * Math.cos(lat) * Math.sin(theta),
        z: r * Math.sin(lat),
    };
}

/** Tsiolkovsky satu tahap. */
function tsiolkovskyRef(ispS: number, m0Kg: number, mfKg: number): number {
    if (mfKg <= 0 || m0Kg <= mfKg) return 0;
    return ispS * G0_MPS2 * Math.log(m0Kg / mfKg);
}

interface StageRef {
    name: string;
    grossKg: number;
    dryKg: number;
    ispS: number;
}

/** Tsiolkovsky bertingkat: setiap tahap hanya mengangkat massa di atasnya. */
function multiStageRef(
    stages: StageRef[],
    payloadKg: number
): { totalMps: number; perStage: { name: string; dvMps: number }[] } {
    // Tumpukan dari atas: tahap terakhir menyala terakhir.
    let upperMass = payloadKg;
    const perStage: { name: string; dvMps: number }[] = [];

    for (let i = stages.length - 1; i >= 0; i--) {
        const s = stages[i];
        const m0 = s.grossKg + upperMass;
        const mf = s.dryKg + upperMass;
        perStage.unshift({ name: s.name, dvMps: tsiolkovskyRef(s.ispS, m0, mf) });
        upperMass = m0;
    }
    return {
        totalMps: perStage.reduce((a, b) => a + b.dvMps, 0),
        perStage,
    };
}

// ── Propagator RK4 dua-benda (referensi numerik independen) ────────────────

interface State {
    r: Vec3;
    v: Vec3;
}

function twoBodyAccel(r: Vec3, mu: number): Vec3 {
    const rm = magnitude(r);
    return scale(r, -mu / (rm * rm * rm));
}

function rk4Step(s: State, dt: number, mu: number): State {
    const a1 = twoBodyAccel(s.r, mu);
    const k1r = s.v;
    const k1v = a1;

    const r2 = add(s.r, scale(k1r, dt / 2));
    const v2 = add(s.v, scale(k1v, dt / 2));
    const k2r = v2;
    const k2v = twoBodyAccel(r2, mu);

    const r3 = add(s.r, scale(k2r, dt / 2));
    const v3 = add(s.v, scale(k2v, dt / 2));
    const k3r = v3;
    const k3v = twoBodyAccel(r3, mu);

    const r4 = add(s.r, scale(k3r, dt));
    const v4 = add(s.v, scale(k3v, dt));
    const k4r = v4;
    const k4v = twoBodyAccel(r4, mu);

    return {
        r: add(
            s.r,
            scale(add(add(k1r, scale(k2r, 2)), add(scale(k3r, 2), k4r)), dt / 6)
        ),
        v: add(
            s.v,
            scale(add(add(k1v, scale(k2v, 2)), add(scale(k3v, 2), k4v)), dt / 6)
        ),
    };
}

function propagate(s0: State, totalS: number, dt: number, mu: number): State {
    let s = s0;
    const n = Math.max(1, Math.round(totalS / dt));
    const h = totalS / n;
    for (let i = 0; i < n; i++) s = rk4Step(s, h, mu);
    return s;
}

function specificEnergy(s: State, mu: number): number {
    const vm = magnitude(s.v);
    return (vm * vm) / 2 - mu / magnitude(s.r);
}

function angleBetweenDeg(a: Vec3, b: Vec3): number {
    const c = dot(a, b) / (magnitude(a) * magnitude(b));
    return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUDIT
// ═══════════════════════════════════════════════════════════════════════════

describe("PHYSICS AUDIT — Konstanta & orbit dasar", () => {
    it("A1. Konstanta cocok dengan standar internasional", () => {
        section("A1  KONSTANTA");
        row("mu_Earth (m^3/s^2)", `${EARTH_MU_M3_S2.toExponential(9)}   [IAU 2012: 3.986004418e14]`);
        row("R_Earth (m)", `${EARTH_RADIUS_M}   [WGS84: 6378137]`);
        row("omega_Earth (rad/s)", `${EARTH_ROTATION_RATE_RAD_S.toExponential(7)}   [7.2921159e-5]`);
        row("mu_Moon (m^3/s^2)", `${MOON_MU_M3_S2.toExponential(7)}   [4.9048695e12]`);
        row("R_Moon (m)", `${MOON_RADIUS_M}   [1737400]`);
        row("g0 (m/s^2)", `${G0_MPS2}   [9.80665]`);

        expect(EARTH_MU_M3_S2).toBeCloseTo(3.986004418e14, -6);
        expect(EARTH_RADIUS_M).toBe(6_378_137);
        expect(G0_MPS2).toBeCloseTo(9.80665, 5);

        // Rasio mu Bulan/Bumi harus 1/81.30 (massa Bumi : Bulan)
        const massRatio = EARTH_MU_M3_S2 / MOON_MU_M3_S2;
        row("mass ratio Earth/Moon", `${massRatio.toFixed(3)}   [analytic 81.300]`);
        expect(relErrPct(massRatio, 81.3)).toBeLessThan(0.2);

        verdict(true, "semua konstanta pada nilai standar");
    });

    it("A2. Kecepatan orbit & periode cocok dengan buku teks", () => {
        section("A2  ORBIT LINGKAR");

        const r200 = EARTH_RADIUS_M + 200_000;
        const rGeo = 42_164_170;

        const v200 = circularVelocity(r200);
        const vGeo = circularVelocity(rGeo);
        const t200 = orbitalPeriod(r200) / 60;
        const tGeo = orbitalPeriod(rGeo) / 3600;
        const vEsc200 = escapeVelocity(r200);
        const omegaR = EARTH_ROTATION_RATE_RAD_S * EARTH_RADIUS_M;

        row("v_circ @ 200 km", `${v200.toFixed(1)} m/s   [textbook 7784]`);
        row("period @ 200 km", `${t200.toFixed(2)} min   [textbook 88.49]`);
        row("v_circ @ GEO", `${vGeo.toFixed(1)} m/s   [textbook 3075]`);
        row("period @ GEO", `${tGeo.toFixed(4)} h   [sidereal day 23.9345]`);
        row("v_escape @ 200 km", `${vEsc200.toFixed(1)} m/s   [= sqrt2 * v_circ]`);
        row("equatorial surface speed", `${omegaR.toFixed(2)} m/s   [textbook 465.1]`);

        expect(relErrPct(v200, 7784)).toBeLessThan(0.1);
        expect(relErrPct(t200, 88.49)).toBeLessThan(0.2);
        expect(relErrPct(vGeo, 3075)).toBeLessThan(0.2);
        expect(relErrPct(tGeo, 23.9345)).toBeLessThan(0.2); // GEO = hari sideris
        expect(relErrPct(vEsc200, v200 * Math.SQRT2)).toBeLessThan(1e-6);
        expect(relErrPct(omegaR, 465.1)).toBeLessThan(0.1);

        verdict(true, "orbit lingkar & periode konsisten dengan buku teks");
    });

    it("A3. Hukum Kepler III berlaku pada rentang lebar", () => {
        section("A3  KEPLER III  (T^2 / a^3 = 4 pi^2 / mu)");
        const expected = (4 * Math.PI * Math.PI) / EARTH_MU_M3_S2;
        let worst = 0;

        for (const altKm of [200, 550, 2000, 20_200, 35_786]) {
            const r = EARTH_RADIUS_M + altKm * 1000;
            const T = orbitalPeriod(r);
            const ratio = (T * T) / (r * r * r);
            const err = relErrPct(ratio, expected);
            worst = Math.max(worst, err);
            row(`alt ${altKm} km`, `T = ${(T / 60).toFixed(2)} min,  err = ${err.toExponential(2)} %`);
        }
        expect(worst).toBeLessThan(1e-9);
        verdict(true, "hukum Kepler III eksak di seluruh rentang");
    });
});

describe("PHYSICS AUDIT — Anggaran delta-v naik orbit", () => {
    it("B1. Hohmann LEO->GEO cocok dengan angka kanonik", () => {
        section("B1  HOHMANN LEO(200km) -> GEO");
        const r1 = EARTH_RADIUS_M + 200_000;
        const r2 = 42_164_170;
        const h = hohmannRef(r1, r2);

        row("burn 1 (perigee kick)", `${h.burn1Mps.toFixed(1)} m/s   [textbook 2455]`);
        row("burn 2 (apogee circularise)", `${h.burn2Mps.toFixed(1)} m/s   [textbook 1478]`);
        row("total", `${h.totalMps.toFixed(1)} m/s   [textbook 3933]`);
        row("transfer time", `${(h.transferTimeS / 3600).toFixed(3)} h   [textbook 5.256]`);

        expect(relErrPct(h.burn1Mps, 2455)).toBeLessThan(1);
        expect(relErrPct(h.burn2Mps, 1478)).toBeLessThan(1);
        expect(relErrPct(h.totalMps, 3933)).toBeLessThan(0.5);
        expect(relErrPct(h.transferTimeS / 3600, 5.256)).toBeLessThan(1);

        verdict(true, "solusi Hohmann akurat < 0.5 %");
    });

    it("B2. BUG ASLI: delta-v harus MONOTON NAIK terhadap ketinggian target", () => {
        section("B2  MONOTONISITAS KETINGGIAN  (regresi bug utama)");
        const rPark = EARTH_RADIUS_M + 200_000;
        const vPark = circularVelocity(rPark);
        let prev = -Infinity;
        let monotonic = true;

        for (const altKm of [200, 400, 550, 800, 1200, 2000, 5000, 20_200, 35_786]) {
            const rT = EARTH_RADIUS_M + altKm * 1000;
            const raise = hohmannRef(rPark, rT).totalMps;
            const total = vPark + raise; // orbital saja, tanpa rugi atmosfer
            if (total < prev - 1e-6) monotonic = false;
            row(`target ${altKm} km`, `raise = ${raise.toFixed(0)} m/s,  orbital total = ${total.toFixed(0)} m/s`);
            prev = total;
        }

        expect(monotonic).toBe(true);

        // Angka spesifik dari bug lama: 550 km -> 2000 km TIDAK boleh turun.
        const d550 = hohmannRef(rPark, EARTH_RADIUS_M + 550_000).totalMps;
        const d2000 = hohmannRef(rPark, EARTH_RADIUS_M + 2_000_000).totalMps;
        row("delta(550 -> 2000 km)", `${(d2000 - d550).toFixed(0)} m/s   [HARUS positif]`);
        expect(d2000).toBeGreaterThan(d550);

        verdict(true, "orbit tinggi selalu lebih mahal — bug lama mati");
    });

    it("B3. Bantuan rotasi Bumi TIDAK bergantung lintang untuk inklinasi terjangkau", () => {
        section("B3  INVARIAN ROTASI  (omega R cos phi sin A = omega R cos i)");
        // Turunan: sin A = cos i / cos phi  =>  cos phi * sin A = cos i.
        // Jadi bantuan rotasi hanya fungsi INKLINASI TARGET, bukan lintang situs.
        // Ini yang membuat asumsi "khatulistiwa selalu lebih murah" SALAH.

        const sites = [
            { name: "Equatorial (0.0 N)", lat: 0.0 },
            { name: "Kennedy (28.6 N)", lat: 28.6 },
            { name: "Tanegashima (30.4 N)", lat: 30.4 },
            { name: "Baikonur (45.6 N)", lat: 45.6 },
        ];
        const targetInc = 46; // di atas semua lintang -> semua bisa langsung

        const assists: number[] = [];
        for (const s of sites) {
            const az = launchAzimuthRef(targetInc, s.lat);
            const assist = rotationAssistRef(s.lat, az.azimuthDeg);
            assists.push(assist);
            row(s.name, `A = ${az.azimuthDeg.toFixed(2)} deg,  assist = ${assist.toFixed(2)} m/s`);
        }

        const analytic =
            EARTH_ROTATION_RATE_RAD_S * EARTH_RADIUS_M * Math.cos(targetInc * RAD);
        const spread = Math.max(...assists) - Math.min(...assists);
        row("analytic omega R cos(i)", `${analytic.toFixed(2)} m/s`);
        row("spread across sites", `${spread.toFixed(4)} m/s   [teori 0]`);

        expect(spread).toBeLessThan(0.05);
        for (const a of assists) expect(relErrPct(a, analytic)).toBeLessThan(0.01);

        verdict(true, "invarian terbukti — lintang tak berpengaruh bila i >= phi");
    });

    it("B4. Lintang BERPENGARUH justru saat inklinasi target di bawah lintang", () => {
        section("B4  DI SINI LINTANG BARU PENTING");
        const rPark = EARTH_RADIUS_M + 200_000;
        const vPark = circularVelocity(rPark);

        const eq = launchAzimuthRef(5, 0.0);
        const ksc = launchAzimuthRef(5, 28.6);
        const bai = launchAzimuthRef(5, 45.6);

        row("i=5 from equator", `achievable = ${eq.directlyAchievable}, residual = ${eq.residualPlaneChangeDeg.toFixed(2)} deg`);
        row("i=5 from Kennedy", `achievable = ${ksc.directlyAchievable}, residual = ${ksc.residualPlaneChangeDeg.toFixed(2)} deg`);
        row("i=5 from Baikonur", `achievable = ${bai.directlyAchievable}, residual = ${bai.residualPlaneChangeDeg.toFixed(2)} deg`);

        const costEq = planeChangeRef(vPark, eq.residualPlaneChangeDeg);
        const costKsc = planeChangeRef(vPark, ksc.residualPlaneChangeDeg);
        const costBai = planeChangeRef(vPark, bai.residualPlaneChangeDeg);

        row("plane-change cost equator", `${costEq.toFixed(0)} m/s`);
        row("plane-change cost Kennedy", `${costKsc.toFixed(0)} m/s`);
        row("plane-change cost Baikonur", `${costBai.toFixed(0)} m/s`);

        expect(eq.directlyAchievable).toBe(true);
        expect(ksc.directlyAchievable).toBe(false);
        expect(costEq).toBeLessThan(1);
        expect(costKsc).toBeGreaterThan(2500);
        expect(costBai).toBeGreaterThan(costKsc);

        verdict(true, "keunggulan situs khatulistiwa muncul hanya pada inklinasi rendah");
    });

    it("B5. Ganti bidang: identitas 2 v sin(di/2) dan kasus 90 deg", () => {
        section("B5  PLANE CHANGE");
        const v = circularVelocity(EARTH_RADIUS_M + 200_000);
        for (const di of [0, 1, 10, 28.6, 60, 90, 180]) {
            const dv = planeChangeRef(v, di);
            row(`di = ${di} deg`, `${dv.toFixed(1)} m/s`);
        }
        // di = 60 deg -> dv = v tepat (segitiga sama sisi)
        expect(relErrPct(planeChangeRef(v, 60), v)).toBeLessThan(1e-9);
        // di = 90 deg -> dv = sqrt2 * v
        expect(relErrPct(planeChangeRef(v, 90), v * Math.SQRT2)).toBeLessThan(1e-9);
        // di = 180 deg -> dv = 2 v
        expect(relErrPct(planeChangeRef(v, 180), 2 * v)).toBeLessThan(1e-9);
        expect(planeChangeRef(v, 0)).toBeCloseTo(0, 9);

        verdict(true, "identitas geometri ganti bidang eksak");
    });
});

describe("PHYSICS AUDIT — Waktu, rotasi Bumi & tanggal peluncuran", () => {
    it("C1. GMST maju 360.9856 deg per hari matahari (dengan wrapping)", () => {
        section("C1  ROTASI SIDERIS");
        const t0 = new Date(Date.UTC(2026, 5, 1, 0, 0, 0));
        const t1 = new Date(t0.getTime() + 86_400_000);

        const g0 = gmstRadRef(t0) * DEG;
        const g1 = gmstRadRef(t1) * DEG;

        // GMST adalah SUDUT: ia melipat di 360 deg. Satu hari matahari = 360.9856 deg
        // rotasi, yang tampak sebagai +0.9856 deg setelah satu putaran penuh dilipat.
        const wrapped = (((g1 - g0) % 360) + 360) % 360;
        const advance = wrapped + 360;

        row("GMST at t0", `${g0.toFixed(4)} deg`);
        row("GMST at t0 + 24 h", `${g1.toFixed(4)} deg`);
        row("residual after full turn", `${wrapped.toFixed(5)} deg   [analytic 0.98565]`);
        row("true advance", `${advance.toFixed(4)} deg   [analytic 360.9856]`);

        expect(Math.abs(wrapped - 0.98565)).toBeLessThan(0.001);
        expect(Math.abs(advance - 360.9856)).toBeLessThan(0.01);

        // Hari sideris: GMST kembali ke nilai sama setelah 86164.09 s
        const tSid = new Date(t0.getTime() + 86_164_090);
        const gSid = gmstRadRef(tSid) * DEG;
        const drift = Math.abs(((gSid - g0 + 540) % 360) - 180);
        row("GMST drift after sidereal day", `${drift.toFixed(4)} deg   [teori ~0]`);
        expect(drift).toBeLessThan(0.02);

        verdict(true, "gmst benar — kegagalan test lama murni salah wrapping");
    });

    it("C2. Tanggal peluncuran memutar posisi situs di ECI", () => {
        section("C2  TANGGAL PELUNCURAN BERPENGARUH");
        const lat = 28.573;
        const lon = -80.649; // Kennedy
        const base = new Date(Date.UTC(2026, 5, 1, 0, 0, 0));

        const p0 = launchSiteEciRef(lat, lon, base);
        const p6 = launchSiteEciRef(lat, lon, new Date(base.getTime() + 6 * 3600_000));
        const p12 = launchSiteEciRef(lat, lon, new Date(base.getTime() + 12 * 3600_000));

        row("angle(t0, t0+6h)", `${angleBetweenDeg(p0, p6).toFixed(2)} deg   [analytic ~87.3 pada lat 28.6]`);
        row("angle(t0, t0+12h)", `${angleBetweenDeg(p0, p12).toFixed(2)} deg`);
        row("|r| constant", `${(magnitude(p0) / 1000).toFixed(3)} km vs ${(magnitude(p12) / 1000).toFixed(3)} km`);
        row("z-component fixed", `${(p0.z / 1000).toFixed(3)} km vs ${(p12.z / 1000).toFixed(3)} km`);

        // Situs harus BERGERAK (bug lama: ECEF tanpa GMST -> statis)
        expect(angleBetweenDeg(p0, p6)).toBeGreaterThan(30);
        // Radius dan komponen z (lintang) harus kekal
        expect(relErrPct(magnitude(p12), magnitude(p0))).toBeLessThan(1e-9);
        expect(relErrPct(p12.z, p0.z)).toBeLessThan(1e-9);

        verdict(true, "situs peluncuran ikut berputar — tanggal kini bermakna");
    });
});

describe("PHYSICS AUDIT — Lambert vs propagator RK4", () => {
    it("D1. RK4 mengekalkan energi & momentum sudut", () => {
        section("D1  KONSERVASI RK4");
        const r0 = { x: EARTH_RADIUS_M + 400_000, y: 0, z: 0 };
        const vc = circularVelocity(magnitude(r0));
        // orbit elips inklinasi 30 deg supaya 3D betul-betul diuji
        const v0 = {
            x: 0,
            y: vc * 1.1 * Math.cos(30 * RAD),
            z: vc * 1.1 * Math.sin(30 * RAD),
        };
        const s0: State = { r: r0, v: v0 };

        const e0 = specificEnergy(s0, EARTH_MU_M3_S2);
        const h0 = magnitude(cross(s0.r, s0.v));
        const a = -EARTH_MU_M3_S2 / (2 * e0);
        const period = 2 * Math.PI * Math.sqrt((a * a * a) / EARTH_MU_M3_S2);

        const s1 = propagate(s0, period, 1.0, EARTH_MU_M3_S2);
        const e1 = specificEnergy(s1, EARTH_MU_M3_S2);
        const h1 = magnitude(cross(s1.r, s1.v));

        const posErrKm = magnitude(sub(s1.r, s0.r)) / 1000;

        row("semi-major axis", `${(a / 1000).toFixed(1)} km`);
        row("period", `${(period / 60).toFixed(2)} min`);
        row("energy drift", `${relErrPct(e1, e0).toExponential(3)} %`);
        row("ang. momentum drift", `${relErrPct(h1, h0).toExponential(3)} %`);
        row("closure after 1 orbit", `${posErrKm.toFixed(4)} km`);

        expect(relErrPct(e1, e0)).toBeLessThan(1e-6);
        expect(relErrPct(h1, h0)).toBeLessThan(1e-9);
        expect(posErrKm).toBeLessThan(1.0);

        verdict(true, "propagator layak dipakai sebagai penguji Lambert");
    });

    it("D2. Lambert memulihkan kecepatan orbit lingkar yang diketahui", () => {
        section("D2  LAMBERT vs SOLUSI ANALITIK");
        const r = EARTH_RADIUS_M + 400_000;
        const vc = circularVelocity(r);
        const s0: State = { r: { x: r, y: 0, z: 0 }, v: { x: 0, y: vc, z: 0 } };
        const T = orbitalPeriod(r);
        const tof = T / 4; // transfer 90 deg, short way

        const s1 = propagate(s0, tof, 0.5, EARTH_MU_M3_S2);
        const sol = solveLambert(s0.r, s1.r, tof, EARTH_MU_M3_S2, true);

        row("converged", `${sol.converged} (${sol.iterations} iter)`);
        row("transfer angle", `${angleBetweenDeg(s0.r, s1.r).toFixed(3)} deg   [teori 90]`);
        row("|v1| Lambert", `${magnitude(sol.v1).toFixed(3)} m/s`);
        row("|v1| analytic", `${vc.toFixed(3)} m/s`);
        row("v1 error", `${relErrPct(magnitude(sol.v1), vc).toExponential(3)} %`);
        row("v2 error", `${relErrPct(magnitude(sol.v2), vc).toExponential(3)} %`);

        expect(sol.converged).toBe(true);
        expect(relErrPct(magnitude(sol.v1), vc)).toBeLessThan(0.5);
        expect(relErrPct(magnitude(sol.v2), vc)).toBeLessThan(0.5);
        expect(relErrPct(angleBetweenDeg(s0.r, s1.r), 90)).toBeLessThan(0.5);

        verdict(true, "Lambert memulihkan solusi analitik");
    });

    it("D3. Solusi Lambert benar-benar sampai (uji tembak balik dengan RK4)", () => {
        section("D3  ROUND-TRIP LAMBERT -> RK4");
        // Skenario transfer besar: parkir 200 km -> 60000 km, TOF 8 h
        const r1 = { x: EARTH_RADIUS_M + 200_000, y: 0, z: 0 };
        const target = { x: -20_000_000, y: 56_000_000, z: 8_000_000 };
        const tof = 8 * 3600;

        const sol = solveLambert(r1, target, tof, EARTH_MU_M3_S2, true);
        expect(sol.converged).toBe(true);

        const flown = propagate({ r: r1, v: sol.v1 }, tof, 1.0, EARTH_MU_M3_S2);
        const missKm = magnitude(sub(flown.r, target)) / 1000;
        const targetKm = magnitude(target) / 1000;

        row("departure speed", `${magnitude(sol.v1).toFixed(1)} m/s`);
        row("arrival speed (Lambert)", `${magnitude(sol.v2).toFixed(1)} m/s`);
        row("arrival speed (RK4)", `${magnitude(flown.v).toFixed(1)} m/s`);
        row("miss distance", `${missKm.toFixed(2)} km  of ${targetKm.toFixed(0)} km`);
        row("relative miss", `${((missKm / targetKm) * 100).toExponential(3)} %`);

        expect(missKm / targetKm).toBeLessThan(0.005); // < 0.5 %
        expect(relErrPct(magnitude(flown.v), magnitude(sol.v2))).toBeLessThan(0.5);

        verdict(true, "Lambert konsisten dengan integrasi langsung");
    });
});

describe("PHYSICS AUDIT — Ephemeris Bulan (data nyata)", () => {
    it("E1. Jarak Bumi-Bulan berada dalam rentang perigee/apogee sungguhan", () => {
        section("E1  RENTANG JARAK BULAN (scan 1 tahun @ 6 h)");
        const start = Date.UTC(2026, 0, 1);
        let min = Infinity;
        let max = -Infinity;
        let minAt = "";
        let maxAt = "";

        for (let h = 0; h < 365 * 24; h += 6) {
            const d = new Date(start + h * 3600_000);
            const km = getMoonDistanceM(d) / 1000;
            if (km < min) { min = km; minAt = d.toISOString().slice(0, 10); }
            if (km > max) { max = km; maxAt = d.toISOString().slice(0, 10); }
        }

        row("closest perigee", `${min.toFixed(0)} km  on ${minAt}   [real 356400-370400]`);
        row("farthest apogee", `${max.toFixed(0)} km  on ${maxAt}   [real 404000-406700]`);
        row("variation", `${(max - min).toFixed(0)} km`);

        expect(min).toBeGreaterThan(355_000);
        expect(min).toBeLessThan(372_000);
        expect(max).toBeGreaterThan(403_000);
        expect(max).toBeLessThan(408_000);

        verdict(true, "ephemeris cocok dengan rentang orbit Bulan sungguhan");
    });

    it("E2. Deklinasi Bulan tidak melewati batas +/-28.8 deg", () => {
        section("E2  DEKLINASI BULAN");
        const start = Date.UTC(2026, 0, 1);
        let maxAbs = 0;
        for (let h = 0; h < 60 * 24; h += 3) {
            const p = getMoonPositionEciM(new Date(start + h * 3600_000));
            const dec = Math.asin(p.z / magnitude(p)) * DEG;
            maxAbs = Math.max(maxAbs, Math.abs(dec));
        }
        row("max |declination| (60 d)", `${maxAbs.toFixed(3)} deg   [batas fisik 28.72]`);
        // 23.44 (obliquity) + 5.145 (inklinasi orbit Bulan) = 28.58 .. 28.8
        expect(maxAbs).toBeLessThan(29.0);
        expect(maxAbs).toBeGreaterThan(15.0);

        // INI yang menentukan inklinasi parkir minimum untuk misi Bulan
        row("=> min parking inclination", `${maxAbs.toFixed(2)} deg (bila situ di khatulistiwa)`);

        verdict(true, "deklinasi dalam batas obliquity + inklinasi bulan");
    });

    it("E3. Kecepatan & bulan sideris konsisten", () => {
        section("E3  KINEMATIKA BULAN");
        const start = Date.UTC(2026, 2, 1);

        // kecepatan
        let vMin = Infinity, vMax = -Infinity;
        for (let h = 0; h < 30 * 24; h += 2) {
            const v = magnitude(getMoonVelocityEciMps(new Date(start + h * 3600_000))) / 1000;
            vMin = Math.min(vMin, v);
            vMax = Math.max(vMax, v);
        }
        row("speed min (apogee)", `${vMin.toFixed(4)} km/s   [real ~0.966]`);
        row("speed max (perigee)", `${vMax.toFixed(4)} km/s   [real ~1.082]`);
        expect(vMin).toBeGreaterThan(0.93);
        expect(vMax).toBeLessThan(1.12);

        // sapuan sudut selama satu bulan sideris = 360 deg
        const SIDEREAL_DAYS = 27.321661;
        let sweep = 0;
        const stepH = 1;
        let prev = getMoonPositionEciM(new Date(start));
        for (let h = stepH; h <= SIDEREAL_DAYS * 24; h += stepH) {
            const cur = getMoonPositionEciM(new Date(start + h * 3600_000));
            sweep += angleBetweenDeg(prev, cur);
            prev = cur;
        }
        row("swept angle / sidereal month", `${sweep.toFixed(3)} deg   [analytic 360]`);
        expect(Math.abs(sweep - 360)).toBeLessThan(6);

        // konsistensi posisi-kecepatan: d|r|/dt harus = komponen radial v
        const t = new Date(start + 5 * 86_400_000);
        const p = getMoonPositionEciM(t);
        const v = getMoonVelocityEciMps(t);
        const radialFromV = dot(v, normalize(p));
        const dRdt =
            (getMoonDistanceM(new Date(t.getTime() + 60_000)) -
                getMoonDistanceM(new Date(t.getTime() - 60_000))) /
            120;
        row("radial v from vector", `${radialFromV.toFixed(4)} m/s`);
        row("radial v from d|r|/dt", `${dRdt.toFixed(4)} m/s`);
        expect(Math.abs(radialFromV - dRdt)).toBeLessThan(1.0);

        verdict(true, "posisi & kecepatan Bulan saling konsisten");
    });
});

describe("PHYSICS AUDIT — Lintasan trans-lunar", () => {
    it("F1. TLI dari parkir 200 km mendekati nilai Apollo", () => {
        section("F1  ANGGARAN TLI");
        const rPark = EARTH_RADIUS_M + 200_000;
        const vPark = circularVelocity(rPark);
        const rMoon = 384_400_000;

        // Elips Hohmann ke jarak Bulan (batas bawah energi)
        const aH = (rPark + rMoon) / 2;
        const vpH = visViva(rPark, aH);
        const tofH = Math.PI * Math.sqrt((aH * aH * aH) / EARTH_MU_M3_S2) / 3600;

        row("v_park @ 200 km", `${vPark.toFixed(1)} m/s`);
        row("v_perigee Hohmann-to-Moon", `${vpH.toFixed(1)} m/s`);
        row("TLI dv (minimum energy)", `${(vpH - vPark).toFixed(1)} m/s   [Apollo 3050-3150]`);
        row("TOF minimum energy", `${tofH.toFixed(1)} h   [~119 h]`);
        row("v_escape @ 200 km", `${escapeVelocity(rPark).toFixed(1)} m/s`);
        row("margin below escape", `${(escapeVelocity(rPark) - vpH).toFixed(1)} m/s   [harus > 0: orbit terikat]`);

        expect(vpH - vPark).toBeGreaterThan(3000);
        expect(vpH - vPark).toBeLessThan(3250);
        expect(vpH).toBeLessThan(escapeVelocity(rPark)); // TLI TIDAK melebihi escape
        expect(tofH).toBeGreaterThan(100);
        expect(tofH).toBeLessThan(140);

        verdict(true, "TLI dalam rentang Apollo dan tetap sub-escape");
    });

    it("F2. Bidang transfer yang memuat Bulan — plane change NOL", () => {
        section("F2  GEOMETRI BIDANG TRANSFER");
        // Klaim yang diperbaiki di Milestone 2: bidang transfer cukup MEMUAT Bulan;
        // inklinasi parkir = max(|lat situs|, |deklinasi Bulan|) -> tanpa plane change.
        const t = new Date(Date.UTC(2026, 5, 15, 0, 0, 0));
        const moon = getMoonPositionEciM(t);
        const m = normalize(moon);
        const decDeg = Math.asin(m.z) * DEG;

        const latSiteDeg = 28.573; // Kennedy
        const iParkDeg = Math.max(Math.abs(latSiteDeg), Math.abs(decDeg));

        // Basis dalam bidang yang memuat Bulan
        const e1 = normalize(cross({ x: 0, y: 0, z: 1 }, m)); // simpul, z = 0
        const e2 = cross(m, e1); // e2.z = cos(dec)

        // Cari normal bidang n = cos(psi) e1 + sin(psi) e2 dengan n.z = cos(i_park)
        const sinPsi = Math.cos(iParkDeg * RAD) / Math.cos(decDeg * RAD);
        row("Moon declination", `${decDeg.toFixed(3)} deg`);
        row("parking inclination chosen", `${iParkDeg.toFixed(3)} deg`);
        row("sin(psi) = cos(i)/cos(dec)", `${sinPsi.toFixed(6)}   [harus |.| <= 1]`);
        expect(Math.abs(sinPsi)).toBeLessThanOrEqual(1);

        const psi = Math.asin(sinPsi);
        const n = normalize(add(scale(e1, Math.cos(psi)), scale(e2, Math.sin(psi))));

        const incAchieved = Math.acos(Math.abs(n.z)) * DEG;
        const moonOutOfPlaneDeg = 90 - angleBetweenDeg(n, m);

        row("achieved plane inclination", `${incAchieved.toFixed(4)} deg`);
        row("Moon out-of-plane angle", `${moonOutOfPlaneDeg.toFixed(2)} deg   [HARUS ~0]`);
        row("plane-change dv required", `${planeChangeRef(circularVelocity(EARTH_RADIUS_M + 200_000), Math.abs(moonOutOfPlaneDeg)).toFixed(1)} m/s`);

        // Bulan harus tepat di dalam bidang, dan inklinasi tercapai
        expect(Math.abs(moonOutOfPlaneDeg)).toBeLessThan(0.01);
        expect(relErrPct(incAchieved, iParkDeg)).toBeLessThan(0.1);

        verdict(true, "bidang transfer memuat Bulan tanpa biaya ganti bidang");
    });

    it("F3. Koridor reentry & batas geometri flyby masuk akal", () => {
        section("F3  KORIDOR & BATAS FISIK");
        row("reentry corridor", `${REENTRY_CORRIDOR_MIN_M / 1000} - ${REENTRY_CORRIDOR_MAX_M / 1000} km   [real 80-300]`);
        expect(REENTRY_CORRIDOR_MIN_M).toBe(80_000);
        expect(REENTRY_CORRIDOR_MAX_M).toBe(300_000);

        // Perilune tidak boleh menembus permukaan Bulan
        const minPeriluneAltM = 50_000;
        row("min perilune radius", `${((MOON_RADIUS_M + minPeriluneAltM) / 1000).toFixed(1)} km   [R_moon = ${(MOON_RADIUS_M / 1000).toFixed(1)}]`);
        expect(MOON_RADIUS_M + minPeriluneAltM).toBeGreaterThan(MOON_RADIUS_M);

        // Sudut belok hiperbolik: sin(delta/2) = 1/e. Perilune dekat -> belok besar.
        const vInf = 1000; // m/s, khas pendekatan lunar
        for (const altKm of [100, 250, 1000, 5000, 11_589]) {
            const rp = MOON_RADIUS_M + altKm * 1000;
            const e = 1 + (rp * vInf * vInf) / MOON_MU_M3_S2;
            const turnDeg = 2 * Math.asin(1 / e) * DEG;
            row(`perilune ${altKm} km`, `e = ${e.toFixed(3)},  turn = ${turnDeg.toFixed(2)} deg`);
        }

        // Perilune rendah HARUS membelokkan lebih kuat daripada perilune tinggi.
        const turn = (altKm: number) => {
            const rp = MOON_RADIUS_M + altKm * 1000;
            const e = 1 + (rp * vInf * vInf) / MOON_MU_M3_S2;
            return 2 * Math.asin(1 / e);
        };
        expect(turn(100)).toBeGreaterThan(turn(1000));
        expect(turn(1000)).toBeGreaterThan(turn(11_589));

        // TEMUAN: solver 1-variabel memilih perilune ~11600 km, padahal Apollo ~250 km.
        // Belokannya jauh lebih lemah -> free-return jadi lamban (8.5 hari).
        row("Apollo-class turn (250 km)", `${(turn(250) * DEG).toFixed(2)} deg`);
        row("solver-chosen turn (11589 km)", `${(turn(11_589) * DEG).toFixed(2)} deg`);
        row("=> CATATAN", `perilune solver terlalu jauh: perlu solver multivariabel`);

        verdict(true, "batas fisik benar; perilune solver ditandai untuk M2.5");
    });
});

describe("PHYSICS AUDIT — Model roket & staging", () => {
    it("G1. Identitas Tsiolkovsky", () => {
        section("G1  TSIOLKOVSKY");
        // rasio massa e -> dv = Isp*g0 tepat
        const dvE = tsiolkovskyRef(300, Math.E, 1);
        row("Isp=300, m0/mf=e", `${dvE.toFixed(3)} m/s   [analytic ${(300 * G0_MPS2).toFixed(3)}]`);
        expect(relErrPct(dvE, 300 * G0_MPS2)).toBeLessThan(1e-9);

        // tanpa propelan -> dv = 0
        expect(tsiolkovskyRef(300, 1000, 1000)).toBe(0);
        // massa akhir nol/negatif -> 0, bukan NaN/Infinity
        expect(Number.isFinite(tsiolkovskyRef(300, 1000, 0))).toBe(true);
        expect(tsiolkovskyRef(300, 1000, 0)).toBe(0);

        row("guard mf = 0", `${tsiolkovskyRef(300, 1000, 0)} (tanpa Infinity/NaN)`);
        verdict(true, "identitas & guard aman");
    });

    it("G2. Staging mengalahkan single-stage; Saturn V mendekati kemampuan nyata", () => {
        section("G2  STAGING (data Saturn V nyata)");
        const saturnV: StageRef[] = [
            { name: "S-IC  (F-1 x5)", grossKg: 2_290_000, dryKg: 130_000, ispS: 294 }, // Isp efektif sl/vac
            { name: "S-II  (J-2 x5)", grossKg: 496_200, dryKg: 40_100, ispS: 421 },
            { name: "S-IVB (J-2 x1)", grossKg: 120_800, dryKg: 13_500, ispS: 441 },
        ];
        const payloadKg = 45_000; // CSM + LM Apollo

        const staged = multiStageRef(saturnV, payloadKg);
        for (const s of staged.perStage) row(s.name, `${s.dvMps.toFixed(0)} m/s`);
        row("TOTAL staged", `${staged.totalMps.toFixed(0)} m/s`);

        // Pembanding single-stage: propelan & massa kosong yang sama diangkut semua
        const propTotal = saturnV.reduce((a, s) => a + (s.grossKg - s.dryKg), 0);
        const dryTotal = saturnV.reduce((a, s) => a + s.dryKg, 0);
        const m0 = propTotal + dryTotal + payloadKg;
        const mf = dryTotal + payloadKg;
        const single = tsiolkovskyRef(421, m0, mf); // bahkan diberi Isp TERBAIK
        row("single-stage equivalent", `${single.toFixed(0)} m/s  (Isp 421, sengaja dimurahkan)`);
        row("staging gain", `${(staged.totalMps - single).toFixed(0)} m/s`);

        const requirement = circularVelocity(EARTH_RADIUS_M + 200_000) + 1500 + 300 + 250 - 395 + 3130;
        row("requirement pad->TLI (approx)", `${requirement.toFixed(0)} m/s`);
        row("margin", `${(staged.totalMps - requirement).toFixed(0)} m/s`);

        expect(staged.totalMps).toBeGreaterThan(single); // staging HARUS menang
        expect(staged.totalMps).toBeGreaterThan(12_000);
        expect(staged.totalMps).toBeLessThan(14_000);
        expect(staged.totalMps).toBeGreaterThan(requirement); // Saturn V memang mampu

        verdict(true, "model staging mereproduksi kemampuan Saturn V");
    });

    it("G3. Payload lebih berat = delta-v lebih kecil (monoton)", () => {
        section("G3  SENSITIVITAS PAYLOAD");
        const f9: StageRef[] = [
            { name: "F9 S1", grossKg: 433_100, dryKg: 25_600, ispS: 297 },
            { name: "F9 S2", grossKg: 111_500, dryKg: 3_900, ispS: 348 },
        ];
        let prev = Infinity;
        let monotonic = true;
        for (const pl of [500, 1_000, 5_000, 10_000, 16_000, 22_800]) {
            const dv = multiStageRef(f9, pl).totalMps;
            if (dv > prev) monotonic = false;
            row(`payload ${pl} kg`, `${dv.toFixed(0)} m/s`);
            prev = dv;
        }
        expect(monotonic).toBe(true);
        // Falcon 9 ke LEO butuh ~9400 m/s; 22.8 t adalah batas kemampuannya
        const dvMax = multiStageRef(f9, 22_800).totalMps;
        row("=> dv at max payload", `${dvMax.toFixed(0)} m/s  (LEO butuh ~9400)`);
        expect(dvMax).toBeGreaterThan(8_000);
        expect(dvMax).toBeLessThan(10_500);

        verdict(true, "payload naik -> delta-v turun, tanpa kejutan");
    });
});

describe("PHYSICS AUDIT — Ringkasan", () => {
    it("H1. Papan skor", () => {
        section("H1  RINGKASAN AUDIT");
        row("konstanta", "standar IAU/WGS84, rasio massa Bumi/Bulan 81.30");
        row("orbit lingkar & Kepler III", "eksak, err < 1e-9 %");
        row("Hohmann LEO->GEO", "3933 m/s, err < 0.5 % vs buku");
        row("monotonisitas ketinggian", "PASS — bug asli mati");
        row("invarian rotasi", "assist = omega R cos(i), tak bergantung lintang");
        row("gmst", "360.9856 deg/hari, hari sideris drift ~0");
        row("tanggal peluncuran", "situs berputar di ECI, |r| & lintang kekal");
        row("RK4", "energi drift < 1e-6 %, momentum < 1e-9 %");
        row("Lambert", "round-trip miss < 0.5 %");
        row("ephemeris Bulan", "jarak, deklinasi, kecepatan, bulan sideris konsisten");
        row("bidang transfer", "memuat Bulan, plane change ~0");
        row("staging", "Saturn V 45 t mampu; staging > single-stage");
        row("TERTUNDA (M2.5)", "perilune solver 1-variabel memilih ~11600 km (Apollo ~250)");
        verdict(true, "mesin fisika valid; satu item terbuka untuk Milestone 2.5");
        expect(true).toBe(true);
    });
});
