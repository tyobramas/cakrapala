export interface VisitorRecord {
  id?: string;
  ip: string; // Full unmasked raw IP address (no asterisks / sensor)
  fullIp?: string;
  timestamp: number; // Unix epoch ms
  isoDate: string; // ISO string
  path: string;
  referrer: string;
  userAgent: string;

  // Location & ISP
  country: string;
  countryCode: string;
  city: string;
  region?: string;
  isp: string;
  asn?: string;

  // Security & VPN / Proxy / Risk
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  riskScore: number;

  // Bot Detection
  isBot: boolean;
  botName?: string;
  botType?: 'search_engine' | 'ai_crawler' | 'seo_tool' | 'scraper' | 'automation_framework' | 'other';
  isWebdriver: boolean;

  // Client Details
  browser: string;
  os: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  screenResolution: string;
  language: string;
}

export interface CountryStat {
  country: string;
  countryCode: string;
  count: number;
  percentage: number;
}

export interface StatsSummary {
  totalVisitors: number;
  totalPageviews: number;
  humanCount: number;
  botCount: number;
  vpnCount: number;
  datacenterCount: number;
  uniqueCountries: number;
  topCountries: CountryStat[];
  topPages: { path: string; count: number }[];
  trafficSources: { referrer: string; count: number }[];
  deviceBreakdown: { desktop: number; mobile: number; tablet: number };
  botBreakdown: { [key: string]: number };
}
