/**
 * Constellation Artwork Projection Solver.
 * Fit affine (u,v) -> tangent plane gnomonik, least-squares, N >= 3 anchor.
 * Semua math di bidang tangen -> tidak ada distorsi cos(dec), tidak perlu wrap RA.
 */

const DEG = Math.PI / 180;

export interface AnchorStar {
    name: string;
    uv: [number, number];
    ra: number;
    dec: number;
}

export interface ArtworkDiagnostics {
    anchorCount: number;
    residualsDeg: number[];
    maxResidualDeg: number;
    rmsResidualDeg: number;
    determinant: number;
    handedness: "from-earth" | "atlas-mirrored";
    scaleUDeg: number;
    scaleVDeg: number;
    anisotropy: number;
    shearDeg: number;
    warnings: string[];
}

export interface ArtworkMapper {
    toRaDec(u: number, v: number): { ra: number; dec: number };
    diagnostics: ArtworkDiagnostics;
}

type V3 = [number, number, number];

function unitVec(raDeg: number, decDeg: number): V3 {
    const r = raDeg * DEG, d = decDeg * DEG;
    return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
}

function normalize(v: V3): V3 {
    const m = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / m, v[1] / m, v[2] / m];
}

function dot(a: V3, b: V3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function angularSepDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
    const d = Math.max(-1, Math.min(1, dot(unitVec(ra1, dec1), unitVec(ra2, dec2))));
    return Math.acos(d) / DEG;
}

/** Frame tangen: p = titik singgung, e = timur, n = utara. */
function tangentFrame(ra0: number, dec0: number) {
    const r = ra0 * DEG, d = dec0 * DEG;
    const p: V3 = [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
    const e: V3 = [-Math.sin(r), Math.cos(r), 0];
    const n: V3 = [-Math.sin(d) * Math.cos(r), -Math.sin(d) * Math.sin(r), Math.cos(d)];
    return { p, e, n };
}

function solve3x3(M: number[][], b: number[]): number[] | null {
    const a = M.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < 3; c++) {
        let piv = c;
        for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
        if (Math.abs(a[piv][c]) < 1e-12) return null;
        [a[c], a[piv]] = [a[piv], a[c]];
        for (let r = 0; r < 3; r++) {
            if (r === c) continue;
            const f = a[r][c] / a[c][c];
            for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k];
        }
    }
    return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

export function buildArtworkMapper(anchors: AnchorStar[]): ArtworkMapper | null {
    if (anchors.length < 3) return null;

    // Titik singgung = centroid vektor satuan jangkar.
    let acc: V3 = [0, 0, 0];
    for (const a of anchors) {
        const u = unitVec(a.ra, a.dec);
        acc = [acc[0] + u[0], acc[1] + u[1], acc[2] + u[2]];
    }
    const c = normalize(acc);
    const ra0 = Math.atan2(c[1], c[0]) / DEG;
    const dec0 = Math.asin(Math.max(-1, Math.min(1, c[2]))) / DEG;
    const { p, e, n } = tangentFrame(ra0, dec0);

    // Proyeksi jangkar ke bidang tangen (satuan tan, ~radian di dekat pusat).
    const pts = anchors.map((a) => {
        const s = unitVec(a.ra, a.dec);
        const w = dot(s, p);
        return { u: a.uv[0], v: a.uv[1], xi: dot(s, e) / w, eta: dot(s, n) / w };
    });

    // Normal equations untuk xi = A*u + B*v + C dan eta = D*u + E*v + F.
    let Suu = 0, Svv = 0, Suv = 0, Su = 0, Sv = 0;
    let Sxu = 0, Sxv = 0, Sx = 0, Seu = 0, Sev = 0, Se = 0;
    for (const q of pts) {
        Suu += q.u * q.u; Svv += q.v * q.v; Suv += q.u * q.v; Su += q.u; Sv += q.v;
        Sxu += q.xi * q.u; Sxv += q.xi * q.v; Sx += q.xi;
        Seu += q.eta * q.u; Sev += q.eta * q.v; Se += q.eta;
    }
    const S = [[Suu, Suv, Su], [Suv, Svv, Sv], [Su, Sv, pts.length]];
    const cx = solve3x3(S, [Sxu, Sxv, Sx]);
    const ce = solve3x3(S, [Seu, Sev, Se]);
    if (!cx || !ce) return null;

    const [A, B, C] = cx;
    const [D, E, F] = ce;

    const toRaDec = (u: number, v: number) => {
        const xi = A * u + B * v + C;
        const eta = D * u + E * v + F;
        const d = normalize([
            p[0] + xi * e[0] + eta * n[0],
            p[1] + xi * e[1] + eta * n[1],
            p[2] + xi * e[2] + eta * n[2],
        ]);
        const ra = ((Math.atan2(d[1], d[0]) / DEG) % 360 + 360) % 360;
        return { ra, dec: Math.asin(Math.max(-1, Math.min(1, d[2]))) / DEG };
    };

    // Diagnostik.
    const residualsDeg = anchors.map((a) => {
        const q = toRaDec(a.uv[0], a.uv[1]);
        return angularSepDeg(q.ra, q.dec, a.ra, a.dec);
    });
    const maxResidualDeg = Math.max(...residualsDeg);
    const rmsResidualDeg = Math.sqrt(
        residualsDeg.reduce((s, r) => s + r * r, 0) / residualsDeg.length
    );

    const determinant = A * E - B * D;
    const magU = Math.hypot(A, D), magV = Math.hypot(B, E);
    const scaleUDeg = magU / DEG, scaleVDeg = magV / DEG;
    const anisotropy = Math.max(scaleUDeg, scaleVDeg) / Math.max(1e-9, Math.min(scaleUDeg, scaleVDeg));
    const cosAng = (A * B + D * E) / Math.max(1e-9, magU * magV);
    const shearDeg = Math.abs(90 - Math.acos(Math.max(-1, Math.min(1, cosAng))) / DEG);

    const warnings: string[] = [];
    if (maxResidualDeg > 1.5) warnings.push(`residual jangkar ${maxResidualDeg.toFixed(2)}° > 1.5°`);
    if (anisotropy > 1.6) warnings.push(`anisotropi skala ${anisotropy.toFixed(2)}×`);
    if (shearDeg > 15) warnings.push(`shear ${shearDeg.toFixed(1)}° dari ortogonal`);
    if (determinant > 0) warnings.push("determinan positif (konvensi atlas / tercermin)");

    return {
        toRaDec,
        diagnostics: {
            anchorCount: anchors.length,
            residualsDeg,
            maxResidualDeg,
            rmsResidualDeg,
            determinant,
            handedness: determinant < 0 ? "from-earth" : "atlas-mirrored",
            scaleUDeg,
            scaleVDeg,
            anisotropy,
            shearDeg,
            warnings,
        },
    };
}
