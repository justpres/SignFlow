'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HandIcon,
  PenIcon,
  UndoIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ResetZoomIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/ui/Icons';

export interface InteractiveFastSignerProps {
  pdfBase64: string;
  contractTitle?: string;
  designatedPage?: number;
  designatedX?: number;
  designatedY?: number;
  signatureDataUrl?: string | null;
  onSignatureChange: (
    dataUrl: string | null,
    meta?: {
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  ) => void;
  onProceedToSign: () => void;
}

type Point = { x: number; y: number }; // In unscaled PDF points
type Stroke = Point[];

export function InteractiveFastSigner({
  pdfBase64,
  contractTitle,
  designatedPage,
  signatureDataUrl: _signatureDataUrl,
  onSignatureChange,
  onProceedToSign,
}: InteractiveFastSignerProps) {
  // Mode: 'NAVIGATE' (pan, scroll, zoom, pinch) vs 'PEN' (frozen document, active ink canvas)
  const [mode, setMode] = useState<'NAVIGATE' | 'PEN'>('NAVIGATE');

  // PDF Document & Page States
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(designatedPage || 1);
  const [scale, setScale] = useState<number>(1.1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  // Stroke Stack for authentic drawing & Word-style Undo
  // Stored per page: map of pageNumber -> Stroke[]
  const [pageStrokes, setPageStrokes] = useState<Record<number, Stroke[]>>({});
  const pageStrokesRef = useRef<Record<number, Stroke[]>>({});
  useEffect(() => {
    pageStrokesRef.current = pageStrokes;
  }, [pageStrokes]);
  const activeStrokeRef = useRef<Stroke>([]);
  const isDrawingRef = useRef<boolean>(false);

  // DOM Refs
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageWrapperRef = useRef<HTMLDivElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);

  // Touch panning and pinch-to-zoom tracking in NAVIGATE mode
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1.1);
  const mouseDragStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Current page strokes
  const currentStrokes = pageStrokes[currentPage] || [];

