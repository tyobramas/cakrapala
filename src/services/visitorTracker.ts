import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebase';
import type { VisitorRecord, StatsSummary, CountryStat } from '../types/stats';

// ─── Bot Signature Detection ────────────────────────────────────────────────
interface BotRule {
  regex: RegExp;
  name: string;
  type: VisitorRecord['botType'];
}

const BOT_RULES: BotRule[] = [
  { regex: /googlebot/i, name: 'Googlebot', type: 'search_engine' },
  { regex: /bingbot|msnbot/i, name: 'Bingbot', type: 'search_engine' },
  { regex: /yandexbot|yandex/i, name: 'YandexBot', type: 'search_engine' },
  { regex: /baiduspider/i, name: 'Baiduspider', type: 'search_engine' },
  { regex: /duckduckbot/i, name: 'DuckDuckBot', type: 'search_engine' },
  { regex: /slurp/i, name: 'Yahoo Slurp', type: 'search_engine' },
  { regex: /ahrefsbot/i, name: 'AhrefsBot', type: 'seo_tool' },
  { regex: /semrushbot/i, name: 'SemrushBot', type: 'seo_tool' },
  { regex: /dotbot|mj12bot|petalbot/i, name: 'SEO Crawler', type: 'seo_tool' },
  { regex: /gptbot|chatgpt-user/i, name: 'GPTBot (OpenAI)', type: 'ai_crawler' },
  { regex: /claude-web|anthropic-ai/i, name: 'ClaudeBot (Anthropic)', type: 'ai_crawler' },
  { regex: /bytespider/i, name: 'ByteSpider', type: 'ai_crawler' },
  { regex: /facebookexternalhit|meta-externalagent/i, name: 'Meta Crawler', type: 'scraper' },
  { regex: /twitterbot/i, name: 'Twitterbot', type: 'scraper' },
  { regex: /linkedinbot/i, name: 'LinkedInBot', type: 'scraper' },
  { regex: /whatsapp|telegrambot|discordbot/i, name: 'Social Preview Bot', type: 'scraper' },
  { regex: /headlesschrome|phantomjs/i, name: 'Headless Browser', type: 'automation_framework' },
  { regex: /selenium|webdriver|puppeteer|playwright/i, name: 'Automation Framework', type: 'automation_framework' },
  { regex: /python-requests|aiohttp|scrapy|curl|wget|postmanruntime/i, name: 'CLI/Script Scraper', type: 'scraper' },
  { regex: /bot|crawl|spider/i, name: 'Generic Crawler', type: 'other' },
];

export function detectBotDetails(ua: string): { 
  isBot: boolean; 
  botName?: string; 
  botType?: VisitorRecord['botType']; 
  isWebdriver: boolean 
} {
  // 1. Active Automation Webdriver Check
  const isWebdriver = typeof navigator !== 'undefined' && Boolean(navigator.webdriver);

  // 2. User-Agent Pattern Match
  for (const rule of BOT_RULES) {
    if (rule.regex.test(ua)) {
      return {
        isBot: true,
        botName: rule.name,
        botType: rule.type,
        isWebdriver,
      };
    }
  }

  // 3. Automation flag without explicit bot name
  if (isWebdriver) {
    return {
      isBot: true,
      botName: 'Webdriver Automation Tool',
      botType: 'automation_framework',
      isWebdriver: true,
    };
  }

  return { isBot: false, isWebdriver: false };
}

// ─── Device & Browser Parser ────────────────────────────────────────────────
export function parseClientEnvironment() {
  if (typeof window === 'undefined') {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      deviceType: 'desktop' as const,
      screenResolution: 'Unknown',
      language: 'en',
    };
  }

  const ua = navigator.userAgent;
  let browser = 'Other';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';

  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  const isMobile = /android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isTablet = /ipad|tablet|(android(?!.*mobile))/i.test(ua);
  const deviceType: 'mobile' | 'tablet' | 'desktop' = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  const screenResolution = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  const language = navigator.language || 'en';

  return { browser, os, deviceType, screenResolution, language };
}

export function maskIp(ip: string): string {
  // Explicitly return full raw IP unmasked (NO asterisks / NO hiding)
  return ip || 'Unknown';
}

