/**
 * DIBUAT OTOMATIS oleh scripts/generate-constellation-anchors.mjs — JANGAN EDIT MANUAL.
 *
 * Sumber jangkar: Stellarium skyculture "western" (constellationsart.fab).
 * Posisi bintang: Hipparcos (CDS VizieR I/239/hip_main), ekuinoks ICRS/J2000.
 * Konvensi: u = x/W, v = 1 - y/H (W,H = dimensi asli tekstur Stellarium 128/256/512) -> determinan negatif.
 *
 * Dibuat: 2026-08-31T09:56:21.803Z
 * Total: 85 rasi
 */

import type { ConstellationAnchorData } from "./constellationProfiles";

export const GENERATED_ANCHORS: Record<string, ConstellationAnchorData> = {
  and: {
    // andromeda.webp
    star1: { name: "HIP 3881", uv: [0.386719, 0.580078], ra: 12.4535, dec: 41.079 },
    star2: { name: "HIP 3092", uv: [0.658203, 0.734375], ra: 9.8317, dec: 30.8612 },
    star3: { name: "HIP 9640", uv: [0.437500, 0.164062], ra: 30.9747, dec: 42.3298 },
  },
  ant: {
    // antlia.webp
    star1: { name: "HIP 51172", uv: [0.031250, 0.343750], ra: 156.7881, dec: -31.0678 },
    star2: { name: "HIP 47758", uv: [0.562500, 0.460938], ra: 146.0505, dec: -27.7696 },
    star3: { name: "HIP 48926", uv: [0.328125, 0.062500], ra: 149.7181, dec: -35.8909 },
  },
  aps: {
    // apus.webp
    star1: { name: "HIP 81852", uv: [0.257812, 0.765625], ra: 250.7726, dec: -77.5166 },
    star2: { name: "HIP 81065", uv: [0.296875, 0.660156], ra: 248.3644, dec: -78.897 },
    star3: { name: "HIP 72370", uv: [0.636719, 0.570312], ra: 221.9655, dec: -79.0447 },
  },
  aql: {
    // aquila.webp
    star1: { name: "HIP 97649", uv: [0.318359, 0.546875], ra: 297.6945, dec: 8.8674 },
    star2: { name: "HIP 93244", uv: [0.751953, 0.744141], ra: 284.9058, dec: 15.0685 },
    star3: { name: "HIP 93805", uv: [0.775391, 0.224609], ra: 286.5623, dec: -4.8823 },
  },
  aqr: {
    // aquarius.webp
    star1: { name: "HIP 115438", uv: [0.281250, 0.093750], ra: 350.7429, dec: -20.1003 },
    star2: { name: "HIP 109074", uv: [0.349609, 0.808594], ra: 331.4459, dec: -0.3198 },
    star3: { name: "HIP 102618", uv: [0.908203, 0.904297], ra: 311.9189, dec: -9.4957 },
  },
  ara: {
    // ara.webp
    star1: { name: "HIP 83081", uv: [0.382812, 0.726562], ra: 254.6551, dec: -55.9901 },
    star2: { name: "HIP 85727", uv: [0.746094, 0.636719], ra: 262.7749, dec: -60.6836 },
    star3: { name: "HIP 88714", uv: [0.417969, 0.027344], ra: 271.6578, dec: -50.0915 },
  },
  ari: {
    // aries.webp
    star1: { name: "HIP 13209", uv: [0.046875, 0.492188], ra: 42.4958, dec: 27.2608 },
    star2: { name: "HIP 13914", uv: [0.226562, 0.195312], ra: 44.8031, dec: 21.3404 },
    star3: { name: "HIP 8832", uv: [0.820312, 0.816406], ra: 28.3824, dec: 19.2941 },
  },
  aur: {
    // auriga.webp
    star1: { name: "HIP 28380", uv: [0.382812, 0.630859], ra: 89.9302, dec: 37.2128 },
    star2: { name: "HIP 24608", uv: [0.818359, 0.593750], ra: 79.1721, dec: 45.999 },
    star3: { name: "HIP 23015", uv: [0.566406, 0.173828], ra: 74.2484, dec: 33.1661 },
  },
  boo: {
    // bootes.webp
    star1: { name: "HIP 72105", uv: [0.439453, 0.566406], ra: 221.2469, dec: 27.0742 },
    star2: { name: "HIP 71075", uv: [0.712891, 0.640625], ra: 218.0198, dec: 38.3079 },
    star3: { name: "HIP 67927", uv: [0.404297, 0.216797], ra: 208.6713, dec: 18.3986 },
  },
  cae: {
    // caelum.webp
    star1: { name: "HIP 21060", uv: [0.062500, 0.097656], ra: 67.7087, dec: -44.9537 },
    star2: { name: "HIP 21770", uv: [0.296875, 0.433594], ra: 70.1409, dec: -41.8636 },
    star3: { name: "HIP 21861", uv: [0.777344, 0.707031], ra: 70.5144, dec: -37.1448 },
  },
  cam: {
    // camelopardalis.webp
    star1: { name: "HIP 25110", uv: [0.300781, 0.820312], ra: 80.6407, dec: 79.2308 },
    star2: { name: "HIP 22783", uv: [0.500000, 0.472656], ra: 73.5125, dec: 66.3427 },
    star3: { name: "HIP 16228", uv: [0.855469, 0.468750], ra: 52.2672, dec: 59.9403 },
  },
  cnc: {
    // cancer.webp
    star1: { name: "HIP 44066", uv: [0.113281, 0.351562], ra: 134.6217, dec: 11.8578 },
    star2: { name: "HIP 40526", uv: [0.394531, 0.003906], ra: 124.129, dec: 9.1857 },
    star3: { name: "HIP 40843", uv: [0.804688, 0.644531], ra: 125.0161, dec: 27.2186 },
  },
  cap: {
    // capricornus.webp
    star1: { name: "HIP 107556", uv: [0.029297, 0.148438], ra: 326.7595, dec: -16.1266 },
    star2: { name: "HIP 100064", uv: [0.787109, 0.986328], ra: 304.5134, dec: -12.5449 },
    star3: { name: "HIP 102978", uv: [0.898438, 0.144531], ra: 312.9554, dec: -26.9191 },
  },
  car: {
    // argonavis.webp
    star1: { name: "HIP 45238", uv: [0.394531, 0.111328], ra: 138.301, dec: -69.7175 },
    star2: { name: "HIP 50191", uv: [0.121094, 0.578125], ra: 153.6845, dec: -42.1221 },
    star3: { name: "HIP 39757", uv: [0.582031, 0.957031], ra: 121.8863, dec: -24.3044 },
  },
  cas: {
    // cassiopeia.webp
    star1: { name: "HIP 8886", uv: [0.761719, 0.343750], ra: 28.5987, dec: 63.6701 },
    star2: { name: "HIP 3179", uv: [0.318359, 0.695312], ra: 10.1266, dec: 56.5374 },
    star3: { name: "HIP 746", uv: [0.142578, 0.525391], ra: 2.292, dec: 59.1502 },
  },
  cen: {
    // centaurus.webp
    star1: { name: "HIP 68933", uv: [0.230469, 0.693359], ra: 211.6722, dec: -36.3687 },
    star2: { name: "HIP 71683", uv: [0.378906, 0.132812], ra: 219.9204, dec: -60.8351 },
    star3: { name: "HIP 56561", uv: [0.904297, 0.195312], ra: 173.9455, dec: -63.0198 },
  },
  cep: {
    // cepheus.webp
    star1: { name: "HIP 116727", uv: [0.117188, 0.345703], ra: 354.8374, dec: 77.632 },
    star2: { name: "HIP 106032", uv: [0.244141, 0.667969], ra: 322.1649, dec: 70.5607 },
    star3: { name: "HIP 109492", uv: [0.654297, 0.712891], ra: 332.7136, dec: 58.2012 },
  },
  cet: {
    // cetus.webp
    star1: { name: "HIP 14143", uv: [0.169922, 0.876953], ra: 45.5938, dec: 4.3529 },
    star2: { name: "HIP 12770", uv: [0.054688, 0.464844], ra: 41.0306, dec: -13.8587 },
    star3: { name: "HIP 1562", uv: [0.804688, 0.140625], ra: 4.857, dec: -8.8238 },
  },
  cha: {
    // chamaeleon.webp
    star1: { name: "HIP 60000", uv: [0.113281, 0.164062], ra: 184.5873, dec: -79.3123 },
    star2: { name: "HIP 51839", uv: [0.285156, 0.519531], ra: 158.8676, dec: -78.6078 },
    star3: { name: "HIP 40702", uv: [0.718750, 0.871094], ra: 124.6303, dec: -76.92 },
  },
  cir: {
    // circinus.webp
    star1: { name: "HIP 75323", uv: [0.019531, 0.859375], ra: 230.8444, dec: -59.3207 },
    star2: { name: "HIP 74824", uv: [0.152344, 0.957031], ra: 229.379, dec: -58.8009 },
    star3: { name: "HIP 71908", uv: [0.917969, 0.066406], ra: 220.6279, dec: -64.9746 },
  },
  cma: {
    // canis-major.webp
    star1: { name: "HIP 35904", uv: [0.041016, 0.322266], ra: 111.0238, dec: -29.3031 },
    star2: { name: "HIP 33160", uv: [0.626953, 0.953125], ra: 103.5478, dec: -12.0386 },
    star3: { name: "HIP 30122", uv: [0.621094, 0.039062], ra: 95.0783, dec: -30.0634 },
  },
  cmi: {
    // canis-minor.webp
    star1: { name: "HIP 37921", uv: [0.375000, 0.832031], ra: 116.5676, dec: 10.7683 },
    star2: { name: "HIP 37279", uv: [0.394531, 0.332031], ra: 114.8272, dec: 5.2275 },
    star3: { name: "HIP 36188", uv: [0.718750, 0.515625], ra: 111.7878, dec: 8.2894 },
  },
  col: {
    // columba.webp
    star1: { name: "HIP 30277", uv: [0.542969, 0.886719], ra: 95.5285, dec: -33.4363 },
    star2: { name: "HIP 28328", uv: [0.156250, 0.257812], ra: 89.7866, dec: -42.8151 },
    star3: { name: "HIP 25859", uv: [0.796875, 0.175781], ra: 82.8031, dec: -35.4704 },
  },
  com: {
    // coma-berenices.webp
    star1: { name: "HIP 64241", uv: [0.105469, 0.222656], ra: 197.4981, dec: 17.5291 },
    star2: { name: "HIP 64394", uv: [0.148438, 0.773438], ra: 197.9705, dec: 27.876 },
    star3: { name: "HIP 60742", uv: [0.671875, 0.750000], ra: 186.7347, dec: 28.2686 },
  },
  cra: {
    // corona-australis.webp
    star1: { name: "HIP 93825", uv: [0.054688, 0.445312], ra: 286.6043, dec: -37.0628 },
    star2: { name: "HIP 90887", uv: [0.851562, 0.867188], ra: 278.0888, dec: -39.7039 },
    star3: { name: "HIP 92953", uv: [0.761719, 0.187500], ra: 284.0707, dec: -42.7106 },
  },
  crb: {
    // corona-borealis.webp
    star1: { name: "HIP 78493", uv: [0.062500, 0.273438], ra: 240.3608, dec: 29.8511 },
    star2: { name: "HIP 76952", uv: [0.785156, 0.207031], ra: 235.686, dec: 26.2955 },
    star3: { name: "HIP 76127", uv: [0.613281, 0.921875], ra: 233.2325, dec: 31.3592 },
  },
  crt: {
    // crater.webp
    star1: { name: "HIP 58188", uv: [0.175781, 0.839844], ra: 179.0041, dec: -17.1508 },
    star2: { name: "HIP 55282", uv: [0.625000, 0.417969], ra: 169.8355, dec: -14.779 },
    star3: { name: "HIP 54682", uv: [0.214844, 0.054688], ra: 167.9145, dec: -22.8256 },
  },
  cru: {
    // crux.webp
    star1: { name: "HIP 61084", uv: [0.875000, 0.835938], ra: 187.7914, dec: -57.1126 },
    star2: { name: "HIP 62434", uv: [0.328125, 0.843750], ra: 191.9305, dec: -59.6887 },
    star3: { name: "HIP 60718", uv: [0.164062, 0.171875], ra: 186.6498, dec: -63.0991 },
  },
  crv: {
    // corvus.webp
    star1: { name: "HIP 60965", uv: [0.253906, 0.769531], ra: 187.4666, dec: -16.5151 },
    star2: { name: "HIP 61359", uv: [0.300781, 0.082031], ra: 188.5968, dec: -23.3966 },
    star3: { name: "HIP 59316", uv: [0.832031, 0.269531], ra: 182.5314, dec: -22.6198 },
  },
  cvn: {
    // canes-venatici.webp
    star1: { name: "HIP 63901", uv: [0.457031, 0.558594], ra: 196.4353, dec: 35.7989 },
    star2: { name: "HIP 61317", uv: [0.804688, 0.843750], ra: 188.4379, dec: 41.3568 },
    star3: { name: "HIP 61309", uv: [0.808594, 0.406250], ra: 188.4121, dec: 33.2477 },
  },
  cyg: {
    // cygnus.webp
    star1: { name: "HIP 107310", uv: [0.013672, 0.253906], ra: 326.035, dec: 28.7432 },
    star2: { name: "HIP 94779", uv: [0.925781, 0.910156], ra: 289.2755, dec: 53.3682 },
    star3: { name: "HIP 95947", uv: [0.912109, 0.115234], ra: 292.6804, dec: 27.9597 },
  },
  del: {
    // delphinus.webp
    star1: { name: "HIP 102532", uv: [0.230469, 0.878906], ra: 311.6647, dec: 16.1248 },
    star2: { name: "HIP 102805", uv: [0.292969, 0.421875], ra: 312.4072, dec: 12.5449 },
    star3: { name: "HIP 101421", uv: [0.824219, 0.441406], ra: 308.3032, dec: 11.3033 },
  },
  dor: {
    // dorado.webp
    star1: { name: "HIP 27890", uv: [0.218750, 0.230469], ra: 88.5246, dec: -63.091 },
    star2: { name: "HIP 27100", uv: [0.292969, 0.109375], ra: 86.1934, dec: -65.7355 },
    star3: { name: "HIP 19893", uv: [0.855469, 0.820312], ra: 64.0062, dec: -51.4871 },
  },
  dra: {
    // draco.webp
    star1: { name: "HIP 56211", uv: [0.025391, 0.197266], ra: 172.8512, dec: 69.3311 },
    star2: { name: "HIP 85670", uv: [0.705078, 0.699219], ra: 262.6082, dec: 52.3014 },
    star3: { name: "HIP 97433", uv: [0.876953, 0.162109], ra: 297.0426, dec: 70.2678 },
  },
  equ: {
    // equuleus.webp
    star1: { name: "HIP 104521", uv: [0.066406, 0.296875], ra: 317.5853, dec: 10.1319 },
    star2: { name: "HIP 104987", uv: [0.582031, 0.664062], ra: 318.9558, dec: 5.2481 },
    star3: { name: "HIP 105570", uv: [0.625000, 0.375000], ra: 320.7233, dec: 6.8111 },
  },
  eri: {
    // eridanus.webp
    star1: { name: "HIP 22109", uv: [0.080078, 0.814453], ra: 71.3756, dec: -3.2546 },
    star2: { name: "HIP 13701", uv: [0.578125, 0.914062], ra: 44.1067, dec: -8.8976 },
    star3: { name: "HIP 7588", uv: [0.962891, 0.042969], ra: 24.4281, dec: -57.2367 },
  },
  for: {
    // fornax.webp
    star1: { name: "HIP 14879", uv: [0.164062, 0.511719], ra: 48.0178, dec: -28.9891 },
    star2: { name: "HIP 13202", uv: [0.500000, 0.855469], ra: 42.4756, dec: -27.942 },
    star3: { name: "HIP 13147", uv: [0.742188, 0.496094], ra: 42.2723, dec: -32.4063 },
  },
  gem: {
    // gemini.webp
    star1: { name: "HIP 37740", uv: [0.054688, 0.683594], ra: 116.112, dec: 24.3981 },
    star2: { name: "HIP 32362", uv: [0.457031, 0.015625], ra: 101.3226, dec: 12.8961 },
    star3: { name: "HIP 28734", uv: [0.972656, 0.355469], ra: 91.0301, dec: 23.2636 },
  },
  gru: {
    // grus.webp
    star1: { name: "HIP 114131", uv: [0.191406, 0.574219], ra: 346.7199, dec: -43.5203 },
    star2: { name: "HIP 112623", uv: [0.332031, 0.195312], ra: 342.1383, dec: -51.3167 },
    star3: { name: "HIP 108085", uv: [0.859375, 0.824219], ra: 328.4819, dec: -37.3648 },
  },
  her: {
    // hercules.webp
    star1: { name: "HIP 80170", uv: [0.085938, 0.775391], ra: 245.4802, dec: 19.153 },
    star2: { name: "HIP 79992", uv: [0.496094, 0.068359], ra: 244.9352, dec: 46.3133 },
    star3: { name: "HIP 88794", uv: [0.861328, 0.800781], ra: 271.8856, dec: 28.7625 },
  },
  hor: {
    // horlogium.webp
    star1: { name: "HIP 19747", uv: [0.062500, 0.082031], ra: 63.5003, dec: -42.2939 },
    star2: { name: "HIP 12484", uv: [0.718750, 0.738281], ra: 40.1649, dec: -54.5499 },
    star3: { name: "HIP 14240", uv: [0.917969, 0.535156], ra: 45.9038, dec: -59.7376 },
  },
  hya: {
    // hydra.webp
    star1: { name: "HIP 64962", uv: [0.050781, 0.041016], ra: 199.7302, dec: -23.1714 },
    star2: { name: "HIP 55434", uv: [0.216797, 0.708984], ra: 170.2844, dec: 6.0294 },
    star3: { name: "HIP 43813", uv: [0.783203, 0.935547], ra: 133.8487, dec: 5.9455 },
  },
  hyi: {
    // hydrus.webp
    star1: { name: "HIP 9236", uv: [0.054688, 0.203125], ra: 29.6911, dec: -61.5699 },
    star2: { name: "HIP 2021", uv: [0.785156, 0.832031], ra: 6.4133, dec: -77.255 },
    star3: { name: "HIP 17678", uv: [0.941406, 0.160156], ra: 56.8093, dec: -74.2392 },
  },
  ind: {
    // indus.webp
    star1: { name: "HIP 101772", uv: [0.250000, 0.441406], ra: 309.3916, dec: -47.2917 },
    star2: { name: "HIP 103227", uv: [0.601562, 0.921875], ra: 313.7024, dec: -58.4541 },
    star3: { name: "HIP 105319", uv: [0.683594, 0.617188], ra: 319.9662, dec: -53.4493 },
  },
  lac: {
    // lacerta.webp
    star1: { name: "HIP 110538", uv: [0.972656, 0.835938], ra: 335.8902, dec: 52.2295 },
    star2: { name: "HIP 111104", uv: [0.421875, 0.519531], ra: 337.6219, dec: 43.1234 },
    star3: { name: "HIP 109937", uv: [0.261719, 0.160156], ra: 333.9924, dec: 37.7487 },
  },
  leo: {
    // leo.webp
    star1: { name: "HIP 57632", uv: [0.134766, 0.197266], ra: 177.2662, dec: 14.5723 },
    star2: { name: "HIP 49669", uv: [0.748047, 0.636719], ra: 152.0936, dec: 11.9672 },
    star3: { name: "HIP 47908", uv: [0.626953, 0.937500], ra: 146.4629, dec: 23.7743 },
  },
  lep: {
    // lepus.webp
    star1: { name: "HIP 28910", uv: [0.082031, 0.812500], ra: 91.5389, dec: -14.9353 },
    star2: { name: "HIP 24244", uv: [0.960938, 0.757812], ra: 78.0745, dec: -11.8691 },
    star3: { name: "HIP 23685", uv: [0.832031, 0.082031], ra: 76.3652, dec: -22.3709 },
  },
  lib: {
    // libra.webp
    star1: { name: "HIP 74785", uv: [0.160156, 0.894531], ra: 229.252, dec: -9.3829 },
    star2: { name: "HIP 77853", uv: [0.226562, 0.335938], ra: 238.4562, dec: -16.7296 },
    star3: { name: "HIP 73714", uv: [0.875000, 0.582031], ra: 226.0178, dec: -25.2819 },
  },
  lmi: {
    // leo-minor.webp
    star1: { name: "HIP 53229", uv: [0.031250, 0.843750], ra: 163.3277, dec: 34.2156 },
    star2: { name: "HIP 46952", uv: [0.835938, 0.503906], ra: 143.5557, dec: 36.3976 },
    star3: { name: "HIP 50303", uv: [0.238281, 0.394531], ra: 154.0603, dec: 29.3106 },
  },
  lup: {
    // lupus.webp
    star1: { name: "HIP 74395", uv: [0.175781, 0.498047], ra: 228.0717, dec: -52.0991 },
    star2: { name: "HIP 70576", uv: [0.404297, 0.150391], ra: 216.545, dec: -45.3793 },
    star3: { name: "HIP 75177", uv: [0.830078, 0.533203], ra: 230.4518, dec: -36.2612 },
  },
  lyn: {
    // lynx.webp
    star1: { name: "HIP 44248", uv: [0.195312, 0.578125], ra: 135.1615, dec: 41.7834 },
    star2: { name: "HIP 36145", uv: [0.658203, 0.585938], ra: 111.6786, dec: 49.2116 },
    star3: { name: "HIP 30060", uv: [0.921875, 0.767578], ra: 94.9058, dec: 59.0109 },
  },
  lyr: {
    // lyra.webp
    star1: { name: "HIP 92791", uv: [0.390625, 0.625000], ra: 283.6262, dec: 36.8986 },
    star2: { name: "HIP 91262", uv: [0.613281, 0.851562], ra: 279.2341, dec: 38.783 },
    star3: { name: "HIP 92420", uv: [0.542969, 0.367188], ra: 282.52, dec: 33.3627 },
  },
  men: {
    // mensa.webp
    star1: { name: "HIP 21949", uv: [0.390625, 0.738281], ra: 70.7664, dec: -70.9311 },
    star2: { name: "HIP 25918", uv: [0.699219, 0.468750], ra: 82.9694, dec: -76.3417 },
    star3: { name: "HIP 29134", uv: [0.210938, 0.285156], ra: 92.1848, dec: -68.8435 },
  },
  mic: {
    // microscopium.webp
    star1: { name: "HIP 105140", uv: [0.476562, 0.117188], ra: 319.4844, dec: -32.1725 },
    star2: { name: "HIP 103738", uv: [0.656250, 0.421875], ra: 315.3228, dec: -32.2578 },
    star3: { name: "HIP 102831", uv: [0.914062, 0.550781], ra: 312.492, dec: -33.7797 },
  },
  mon: {
    // monoceros.webp
    star1: { name: "HIP 39863", uv: [0.039062, 0.402344], ra: 122.1486, dec: -2.9838 },
    star2: { name: "HIP 31978", uv: [0.769531, 0.843750], ra: 100.2444, dec: 9.8958 },
    star3: { name: "HIP 29651", uv: [0.994141, 0.298828], ra: 93.7139, dec: -6.2747 },
  },
  mus: {
    // musca.webp
    star1: { name: "HIP 61199", uv: [0.222656, 0.796875], ra: 188.1171, dec: -72.133 },
    star2: { name: "HIP 62322", uv: [0.691406, 0.734375], ra: 191.5703, dec: -68.1081 },
    star3: { name: "HIP 57363", uv: [0.503906, 0.078125], ra: 176.4024, dec: -66.7288 },
  },
  nor: {
    // norma.webp
    star1: { name: "HIP 78639", uv: [0.132812, 0.648438], ra: 240.8036, dec: -49.2297 },
    star2: { name: "HIP 79509", uv: [0.789062, 0.703125], ra: 243.3697, dec: -54.6304 },
    star3: { name: "HIP 80582", uv: [0.125000, 0.125000], ra: 246.796, dec: -47.5547 },
  },
  oct: {
    // octans.webp
    star1: { name: "HIP 70638", uv: [0.058594, 0.937500], ra: 216.7323, dec: -83.6679 },
    star2: { name: "HIP 107089", uv: [0.921875, 0.066406], ra: 325.3686, dec: -77.3895 },
    star3: { name: "HIP 112405", uv: [0.964844, 0.453125], ra: 341.5155, dec: -81.3816 },
  },
  oph: {
    // ophiuchus.webp
    star1: { name: "HIP 92946", uv: [0.009766, 0.642578], ra: 284.0548, dec: 4.2035 },
    star2: { name: "HIP 77233", uv: [0.882812, 0.908203], ra: 236.5467, dec: 15.4219 },
    star3: { name: "HIP 85755", uv: [0.464844, 0.115234], ra: 262.854, dec: -23.9626 },
  },
  ori: {
    // orion.webp
    star1: { name: "HIP 27913", uv: [0.115234, 0.978516], ra: 88.5962, dec: 20.2764 },
    star2: { name: "HIP 27366", uv: [0.642578, 0.068359], ra: 86.9391, dec: -9.6696 },
    star3: { name: "HIP 22449", uv: [0.822266, 0.822266], ra: 72.4589, dec: 6.9612 },
  },
  pav: {
    // pavo.webp
    star1: { name: "HIP 100751", uv: [0.214844, 0.765625], ra: 306.4119, dec: -56.7349 },
    star2: { name: "HIP 98495", uv: [0.429688, 0.187500], ra: 300.1475, dec: -72.9102 },
    star3: { name: "HIP 86929", uv: [0.917969, 0.429688], ra: 266.4333, dec: -64.7237 },
  },
  peg: {
    // pegasus.webp
    star1: { name: "HIP 107315", uv: [0.320312, 0.919922], ra: 326.0464, dec: 9.875 },
    star2: { name: "HIP 109410", uv: [0.091797, 0.447266], ra: 332.4969, dec: 33.1783 },
    star3: { name: "HIP 1067", uv: [0.798828, 0.318359], ra: 3.309, dec: 15.1836 },
  },
  per: {
    // perseus.webp
    star1: { name: "HIP 18532", uv: [0.320312, 0.369141], ra: 59.4634, dec: 40.0103 },
    star2: { name: "HIP 15863", uv: [0.583984, 0.658203], ra: 51.0806, dec: 49.8612 },
    star3: { name: "HIP 13254", uv: [0.751953, 0.246094], ra: 42.6455, dec: 38.3189 },
  },
  phe: {
    // phoenix.webp
    star1: { name: "HIP 8837", uv: [0.214844, 0.050781], ra: 28.4117, dec: -46.3024 },
    star2: { name: "HIP 765", uv: [0.816406, 0.941406], ra: 2.3522, dec: -45.747 },
    star3: { name: "HIP 5348", uv: [0.894531, 0.164062], ra: 17.0961, dec: -55.2458 },
  },
  pic: {
    // pictor.webp
    star1: { name: "HIP 32607", uv: [0.015625, 0.015625], ra: 102.0481, dec: -61.942 },
    star2: { name: "HIP 27530", uv: [0.578125, 0.460938], ra: 87.4566, dec: -56.1665 },
    star3: { name: "HIP 27321", uv: [0.652344, 0.851562], ra: 86.8212, dec: -51.0667 },
  },
  psa: {
    // piscis-austrinus.webp
    star1: { name: "HIP 113246", uv: [0.742188, 0.980469], ra: 343.9871, dec: -32.5397 },
    star2: { name: "HIP 107608", uv: [0.320312, 0.210938], ra: 326.9341, dec: -30.8983 },
    star3: { name: "HIP 111954", uv: [0.921875, 0.640625], ra: 340.1639, dec: -27.0436 },
  },
  psc: {
    // pisces.webp
    star1: { name: "HIP 4889", uv: [0.046875, 0.796875], ra: 15.7045, dec: 31.8043 },
    star2: { name: "HIP 9487", uv: [0.216797, 0.044922], ra: 30.5117, dec: 2.7638 },
    star3: { name: "HIP 114971", uv: [0.939453, 0.697266], ra: 349.2896, dec: 3.2822 },
  },
  pyx: {
    // pyxis.webp
    star1: { name: "HIP 41723", uv: [0.593750, 0.140625], ra: 127.6192, dec: -32.1593 },
    star2: { name: "HIP 42828", uv: [0.367188, 0.378906], ra: 130.8981, dec: -33.1864 },
    star3: { name: "HIP 42515", uv: [0.171875, 0.210938], ra: 130.0256, dec: -35.3083 },
  },
  ret: {
    // reticulum.webp
    star1: { name: "HIP 18597", uv: [0.367188, 0.562500], ra: 59.6864, dec: -61.4002 },
    star2: { name: "HIP 19780", uv: [0.609375, 0.312500], ra: 63.606, dec: -62.474 },
    star3: { name: "HIP 19921", uv: [0.125000, 0.132812], ra: 64.1212, dec: -59.3017 },
  },
  scl: {
    // sculptor.webp
    star1: { name: "HIP 115102", uv: [0.902344, 0.847656], ra: 349.7059, dec: -32.5318 },
    star2: { name: "HIP 116231", uv: [0.937500, 0.585938], ra: 353.2425, dec: -37.8184 },
    star3: { name: "HIP 4577", uv: [0.125000, 0.320312], ra: 14.6514, dec: -29.3575 },
  },
  sco: {
    // scorpius.webp
    star1: { name: "HIP 78820", uv: [0.873047, 0.943359], ra: 241.3593, dec: -19.8054 },
    star2: { name: "HIP 85927", uv: [0.121094, 0.287109], ra: 263.4022, dec: -37.1037 },
    star3: { name: "HIP 82729", uv: [0.423828, 0.097656], ra: 253.6463, dec: -42.3608 },
  },
  sct: {
    // scutum.webp
    star1: { name: "HIP 92175", uv: [0.203125, 0.933594], ra: 281.7937, dec: -4.7478 },
    star2: { name: "HIP 90595", uv: [0.875000, 0.515625], ra: 277.2994, dec: -14.5658 },
    star3: { name: "HIP 92814", uv: [0.542969, 0.195312], ra: 283.6796, dec: -15.603 },
  },
  sex: {
    // sextans.webp
    star1: { name: "HIP 51437", uv: [0.203125, 0.578125], ra: 157.5729, dec: -0.637 },
    star2: { name: "HIP 49641", uv: [0.531250, 0.718750], ra: 151.9846, dec: -0.3716 },
    star3: { name: "HIP 48437", uv: [0.921875, 0.343750], ra: 148.127, dec: -8.1049 },
  },
  sge: {
    // sagitta.webp
    star1: { name: "HIP 98920", uv: [0.023438, 0.953125], ra: 301.2895, dec: 19.9909 },
    star2: { name: "HIP 96757", uv: [0.972656, 0.167969], ra: 295.0241, dec: 18.0139 },
    star3: { name: "HIP 96837", uv: [0.851562, 0.050781], ra: 295.2622, dec: 17.4761 },
  },
  sgr: {
    // sagittarius.webp
    star1: { name: "HIP 95168", uv: [0.187500, 0.839844], ra: 290.4182, dec: -17.8473 },
    star2: { name: "HIP 95294", uv: [0.599609, 0.039062], ra: 290.8044, dec: -44.7996 },
    star3: { name: "HIP 87072", uv: [0.988281, 0.804688], ra: 266.8901, dec: -27.8308 },
  },
  tau: {
    // taurus.webp
    star1: { name: "HIP 26451", uv: [0.025391, 0.820312], ra: 84.4112, dec: 21.1426 },
    star2: { name: "HIP 15900", uv: [0.779297, 0.144531], ra: 51.2035, dec: 9.0291 },
    star3: { name: "HIP 17999", uv: [0.746094, 0.625000], ra: 57.7184, dec: 23.9616 },
  },
  tel: {
    // telescopium.webp
    star1: { name: "HIP 91589", uv: [0.234375, 0.484375], ra: 280.1829, dec: -47.0273 },
    star2: { name: "HIP 90422", uv: [0.789062, 0.687500], ra: 276.7435, dec: -45.9683 },
    star3: { name: "HIP 90568", uv: [0.828125, 0.281250], ra: 277.2072, dec: -49.07 },
  },
  tra: {
    // triangulum-australe.webp
    star1: { name: "HIP 77952", uv: [0.203125, 0.906250], ra: 238.7867, dec: -63.4297 },
    star2: { name: "HIP 74946", uv: [0.843750, 0.882812], ra: 229.7279, dec: -68.6795 },
    star3: { name: "HIP 82273", uv: [0.468750, 0.171875], ra: 252.1661, dec: -69.0276 },
  },
  tri: {
    // triangulum.webp
    star1: { name: "HIP 10064", uv: [0.125000, 0.671875], ra: 32.3855, dec: 34.9874 },
    star2: { name: "HIP 10559", uv: [0.101562, 0.453125], ra: 33.9846, dec: 33.359 },
    star3: { name: "HIP 8796", uv: [0.757812, 0.390625], ra: 28.2704, dec: 29.5794 },
  },
  tuc: {
    // tucana.webp
    star1: { name: "HIP 2484", uv: [0.207031, 0.527344], ra: 7.8857, dec: -62.9581 },
    star2: { name: "HIP 114996", uv: [0.601562, 0.664062], ra: 349.3576, dec: -58.2359 },
    star3: { name: "HIP 110130", uv: [0.875000, 0.449219], ra: 334.6257, dec: -60.2595 },
  },
  uma: {
    // ursa-major.webp
    star1: { name: "HIP 67301", uv: [0.050781, 0.853516], ra: 206.8856, dec: 49.3133 },
    star2: { name: "HIP 41704", uv: [0.882812, 0.468750], ra: 127.5668, dec: 60.7184 },
    star3: { name: "HIP 50372", uv: [0.503906, 0.230469], ra: 154.2747, dec: 42.9145 },
  },
  umi: {
    // ursa-minor.webp
    star1: { name: "HIP 11767", uv: [0.058594, 0.921875], ra: 37.9461, dec: 89.2641 },
    star2: { name: "HIP 59504", uv: [0.753906, 0.800781], ra: 183.0496, dec: 77.6162 },
    star3: { name: "HIP 79822", uv: [0.363281, 0.183594], ra: 244.3771, dec: 75.7547 },
  },
  vir: {
    // virgo.webp
    star1: { name: "HIP 72220", uv: [0.126953, 0.240234], ra: 221.5625, dec: 1.8929 },
    star2: { name: "HIP 57380", uv: [0.886719, 0.888672], ra: 176.4649, dec: 6.5298 },
    star3: { name: "HIP 65474", uv: [0.660156, 0.253906], ra: 201.2984, dec: -11.1612 },
  },
  vol: {
    // volans.webp
    star1: { name: "HIP 44382", uv: [0.214844, 0.667969], ra: 135.6117, dec: -66.3958 },
    star2: { name: "HIP 35228", uv: [0.820312, 0.523438], ra: 109.2076, dec: -67.9572 },
    star3: { name: "HIP 34481", uv: [0.808594, 0.363281], ra: 107.1868, dec: -70.4992 },
  },
  vul: {
    // vulpecula.webp
    star1: { name: "HIP 98543", uv: [0.136719, 0.480469], ra: 300.275, dec: 27.7536 },
    star2: { name: "HIP 95771", uv: [0.679688, 0.566406], ra: 292.1767, dec: 24.6652 },
    star3: { name: "HIP 94703", uv: [0.945312, 0.472656], ra: 289.0543, dec: 21.3904 },
  },
};
