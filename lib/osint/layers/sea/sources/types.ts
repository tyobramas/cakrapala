// lib/osint/layers/sea/sources/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Swappable AIS Source Adapter Interface (Phase 1: HTTP, Phase 2: aisstream worker)
// ─────────────────────────────────────────────────────────────────────────────

import type { BBox, OsintEntity } from '@/lib/osint/types';

export interface SeaSourceResult {
  entities: OsintEntity[];
  upstreamUpdatedTime?: number;
  totalVesselsInSource?: number;
  cutCount?: number;
}

export interface SeaSourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly attribution: string;
  readonly coverageBBoxes: BBox[];
  fetchVessels(bbox?: BBox): Promise<SeaSourceResult>;
}