// ─── IP & VPN / Security API ────────────────────────────────────────────────
interface IpQueryResponse {
  ip: string;
  isp?: { asn?: string; org?: string; isp?: string };
  location?: {
    country?: string;
    country_code?: string;
    city?: string;
    state?: string;
  };
  risk?: {
    is_vpn?: boolean;
    is_tor?: boolean;
    is_proxy?: boolean;
    is_datacenter?: boolean;
    risk_score?: number;
  };
}

async function fetchGeoAndSecurityData() {
  // Attempt 1: api.ipquery.io (Comprehensive VPN, Tor, Proxy, Datacenter, and Geo)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://api.ipquery.io/?format=json', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as IpQueryResponse;
      return {
        ip: data.ip || 'Unknown',
        country: data.location?.country || 'Unknown',
        countryCode: data.location?.country_code || 'UN',
        city: data.location?.city || 'Unknown',
        region: data.location?.state || '',
        isp: data.isp?.isp || data.isp?.org || 'Unknown ISP',
        asn: data.isp?.asn || '',
        isVpn: Boolean(data.risk?.is_vpn),
        isProxy: Boolean(data.risk?.is_proxy),
        isTor: Boolean(data.risk?.is_tor),
        isDatacenter: Boolean(data.risk?.is_datacenter),
        riskScore: data.risk?.risk_score ?? 0,
      };
    }
  } catch {
    // Continue to fallback
  }

  // Attempt 2: Fallback to ipwhois.app (Geo + ISP)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://ipwhois.app/json/', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        ip: data.ip || 'Unknown',
        country: data.country || 'Unknown',
        countryCode: data.country_code || 'UN',
        city: data.city || 'Unknown',
        region: data.region || '',
        isp: data.isp || data.org || 'Unknown ISP',
        asn: data.asn || '',
        isVpn: false,
        isProxy: false,
        isTor: false,
        isDatacenter: false,
        riskScore: 0,
      };
    }
  } catch {
    // Continue to fallback
  }

  // Attempt 3: Local Offline Fallback
  return {
    ip: 'Unknown',
    country: 'Unknown',
    countryCode: 'UN',
    city: 'Unknown',
    region: '',
    isp: 'Unknown ISP',
    asn: '',
    isVpn: false,
    isProxy: false,
    isTor: false,
    isDatacenter: false,
    riskScore: 0,
  };
}

// ─── Deduplication & Tracking Engine ─────────────────────────────────────────
const SESSION_STORAGE_KEY = 'portfolio_tracked_visit_timestamp';
const SESSION_EXPIRY_MS = 20 * 60 * 1000; // 20 minutes session deduplication

export async function trackVisitor(currentPath: string = typeof window !== 'undefined' ? window.location.pathname : '/'): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Don't track visits inside /stats or /admin to avoid polluting public traffic metrics
  const cleanPath = currentPath.replace(/\/+$/, '') || '/';
  if (cleanPath === '/stats' || cleanPath === '/admin') {
    return false;
  }

  // Deduplication check per session
  const lastTracked = sessionStorage.getItem(SESSION_STORAGE_KEY);
  const now = Date.now();
  if (lastTracked && now - Number(lastTracked) < SESSION_EXPIRY_MS) {
    return false; // Already tracked in this active session
  }

  try {
    const ua = navigator.userAgent || '';
    const botInfo = detectBotDetails(ua);
    const clientEnv = parseClientEnvironment();
    const geoData = await fetchGeoAndSecurityData();

    const record: VisitorRecord = {
      ip: maskIp(geoData.ip),
      fullIp: geoData.ip,
      timestamp: now,
      isoDate: new Date(now).toISOString(),
      path: cleanPath,
      referrer: document.referrer || 'Direct Visit',
      userAgent: ua,

      country: geoData.country || 'Unknown',
      countryCode: geoData.countryCode || 'UN',
      city: geoData.city || 'Unknown',
      region: geoData.region || '',
      isp: geoData.isp || 'Unknown ISP',
      asn: geoData.asn || '',

      isVpn: geoData.isVpn ?? false,
      isProxy: geoData.isProxy ?? false,
      isTor: geoData.isTor ?? false,
      isDatacenter: geoData.isDatacenter ?? false,
      riskScore: geoData.riskScore ?? 0,

      isBot: botInfo.isBot ?? false,
      botName: botInfo.botName || '',
      botType: botInfo.botType || 'other',
      isWebdriver: botInfo.isWebdriver ?? false,

      browser: clientEnv.browser || 'Other',
      os: clientEnv.os || 'Unknown',
      deviceType: clientEnv.deviceType || 'desktop',
      screenResolution: clientEnv.screenResolution || 'Unknown',
      language: clientEnv.language || 'en',
    };

    // Filter out any undefined properties before saving to Firestore
    const sanitizedRecord = Object.fromEntries(
      Object.entries(record).filter(([, v]) => v !== undefined)
    );

    // Save to Firestore
    await addDoc(collection(db, 'visitor_logs'), sanitizedRecord);
    sessionStorage.setItem(SESSION_STORAGE_KEY, String(now));
    return true;
  } catch (err) {
    console.warn('[VisitorTracker] Failed to record visit:', err);
    return false;
  }
}

