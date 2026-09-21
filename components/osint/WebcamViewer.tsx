'use client';
// components/osint/WebcamViewer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// OSINT Webcam Viewer Inspector Modal.
//
// Strict License & Ethical Compliance:
//   - L1: 8-minute image token caching with single automatic retry on HTTP 401.
//   - L4: ZERO screenshot, image download, copy, collage, or export buttons.
//   - L5: Never stretch images beyond natural resolution (maxWidth/maxHeight capped).
//   - L7: Exact mandatory Windy attribution with active links & standard text size.
//   - L9: ZERO digital zoom enhancement, facial recognition, or person identification.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { OsintEntity } from '@/lib/osint/types';

export interface WebcamViewerProps {
  entity: OsintEntity | null;
  onClose: () => void;
}

/**
 * Computes dimension style constraints strictly enforcing L5.
 * Never exceeds original image width or height.
 */
export function computeImageDimensions(
  imageWidth?: number,
  imageHeight?: number,
  containerMaxWidth = 800,
  containerMaxHeight = 600,
): { maxWidth: string; maxHeight: string } {
  const naturalW = typeof imageWidth === 'number' && imageWidth > 0 ? imageWidth : 800;
  const naturalH = typeof imageHeight === 'number' && imageHeight > 0 ? imageHeight : 450;

  const constrainedW = Math.min(naturalW, containerMaxWidth);
  const constrainedH = Math.min(naturalH, containerMaxHeight);

  return {
    maxWidth: `${constrainedW}px`,
    maxHeight: `${constrainedH}px`,
  };
}

