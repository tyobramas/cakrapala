/**
 * Astronomy & Space Science Domain Scope Guard.
 * Deterministically blocks jailbreaks and non-astronomy topics before calling the LLM,
 * while allowing legitimate astronomy, astrophysics, aerospace, NASA, and follow-up queries.
 */

export interface ScopeCheckResult {
  allowed: boolean;
  reason: "ok" | "jailbreak" | "off_topic";
  refusalMessage?: string;
}

const ASTRONOMY_KEYWORDS_RE =
  /\b(astro|astronomi|astronomy|astrophys|astrofisika|space|antariksa|angkasa|luar angkasa|cosmos|kosmos|cosmolog|universe|alam semesta|galax|galaksi|milky\s*way|bima\s*sakti|andromeda|nebula|quasar|pulsar|magnetar|black\s*hole|lubang\s*hitam|event\s*horizon|wormhole|supernova|kilonova|nova|star|stars|bintang|constellation|rasi|zodiac|orion|crux|libra|scorpius|sirius|polaris|betelgeuse|vega|rigel|planet|planets|mercury|merkurius|venus|earth|bumi|mars|jupiter|saturn|saturnus|uranus|neptune|neptunus|pluto|ceres|europa|titan|enceladus|io|ganymede|moon|bulan|lunar|sun|matahari|solar|corona|korona|sunspot|flare|cme|aurora|eclipse|gerhana|comet|komet|asteroid|meteor|meteorite|bolide|neo|pha|apophis|bennu|didymos|dimorphos|torino|palermo|moid|kepler|hohmann|lagrange|orbit|orbital|apogee|apoge|perigee|perige|perihelion|aphelion|eccentricit|eksentrisitas|inclination|inklinasi|equinox|solstice|ecliptic|ekliptika|zenith|nadir|azimuth|azimut|altitude|declination|deklinasi|right\s*ascension|sidereal|ephemeris|efemeris|j2000|sgp4|tle|norad|celestrak|satellite|satelit|iss|tiangong|hubble|jwst|webb|chandra|voyager|artemis|apollo|parker|perseverance|ingenuity|cassini|juno|osiris|dart|new\s*horizons|sls|orion|spacex|starlink|nasa|esa|jaxa|lapan|brin|bosscha|telescope|teleskop|observator|exoplanet|eksoplanet|habitable|goldilocks|redshift|parsec|light[\s-]*year|tahun\s*cahaya|au|astronomical\s*unit|gravity|gravitasi|relativity|relativitas|spacetime|ruang[\s-]*waktu|big\s*bang|dentuman\s*besar|cmb|dark\s*matter|materi\s*gelap|dark\s*energy|energi\s*gelap|hawking|chandrasekhar|roche|escape\s*velocity|kecepatan\s*lepas|delta[\s-]*v|roket|rocket|propulsion|propulsi|ion\s*thruster|karman|biosignature|kardashev|fermi|drake|seti|bortle|spectr|spektr|doppler|parallax|paralaks|magnitude|magnitudo|albedo|kuiper|oort|van\s*allen|magnetosphere|magnetosfer|kessler|cakrapala|gravity\s*assist|slingshot)\b/i;

const JAILBREAK_RE =
  /(ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions?|forget\s+(your\s+)?(rules|instructions|prompt)|bypass\s+(guard|filter|rules)|pretend\s+(you\s+are|to\s+be)|act\s+as\s+(?!an?\s+(astrophysicist|astronomer|flight\s+director|nasa))|you\s+are\s+now\s+|abaikan\s+(semua\s+)?(instruksi|aturan|perintah)|lupakan\s+(aturan|instruksi)|ubah\s+(peran|mode|identitas)|keluar\s+dari\s+(topik|mode|batas)\s+astronomi|mode\s+bebas|dan\s+mode|jailbreak)/i;

const EXPLICIT_OFF_TOPIC_RE =
  /\b(resep|masak|memasak|makanan|minuman|kuliner|nasi\s*goreng|rendang|soto|bakso|recipe|cook|cooking|baking|coding|programming|koding|ngoding|buatkan\s+(kode|aplikasi|website|web|script|crud)|laravel|react|nextjs|next\.js|javascript|typescript|php|html|css|sql|database|mysql|postgres|politik|pemilu|pilpres|presiden|partai|gubernur|dpr|crypto|kripto|bitcoin|ethereum|saham|trading|forex|investasi|pinjol|judi|slot|sepak\s*bola|fifa|premier\s*league|badminton|nba|moto\s*gp|gosip|artis|selebriti|drakor|anime|lirik\s*lagu|chord\s*gitar|puisi\s*cinta|cerpen|novel|pacar|jodoh|menikah|percintaan|zodiak\s*(jodoh|keberuntungan|hari\s*ini|ramalan)|ramalan\s*(bintang|nasib|shio)|horoscope|tarot|diagnosis\s*(penyakit|medis)|obat\s*(sakit|batuk|demam|pusing)|gejala\s*penyakit|skripsi\s*(ekonomi|hukum|manajemen|akuntansi)|akuntansi|pajak|marketing|seo|shopee|tokopedia|tiktok|instagram)\b/i;