// ─── Query & Aggregation Service ─────────────────────────────────────────────
export function subscribeVisitorLogs(
  onLogs: (logs: VisitorRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'visitor_logs'),
    orderBy('timestamp', 'desc'),
    limit(250)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: VisitorRecord[] = snapshot.docs.map((doc) => {
        const data = doc.data() as VisitorRecord;
        return {
          ...data,
          id: doc.id,
        };
      });
      onLogs(records);
    },
    (err) => {
      console.error('[VisitorTracker] Firestore subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function fetchVisitorLogsOnce(): Promise<VisitorRecord[]> {
  try {
    const q = query(
      collection(db, 'visitor_logs'),
      orderBy('timestamp', 'desc'),
      limit(250)
    );
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({
      ...(doc.data() as VisitorRecord),
      id: doc.id,
    }));
  } catch (err) {
    console.error('[VisitorTracker] fetchVisitorLogsOnce error:', err);
    return [];
  }
}

export function computeStatsSummary(logs: VisitorRecord[]): StatsSummary {
  const totalVisitors = logs.length;
  let humanCount = 0;
  let botCount = 0;
  let vpnCount = 0;
  let datacenterCount = 0;

  const countryMap = new Map<string, { country: string; countryCode: string; count: number }>();
  const pagesMap = new Map<string, number>();
  const referrerMap = new Map<string, number>();
  const botMap: { [key: string]: number } = {};
  const deviceBreakdown = { desktop: 0, mobile: 0, tablet: 0 };

  for (const log of logs) {
    if (log.isBot) {
      botCount++;
      const bName = log.botName || 'Other Bot';
      botMap[bName] = (botMap[bName] || 0) + 1;
    } else {
      humanCount++;
    }

    if (log.isVpn || log.isProxy || log.isTor) {
      vpnCount++;
    }

    if (log.isDatacenter) {
      datacenterCount++;
    }

    // Country aggregation
    const cKey = log.country || 'Unknown';
    const existing = countryMap.get(cKey) || {
      country: cKey,
      countryCode: log.countryCode || 'UN',
      count: 0,
    };
    existing.count += 1;
    countryMap.set(cKey, existing);

    // Page aggregation
    const p = log.path || '/';
    pagesMap.set(p, (pagesMap.get(p) || 0) + 1);

    // Referrer aggregation
    let ref = log.referrer || 'Direct Visit';
    if (ref.startsWith('http')) {
      try {
        ref = new URL(ref).hostname;
      } catch {
        // keep ref
      }
    }
    referrerMap.set(ref, (referrerMap.get(ref) || 0) + 1);

    // Devices
    if (log.deviceType === 'mobile') deviceBreakdown.mobile++;
    else if (log.deviceType === 'tablet') deviceBreakdown.tablet++;
    else deviceBreakdown.desktop++;
  }

  const topCountries: CountryStat[] = Array.from(countryMap.values())
    .sort((a, b) => b.count - a.count)
    .map((c) => ({
      ...c,
      percentage: totalVisitors > 0 ? Math.round((c.count / totalVisitors) * 100) : 0,
    }));

  const topPages = Array.from(pagesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([path, count]) => ({ path, count }));

  const trafficSources = Array.from(referrerMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([referrer, count]) => ({ referrer, count }));

  return {
    totalVisitors,
    totalPageviews: totalVisitors, // initial baseline
    humanCount,
    botCount,
    vpnCount,
    datacenterCount,
    uniqueCountries: countryMap.size,
    topCountries,
    topPages,
    trafficSources,
    deviceBreakdown,
    botBreakdown: botMap,
  };
}