  // Helper to re-render all ink strokes onto inkCanvas
  const redrawInkCanvas = useCallback(
    (strokes: Stroke[], targetScale: number, dims: { width: number; height: number }) => {
      const canvas = inkCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const cssWidth = dims.width * targetScale;
      const cssHeight = dims.height * targetScale;

      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      if (!strokes || strokes.length === 0) return;

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2.5, 3 * targetScale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const stroke of strokes) {
        if (stroke.length === 0) continue;
        ctx.beginPath();
        const startX = stroke[0].x * targetScale;
        const startY = stroke[0].y * targetScale;
        ctx.moveTo(startX, startY);

        if (stroke.length === 1) {
          ctx.arc(startX, startY, ctx.lineWidth / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x * targetScale, stroke[i].y * targetScale);
          }
          ctx.stroke();
        }
      }
    },
    []
  );

  // Export crisp transparent PNG signature from strokes
  const exportSignature = useCallback(
    (strokes: Stroke[], pageNum: number, dims: { width: number; height: number }) => {
      if (!strokes || strokes.length === 0) {
        onSignatureChange(null);
        return;
      }

      // Compute bounding box
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let pointCount = 0;

      for (const stroke of strokes) {
        for (const pt of stroke) {
          pointCount++;
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
      }

      if (pointCount < 2 || maxX - minX < 2 || maxY - minY < 2) {
        onSignatureChange(null);
        return;
      }

      const padding = 12;
      const strokeWidthPt = 3;
      const boxWidth = Math.max(140, maxX - minX + padding * 2);
      const boxHeight = Math.max(50, maxY - minY + padding * 2);

      const offscreen = document.createElement('canvas');
      const renderScale = 2; // 2x crisp output
      offscreen.width = Math.round(boxWidth * renderScale);
      offscreen.height = Math.round(boxHeight * renderScale);

      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.scale(renderScale, renderScale);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeWidthPt;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const offsetX = minX - (boxWidth - (maxX - minX)) / 2;
      const offsetY = minY - (boxHeight - (maxY - minY)) / 2;

      for (const stroke of strokes) {
        if (stroke.length === 0) continue;
        ctx.beginPath();
        const startX = stroke[0].x - offsetX;
        const startY = stroke[0].y - offsetY;
        ctx.moveTo(startX, startY);

        if (stroke.length === 1) {
          ctx.arc(startX, startY, strokeWidthPt / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x - offsetX, stroke[i].y - offsetY);
          }
          ctx.stroke();
        }
      }

      const dataUrl = offscreen.toDataURL('image/png');

      // PDF coordinate conversion: PDF (0, 0) is bottom-left
      // offsetY is distance from page top; in PDF points from bottom:
      const pdfY = dims.height - (offsetY + boxHeight);
      const pdfX = Math.max(0, offsetX);

      onSignatureChange(dataUrl, {
        page: pageNum,
        x: Math.round(pdfX),
        y: Math.round(pdfY),
        width: Math.round(boxWidth),
        height: Math.round(boxHeight),
      });
    },
    [onSignatureChange]
  );

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setIsLoading(true);
      setError(null);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
        }

        const cleanBase64 = pdfBase64.trim().replace(/^data:[^;]+;base64,/, '');
        const rawBytes = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
        const loadingTask = pdfjsLib.getDocument({ data: rawBytes });
        const doc = await loadingTask.promise;

        if (isCancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);

        const startPage = designatedPage && designatedPage > 0 && designatedPage <= doc.numPages
          ? designatedPage
          : 1;
        setCurrentPage(startPage);

        // Auto-scale comfortably based on window width
        if (typeof window !== 'undefined') {
          const winWidth = window.innerWidth;
          if (winWidth < 640) {
            // Mobile: fit screen width with margin (supporting 360px+ screens)
            const targetScale = Math.max(0.5, Math.min(1.0, (winWidth - 20) / 612));
            setScale(Number(targetScale.toFixed(2)));
          } else {
            setScale(1.15);
          }
        }

        setIsLoading(false);
      } catch (err) {
        if (isCancelled) return;
        console.error('PDF load error:', err);
        setError('Failed to load contract document preview.');
        setIsLoading(false);
      }
    }

    if (pdfBase64) {
      loadPdf();
    }

    return () => {
      isCancelled = true;
    };
  }, [pdfBase64, designatedPage]);

  // Handle window resizing and orientation changes dynamically for universal phone support
  useEffect(() => {
    function handleResize() {
      if (typeof window === 'undefined') return;
      const winWidth = window.innerWidth;
      if (winWidth < 640) {
        const docWidth = pageDimensions.width || 612;
        const targetScale = Math.max(0.35, Math.min(1.0, (winWidth - 24) / docWidth));
        setScale(Number(targetScale.toFixed(2)));
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageDimensions.width]);

  // Render current PDF page
  useEffect(() => {
    let isCancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentRenderTask: any = null;

    async function renderPage() {
      if (!pdfDocRef.current || !pdfCanvasRef.current) return;

      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const dims = { width: unscaledViewport.width, height: unscaledViewport.height };
        setPageDimensions(dims);

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = pdfCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${dims.width * scale}px`;
        canvas.style.height = `${dims.height * scale}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        currentRenderTask = page.render(renderContext);
        await currentRenderTask.promise;

        // Redraw ink canvas to match new scale/page
        if (!isCancelled) {
          redrawInkCanvas(pageStrokesRef.current[currentPage] || [], scale, dims);
        }
      } catch (e: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!isCancelled && (e as any)?.name !== 'RenderingCancelledException') {
          console.error('Page render error:', e);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (currentRenderTask) {
        currentRenderTask.cancel();
      }
    };
  }, [currentPage, scale, redrawInkCanvas]);

  // Word-style Undo: pop last stroke from active page
  const handleUndo = useCallback(() => {
    setPageStrokes((prev) => {
      const existing = prev[currentPage] || [];
      if (existing.length === 0) return prev;
      const updated = existing.slice(0, -1);
      const nextMap = { ...prev, [currentPage]: updated };
      redrawInkCanvas(updated, scale, pageDimensions);
      exportSignature(updated, currentPage, pageDimensions);
      return nextMap;
    });
  }, [currentPage, scale, pageDimensions, redrawInkCanvas, exportSignature]);

  // Clear all strokes on active page
  const handleClear = useCallback(() => {
    setPageStrokes((prev) => {
      const nextMap = { ...prev, [currentPage]: [] };
      redrawInkCanvas([], scale, pageDimensions);
      exportSignature([], currentPage, pageDimensions);
      return nextMap;
    });
  }, [currentPage, scale, pageDimensions, redrawInkCanvas, exportSignature]);

  // Pointer event handlers on Ink Canvas (active only in PEN mode)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'PEN') return;
    const canvas = inkCanvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // In some mobile WebViews pointer capture can throw if already ended
    }
    isDrawingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    // Convert CSS px to unscaled PDF points
    const ptX = cssX / scale;
    const ptY = cssY / scale;

    const startPt: Point = { x: ptX, y: ptY };
    activeStrokeRef.current = [startPt];

    // Draw initial mark immediately on canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      ctx.save();
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.lineWidth = Math.max(2.5, 3 * scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(cssX, cssY, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'PEN' || !isDrawingRef.current) return;
    const canvas = inkCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    const ptX = cssX / scale;
    const ptY = cssY / scale;

    const prevPt = activeStrokeRef.current[activeStrokeRef.current.length - 1];
    activeStrokeRef.current.push({ x: ptX, y: ptY });

    // Stream draw segment to canvas
    const ctx = canvas.getContext('2d');
    if (ctx && prevPt) {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      ctx.save();
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2.5, 3 * scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prevPt.x * scale, prevPt.y * scale);
      ctx.lineTo(cssX, cssY);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'PEN' || !isDrawingRef.current) return;
    const canvas = inkCanvasRef.current;
    try {
      if (canvas && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore if pointer capture already lost
    }
    isDrawingRef.current = false;

    const finishedStroke = [...activeStrokeRef.current];
    activeStrokeRef.current = [];

    if (finishedStroke.length > 0) {
      setPageStrokes((prev) => {
        const existing = prev[currentPage] || [];
        const updated = [...existing, finishedStroke];
        const nextMap = { ...prev, [currentPage]: updated };
        redrawInkCanvas(updated, scale, pageDimensions);
        exportSignature(updated, currentPage, pageDimensions);
        return nextMap;
      });
    }
  };

  // Drag-to-pan in NAVIGATE mode with desktop mouse
  const handleMouseDownNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'NAVIGATE' || !scrollContainerRef.current) return;
    // Don't intercept button clicks or interactive elements
    if ((e.target as HTMLElement).closest('button')) return;

    mouseDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop,
    };
  };

  const handleMouseMoveNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'NAVIGATE' || !mouseDragStartRef.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - mouseDragStartRef.current.x;
    const dy = e.clientY - mouseDragStartRef.current.y;
    scrollContainerRef.current.scrollLeft = mouseDragStartRef.current.scrollLeft - dx;
    scrollContainerRef.current.scrollTop = mouseDragStartRef.current.scrollTop - dy;
  };

  const handleMouseUpNavigate = () => {
    mouseDragStartRef.current = null;
  };

  // Pinch-to-zoom in NAVIGATE mode on mobile touch screens
  const handleTouchStartNavigate = (e: React.TouchEvent<HTMLDivElement>) => {
    if (mode !== 'NAVIGATE') return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
      touchStartScaleRef.current = scale;
    }
  };

  const handleTouchMoveNavigate = (e: React.TouchEvent<HTMLDivElement>) => {
    if (mode !== 'NAVIGATE' || e.touches.length !== 2 || touchStartDistRef.current === null) return;
    if (e.cancelable) e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const currentDist = Math.hypot(dx, dy);
    const ratio = currentDist / touchStartDistRef.current;
    const nextScale = Math.max(0.4, Math.min(2.5, touchStartScaleRef.current * ratio));
    setScale(Number(nextScale.toFixed(2)));
  };

  const handleTouchEndNavigate = () => {
    touchStartDistRef.current = null;
  };

  // Navigation helpers
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };
  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((p) => p + 1);
  };
  const handleZoomIn = () => setScale((s) => Math.min(Number((s + 0.2).toFixed(2)), 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(Number((s - 0.2).toFixed(2)), 0.4));
  const handleResetZoom = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      const docWidth = pageDimensions.width || 612;
      const targetScale = Math.max(0.35, Math.min(1.0, (window.innerWidth - 24) / docWidth));
      setScale(Number(targetScale.toFixed(2)));
    } else {
      setScale(1.0);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-neutral-100 select-none overflow-hidden relative font-sans">
      {/* Main Interactive Document Viewport */}
      <div
        ref={scrollContainerRef}
        aria-label={contractTitle || 'Contract Document'}
        tabIndex={0}
        className={`flex-1 relative overflow-auto p-3 sm:p-4 transition-colors pb-36 sm:pb-24 ${
          mode === 'PEN' ? 'touch-none overflow-hidden cursor-crosshair bg-neutral-200/90' : 'cursor-grab active:cursor-grabbing bg-neutral-100'
        }`}
        onMouseDown={handleMouseDownNavigate}
        onMouseMove={handleMouseMoveNavigate}
        onMouseUp={handleMouseUpNavigate}
        onTouchStart={handleTouchStartNavigate}
        onTouchMove={handleTouchMoveNavigate}
        onTouchEnd={handleTouchEndNavigate}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-16">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-neutral-600">Rendering document pages...</p>
          </div>
        ) : error ? (
          <div className="p-4 border border-black bg-white text-xs text-black max-w-md mx-auto text-center">
            {error}
          </div>
        ) : (
          <div className="w-fit min-w-full min-h-full flex items-start justify-center">
            <div
              ref={pageWrapperRef}
              className="relative bg-white shadow-xl border border-neutral-300 m-auto transition-transform"
              style={{
                width: `${pageDimensions.width * scale}px`,
                height: `${pageDimensions.height * scale}px`,
              }}
            >
              {/* Underlying PDF Page Canvas */}
              <canvas ref={pdfCanvasRef} className="block pointer-events-none" />

              {/* Inking Drawing Canvas Overlay */}
              <canvas
                ref={inkCanvasRef}
                className={`absolute inset-0 z-20 ${
                  mode === 'PEN' ? 'pointer-events-auto touch-none cursor-crosshair' : 'pointer-events-none'
                }`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUpOrCancel}
                onPointerCancel={handlePointerUpOrCancel}
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating High-Contrast Mobile Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-black shadow-2xl p-2 sm:p-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Controls Bar: Ultra-Compact Icon-Only Toolbar */}
          <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {/* Mode Toggle: Hand (Pan & Zoom) vs Pen (Ink Sign) */}
            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={() => setMode('NAVIGATE')}
                className={`w-8 h-8 sm:w-9 sm:h-9 text-xs font-bold transition-colors border-2 cursor-pointer flex items-center justify-center ${
                  mode === 'NAVIGATE'
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-white text-black border-neutral-300 hover:border-black'
                }`}
                aria-label="Pan and zoom mode"
                aria-pressed={mode === 'NAVIGATE'}
                title="Pan & Zoom Mode"
              >
                <HandIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                type="button"
                onClick={() => setMode('PEN')}
                className={`w-8 h-8 sm:w-9 sm:h-9 text-xs font-bold transition-colors border-2 cursor-pointer flex items-center justify-center ${
                  mode === 'PEN'
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-white text-black border-neutral-300 hover:border-black'
                }`}
                aria-label="Pen drawing mode"
                aria-pressed={mode === 'PEN'}
                title="Pen / Sign Mode"
              >
                <PenIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <span className="text-neutral-300 mx-0.5 shrink-0" aria-hidden="true">|</span>

            {/* Stroke Actions: Undo & Clear */}
            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={handleUndo}
                disabled={currentStrokes.length === 0}
                className={`w-8 h-8 sm:w-9 sm:h-9 border-2 transition-colors cursor-pointer flex items-center justify-center ${
                  currentStrokes.length === 0
                    ? 'opacity-30 cursor-not-allowed text-neutral-400 border-neutral-200 bg-white'
                    : 'bg-white text-black border-neutral-300 hover:border-black hover:bg-neutral-100'
                }`}
                aria-label="Undo stroke"
                title="Undo last stroke"
              >
                <UndoIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={currentStrokes.length === 0}
                className={`w-8 h-8 sm:w-9 sm:h-9 border-2 transition-colors cursor-pointer flex items-center justify-center ${
                  currentStrokes.length === 0
                    ? 'opacity-30 cursor-not-allowed text-neutral-400 border-neutral-200 bg-white'
                    : 'bg-white text-black border-neutral-300 hover:border-black hover:bg-neutral-100'
                }`}
                aria-label="Clear page signature"
                title="Clear signature on this page"
              >
                <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <span className="text-neutral-300 mx-0.5 shrink-0" aria-hidden="true">|</span>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-8 h-8 sm:w-9 sm:h-9 border-2 border-neutral-300 bg-white text-black hover:border-black transition-colors cursor-pointer flex items-center justify-center"
                aria-label="Zoom out"
                title="Zoom out"
              >
                <ZoomOutIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                className="w-8 h-8 sm:w-9 sm:h-9 border-2 border-neutral-300 bg-white text-black hover:border-black transition-colors cursor-pointer flex items-center justify-center"
                aria-label={`Reset zoom to fit (${Math.round(scale * 100)}%)`}
                title={`Reset zoom to fit (${Math.round(scale * 100)}%)`}
              >
                <ResetZoomIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                className="w-8 h-8 sm:w-9 sm:h-9 border-2 border-neutral-300 bg-white text-black hover:border-black transition-colors cursor-pointer flex items-center justify-center"
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomInIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Page Navigation (if multi-page document) */}
            {numPages > 1 && (
              <>
                <span className="text-neutral-300 mx-0.5 shrink-0" aria-hidden="true">|</span>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={handlePrevPage}
                    disabled={currentPage <= 1}
                    className="w-7 h-8 sm:w-8 sm:h-9 border-2 border-neutral-300 bg-white text-black hover:border-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
                    aria-label="Previous page"
                    title="Previous page"
                  >
                    <ChevronLeftIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <span className="text-[10px] sm:text-[11px] font-mono font-semibold px-0.5" aria-label={`Page ${currentPage} of ${numPages}`}>
                    {currentPage}/{numPages}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={currentPage >= numPages}
                    className="w-7 h-8 sm:w-8 sm:h-9 border-2 border-neutral-300 bg-white text-black hover:border-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
                    aria-label="Next page"
                    title="Next page"
                  >
                    <ChevronRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Primary Action Button: SIGN */}
          <div className="w-full sm:w-auto shrink-0 sm:ml-auto">
            <button
              type="button"
              onClick={onProceedToSign}
              className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-black text-white text-xs sm:text-sm font-bold uppercase tracking-wider border-2 border-black hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center shadow-md active:scale-[0.99]"
              aria-label="Sign document"
            >
              <span>SIGN</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