const SHORT_FOLLOWUP_RE =
  /^(jelaskan|lanjut|detail|lebih\s*(jelas|lanjut|detail)|contoh(nya)?|rumus(nya)?|kenapa|mengapa|bagaimana|maksudnya|terima\s*kasih|thanks|thank\s*you|ok|oke|baik|siap|yes|ya|explain\s*more|why|how|example|formula|elaborate)\b/i;

function isIndonesian(text: string): boolean {
  return /\b(apa|bagaimana|kenapa|mengapa|tolong|buat|buatkan|jelaskan|siapa|dimana|kapan|berapa|cara|apakah|bisa|tidak|bukan|tentang|saya|aku|kamu|anda|yang|dan|atau|untuk|dari|di|ke)\b/i.test(
    text,
  );
}

function buildRefusal(idLang: boolean, reason: "jailbreak" | "off_topic"): string {
  if (idLang) {
    if (reason === "jailbreak") {
      return "**[SCOPE GUARD // ASTRONOMY & SPACE ONLY]**\n\nPermintaan pengalihan peran atau pengabaian batas topik ditolak. **Cakrapala Co-Pilot** hanya melayani pembahasan **astronomi, astrofisika, antariksa, satelit, asteroid/NEO, dan misi NASA/observatorium**. Silakan ajukan pertanyaan seputar topik ruang angkasa.";
    }
    return "**[SCOPE GUARD // DI LUAR TOPIK ASTRONOMI]**\n\nMaaf, **Cakrapala Co-Pilot** dikalibrasi **khusus untuk astronomi, astrofisika, mekanika orbit, satelit, asteroid (NEO), dan eksplorasi antariksa**—sehingga tidak dapat membahas topik di luar ruang angkasa.\n\nSilakan pilih topik astronomi atau tanyakan seputar planet, rasi bintang, orbit ISS/JWST, gerhana, atau pertahanan planet.";
  }

  if (reason === "jailbreak") {
    return "**[SCOPE GUARD // ASTRONOMY & SPACE ONLY]**\n\nRole-override or instruction-bypass requests cannot be fulfilled. **Cakrapala Co-Pilot** operates strictly within **astronomy, astrophysics, orbital mechanics, satellites, planetary defense, and space exploration**. Please ask a space-science question.";
  }
  return "**[SCOPE GUARD // OUT OF ASTRONOMY SCOPE]**\n\n**Cakrapala Co-Pilot** is strictly dedicated to **astronomy, astrophysics, orbital mechanics, spacecraft telemetry, Near-Earth Objects, and cosmology**, and cannot discuss non-astronomy topics.\n\nFeel free to ask about planetary science, constellations, NASA missions, black holes, or SGP4 satellite orbits.";
}

/**
 * Evaluates whether the latest user message (in context of recent history) stays strictly
 * within Astronomy / Spaceflight / Astrophysics scope.
 */
export function checkAstronomyScope(
  latestUserMessage: string,
  recentUserMessages: string[] = [],
): ScopeCheckResult {
  const trimmed = latestUserMessage.trim();
  const idLang = isIndonesian(trimmed);

  // 1. Always reject prompt-injection / role-override attempts immediately
  if (JAILBREAK_RE.test(trimmed)) {
    return {
      allowed: false,
      reason: "jailbreak",
      refusalMessage: buildRefusal(idLang, "jailbreak"),
    };
  }

  const hasAstronomySignal = ASTRONOMY_KEYWORDS_RE.test(trimmed);
  const hasExplicitOffTopic = EXPLICIT_OFF_TOPIC_RE.test(trimmed);

  // 2. Reject explicit non-astronomy subjects unless grounded in space keywords
  if (hasExplicitOffTopic && !hasAstronomySignal) {
    return {
      allowed: false,
      reason: "off_topic",
      refusalMessage: buildRefusal(idLang, "off_topic"),
    };
  }

  // 3. If the message has no obvious off-topic keywords, check if it has astronomy context
  // or is a short conversational follow-up to a previous astronomical question.
  if (hasAstronomySignal) {
    return { allowed: true, reason: "ok" };
  }

  const priorHasAstronomy = recentUserMessages.some((m) => ASTRONOMY_KEYWORDS_RE.test(m));
  if (priorHasAstronomy && SHORT_FOLLOWUP_RE.test(trimmed) && trimmed.length < 90) {
    return { allowed: true, reason: "ok" };
  }

  // Allow simple greetings to get a concise space-scoped onboarding response from the model,
  // while blocking longer clearly non-space questions without burning LLM tokens.
  const isGreeting = /^(hi|halo|hello|hai|hey|pagi|siang|sore|malam|good\s*(morning|afternoon|evening))[\s!?.]*$/i.test(
    trimmed,
  );
  if (isGreeting) {
    return { allowed: true, reason: "ok" };
  }

  // Any query longer than a greeting that lacks astronomy context -> block cleanly
  if (trimmed.split(/\s+/).length >= 3 && !hasAstronomySignal) {
    return {
      allowed: false,
      reason: "off_topic",
      refusalMessage: buildRefusal(idLang, "off_topic"),
    };
  }

  return { allowed: true, reason: "ok" };
}