export default function WebcamViewer({ entity, onClose }: WebcamViewerProps) {
  const raw = (entity?.raw ?? {}) as Record<string, unknown>;
  const isWindy = raw.provider === 'windy' || entity?.source === 'Windy.com';
  const isOfficial = raw.provider === 'official' || entity?.id.startsWith('eyes:official:');

  const initialUrl = (raw.previewUrl as string) || (raw.thumbnailUrl as string) || (raw.streamUrl as string) || null;
  const imageWidth = typeof raw.imageWidth === 'number' ? raw.imageWidth : 800;
  const imageHeight = typeof raw.imageHeight === 'number' ? raw.imageHeight : 450;

  const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl);
  const [retried, setRetried] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Sync state when entity changes
  useEffect(() => {
    setCurrentUrl(initialUrl);
    setRetried(false);
    setIsRefreshing(false);
    setHasError(false);
  }, [initialUrl, entity?.id]);

  // Dimensions enforcing L5
  const dims = useMemo(() => {
    return computeImageDimensions(imageWidth, imageHeight);
  }, [imageWidth, imageHeight]);

  // Token refresh when image fails to load (e.g. 401 expired token)
  const handleImageError = useCallback(async () => {
    if (!isWindy || retried || !raw.webcamId) {
      setHasError(true);
      return;
    }

    setRetried(true);
    setIsRefreshing(true);

    try {
      const res = await fetch(`/api/osint/eyes?webcamId=${raw.webcamId}&type=image`);
      if (!res.ok) {
        setHasError(true);
        return;
      }
      const data = await res.json();
      const freshPreview = data?.images?.current?.preview || data?.images?.current?.thumbnail;
      if (freshPreview) {
        setCurrentUrl(freshPreview);
        setHasError(false);
      } else {
        setHasError(true);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [isWindy, retried, raw.webcamId]);

  if (!entity) return null;

  const sourcePage = (raw.sourcePage as string) || null;
  const streamType = (raw.streamType as string) || 'snapshot';
  const categories = Array.isArray(raw.categories) ? (raw.categories as string[]) : [];
  const lastUpdated = (raw.lastUpdated as string) || entity.observedAt;
  const isEmbedOnly = streamType === 'embed' || streamType === 'external';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="webcam-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-lime-500 shadow-[0_0_8px_rgba(163,230,53,0.6)]" />
            <div>
              <h2 id="webcam-title" className="text-base font-semibold text-neutral-100 line-clamp-1">
                {entity.label}
              </h2>
              <div className="text-xs text-neutral-400 font-mono mt-0.5">
                {entity.source} {raw.city ? `· ${raw.city}` : ''} {raw.country ? `(${raw.country})` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close webcam viewer"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col items-center">
          {/* Image Container — Strictly bounded by natural dimensions (L5) */}
          <div
            style={{
              maxWidth: dims.maxWidth,
              maxHeight: dims.maxHeight,
              width: '100%',
              aspectRatio: `${imageWidth} / ${imageHeight}`,
            }}
            className="relative flex items-center justify-center bg-black/80 rounded-xl overflow-hidden border border-neutral-800"
          >
            {isRefreshing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-lime-400 gap-2 z-10">
                <span className="w-6 h-6 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">Refreshing image token...</span>
              </div>
            )}

            {isEmbedOnly ? (
              <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
                <div className="text-neutral-400 text-sm">
                  Official camera feed is streamed directly via the transportation agency / municipal portal.
                </div>
                {sourcePage && (
                  <a
                    href={sourcePage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-lime-500 text-black font-semibold text-xs rounded-lg hover:bg-lime-400 transition-colors shadow"
                  >
                    Open Official Stream ↗
                  </a>
                )}
              </div>
            ) : hasError ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-neutral-400 gap-2">
                <span className="text-2xl">📷</span>
                <span className="text-sm font-medium text-neutral-300">Image currently unavailable</span>
                <span className="text-xs text-neutral-500">Image token has expired or camera is offline.</span>
              </div>
            ) : currentUrl ? (
              /* L5: object-fit: contain, width/height never upscaled, L4: no context menu / drag */
              <img
                src={currentUrl}
                alt={entity.label}
                style={{
                  maxWidth: dims.maxWidth,
                  maxHeight: dims.maxHeight,
                  objectFit: 'contain',
                }}
                className="w-full h-full select-none pointer-events-none"
                onError={handleImageError}
              />
            ) : (
              <div className="text-xs text-neutral-500 font-mono">No image preview available</div>
            )}
          </div>

          {/* Time & Freshness Disclaimer */}
          <div className="w-full mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400 border-t border-neutral-800/80 pt-3">
            <div>
              <span className="text-neutral-500">Last updated: </span>
              <span className="font-mono text-neutral-200">
                {lastUpdated ? new Date(lastUpdated).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded'}
              </span>
              <span className="text-neutral-500 text-[11px] ml-1.5">(Webcam snapshots are not continuous real-time video)</span>
            </div>

            {sourcePage && (
              <a
                href={sourcePage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-lime-400 hover:text-lime-300 hover:underline transition-colors"
              >
                Official Source Page ↗
              </a>
            )}
          </div>

          {/* Categories tag if available */}
          {categories.length > 0 && (
            <div className="w-full mt-2 flex flex-wrap gap-1.5">
              {categories.map((cat, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-[10px] font-mono rounded bg-neutral-800 text-neutral-400 border border-neutral-700/50"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer — License Attribution (L7) */}
        <div className="px-5 py-3.5 border-t border-neutral-800 bg-neutral-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          {isWindy ? (
            /* L7: Exact required text and active links with standard font size and normal color */
            <div className="text-neutral-300 text-sm font-normal text-center sm:text-left">
              Webcams provided by{' '}
              <a
                href="https://www.windy.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-400 underline hover:text-lime-300"
              >
                windy.com
              </a>{' '}
              -{' '}
              <a
                href="https://www.windy.com/webcams/add"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-400 underline hover:text-lime-300"
              >
                add new webcam
              </a>
            </div>
          ) : isOfficial ? (
            <div className="text-neutral-300 text-xs font-normal">
              Public traffic camera feed from official transportation agency ({entity.source}).
            </div>
          ) : (
            <div className="text-neutral-400 text-xs">Source: {entity.source}</div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
