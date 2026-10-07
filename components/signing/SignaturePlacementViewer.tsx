'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { PlacedField, SignaturePlacement } from '@/lib/types';

export interface SignaturePlacementViewerProps {
  pdfBase64: string;
  fields: PlacedField[];
  onFieldsChange: (fields: PlacedField[]) => void;
  signerName: string;
  onSignerNameChange?: (name: string) => void;
  signatureDataUrl?: string | null;
  onSignatureChange?: (dataUrl: string | null) => void;
  initialsDataUrl?: string | null;
  onInitialsChange?: (dataUrl: string | null) => void;
  signatureMethod?: 'DRAW' | 'TYPE';
  onSignatureMethodChange?: (method: 'DRAW' | 'TYPE') => void;
  defaultPlacementPage?: number;
  placement?: SignaturePlacement;
  onPlacementChange?: (placement: SignaturePlacement) => void;
}

export function SignaturePlacementViewer({
  pdfBase64,
  fields,
  onFieldsChange,
  signerName,
  onSignerNameChange,
  signatureDataUrl,
  onSignatureChange,
  initialsDataUrl,
  onInitialsChange,
  signatureMethod = 'DRAW',
  onSignatureMethodChange,
  defaultPlacementPage,
  placement,
  onPlacementChange,
}: SignaturePlacementViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const trayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(defaultPlacementPage || placement?.page || 1);
  const [scale, setScale] = useState<number>(1.1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  // Active in-situ tray/popover state
  const [activeTrayField, setActiveTrayField] = useState<PlacedField | null>(null);
  const [trayMethod, setTrayMethod] = useState<'DRAW' | 'TYPE'>(signatureMethod);
  const [traySignerName, setTraySignerName] = useState<string>(signerName);
  const [trayInitials, setTrayInitials] = useState<string>('');
  const [trayTextInput, setTrayTextInput] = useState<string>('');
  const [hasDrawnStroke, setHasDrawnStroke] = useState<boolean>(false);
  const [isDrawingTray, setIsDrawingTray] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);

  // Responsive mobile viewport tracking
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync signerName into tray if changed from outside
  useEffect(() => {
    if (signerName) {
      setTraySignerName(signerName);
    }
  }, [signerName]);

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

        // Determine starting page: first signature field page, or defaultPlacementPage, or last page
        let targetPage = 1;
        const firstSigField = fields.find((f) => f.type === 'SIGNATURE');
        if (firstSigField && firstSigField.page > 0 && firstSigField.page <= doc.numPages) {
          targetPage = firstSigField.page;
        } else if (defaultPlacementPage && defaultPlacementPage > 0 && defaultPlacementPage <= doc.numPages) {
          targetPage = defaultPlacementPage;
        } else if (placement?.page && placement.page > 0 && placement.page <= doc.numPages) {
          targetPage = placement.page;
        } else {
          targetPage = doc.numPages;
        }

        setCurrentPage(targetPage);
        setIsLoading(false);
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error('PDF load error:', err);
        setError('Failed to load document preview.');
        setIsLoading(false);
      }
    }

    if (pdfBase64) {
      loadPdf();
    }

    return () => {
      isCancelled = true;
    };
  }, [pdfBase64, defaultPlacementPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render current PDF page
  useEffect(() => {
    let isCancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentRenderTask: any = null;

    async function renderPage() {
      if (!pdfDocRef.current || !canvasRef.current) return;

      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        currentRenderTask = page.render(renderContext);
        await currentRenderTask.promise;
      } catch (e: unknown) {
        // Suppress benign RenderingCancelledException
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
  }, [currentPage, scale]);

  // Setup drawing tray canvas
  const setupTrayCanvas = useCallback(() => {
    const canvas = trayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = (rect.width || 360) * dpr;
    canvas.height = (rect.height || 160) * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#000000';
    }
  }, []);

  useEffect(() => {
    if (activeTrayField && (activeTrayField.type === 'SIGNATURE' || activeTrayField.type === 'INITIALS') && trayMethod === 'DRAW') {
      const timer = setTimeout(() => {
        setupTrayCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTrayField, trayMethod, setupTrayCanvas]);

  // Open in-situ tray for a specific target field
  const handleOpenTray = (field: PlacedField) => {
    setActiveTrayField(field);
    setTrayMethod(signatureMethod);
    setHasDrawnStroke(false);
    isDrawingRef.current = false;
    lastPointRef.current = null;

    if (field.type === 'INITIALS') {
      const derived = signerName
        ? signerName.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').toUpperCase() || 'JD'
        : 'JD';
      const initialVal = (field.value && !field.value.startsWith('data:image')) ? field.value : derived;
      setTrayInitials(initialVal);
    } else if (field.type === 'TEXT') {
      setTrayTextInput(field.value || '');
    } else if (field.type === 'DATE') {
      // Auto-populate date on single tap
      const today = new Date().toISOString().split('T')[0];
      const updated = fields.map((f) => (f.id === field.id ? { ...f, value: today } : f));
      onFieldsChange(updated);
      setActiveTrayField(null);
      return;
    }

    // Smoothly scroll container to bring the active target field into view
    if (containerRef.current) {
      const topPx = Math.round((pageDimensions.height - field.y - field.height) * scale);
      containerRef.current.scrollTo({
        top: Math.max(0, topPx - 80),
        behavior: 'smooth',
      });
    }
  };

  const handleCloseTray = () => {
    setActiveTrayField(null);
    setHasDrawnStroke(false);
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  // Pointer event handlers for drawing in tray
  const getTrayCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = trayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleTrayPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Fallback
    }

    isDrawingRef.current = true;
    setIsDrawingTray(true);
    setHasDrawnStroke(true);
    const coords = getTrayCanvasCoords(e);
    lastPointRef.current = coords;

    const canvas = trayCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 1.25, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    }
  };

  const handleTrayPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = trayCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !lastPointRef.current) return;

    const coords = getTrayCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
    if (!hasDrawnStroke) {
      setHasDrawnStroke(true);
    }
  };

  const handleTrayPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    isDrawingRef.current = false;
    setIsDrawingTray(false);
    lastPointRef.current = null;
  };

  const handleClearTrayCanvas = () => {
    const canvas = trayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawnStroke(false);
  };

  // Generate calligraphy PNG data URL
  const generateTypedDataUrl = (text: string, isInitials: boolean): string | null => {
    if (!text.trim()) return null;
    const offscreen = document.createElement('canvas');
    offscreen.width = isInitials ? 300 : 600;
    offscreen.height = 180;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    ctx.font = isInitials
      ? 'bold italic 64px "Brush Script MT", "Segoe Script", "Dancing Script", cursive'
      : 'italic 54px "Brush Script MT", "Segoe Script", "Dancing Script", cursive';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.trim(), offscreen.width / 2, offscreen.height / 2);

    return offscreen.toDataURL('image/png');
  };

  // Apply mark to field in-place
  const handleApplyTrayMark = () => {
    if (!activeTrayField) return;

    let appliedDataUrl: string | null = null;
    const isInitials = activeTrayField.type === 'INITIALS';

    if (activeTrayField.type === 'SIGNATURE' || activeTrayField.type === 'INITIALS') {
      if (trayMethod === 'DRAW') {
        const canvas = trayCanvasRef.current;
        if (canvas && hasDrawnStroke) {
          appliedDataUrl = canvas.toDataURL('image/png');
        } else if (isInitials && initialsDataUrl) {
          appliedDataUrl = initialsDataUrl;
        } else if (!isInitials && signatureDataUrl) {
          appliedDataUrl = signatureDataUrl;
        }
      } else {
        const textToUse = isInitials
          ? (trayInitials.trim() || 'IN')
          : (traySignerName.trim() || 'Signature');
        appliedDataUrl = generateTypedDataUrl(textToUse, isInitials);
      }

      if (!appliedDataUrl) {
        return; // Don't apply empty mark
      }

      const today = new Date().toISOString().split('T')[0];

      // Update all fields: set mark on target field and auto-populate all DATE fields upon signing
      const updatedFields = fields.map((f) => {
        if (f.id === activeTrayField.id) {
          return { ...f, value: appliedDataUrl || undefined };
        }
        // Auto-populate date fields upon signing
        if (f.type === 'DATE' && !f.value) {
          return { ...f, value: today };
        }
        return f;
      });

      onFieldsChange(updatedFields);

      // Notify parent callbacks
      if (activeTrayField.type === 'SIGNATURE') {
        onSignatureChange?.(appliedDataUrl);
        onSignatureMethodChange?.(trayMethod);
        if (traySignerName && onSignerNameChange) {
          onSignerNameChange(traySignerName);
        }
        if (placement && onPlacementChange) {
          onPlacementChange({
            ...placement,
            page: activeTrayField.page,
            signatureX: activeTrayField.x,
            signatureY: activeTrayField.y,
            dateX: activeTrayField.x,
            dateY: Math.max(activeTrayField.y - 30, 20),
          });
        }
      } else if (activeTrayField.type === 'INITIALS') {
        onInitialsChange?.(appliedDataUrl);
      }
    } else if (activeTrayField.type === 'TEXT') {
      const updatedFields = fields.map((f) =>
        f.id === activeTrayField.id ? { ...f, value: trayTextInput.trim() } : f
      );
      onFieldsChange(updatedFields);
    }

    handleCloseTray();
  };

  // Jump to next field
  const handleJumpToNextField = () => {
    if (!fields || fields.length === 0) return;
    const unsignedIdx = fields.findIndex((f) => !f.value);
    const targetIdx = unsignedIdx >= 0 ? unsignedIdx : 0;
    const target = fields[targetIdx];
    if (target) {
      if (target.page !== currentPage) {
        setCurrentPage(target.page);
      }
      handleOpenTray(target);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
      handleCloseTray();
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage((p) => p + 1);
      handleCloseTray();
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.6));
  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      setScale(Math.max(0.7, containerWidth / 612));
    }
  };

  // Calculate tethered style for tray in desktop view
  const getTetheredTrayStyle = (): React.CSSProperties => {
    if (!activeTrayField || isMobile) {
      return { touchAction: 'none' };
    }
    const leftPx = Math.max(
      12,
      Math.min(
        Math.round(activeTrayField.x * scale) + Math.round((activeTrayField.width * scale) / 2) - 210,
        Math.round(pageDimensions.width * scale) - 432
      )
    );
    const topPx = Math.round((pageDimensions.height - activeTrayField.y - activeTrayField.height) * scale);
    const heightPx = Math.round(activeTrayField.height * scale);
    const preferredTop =
      topPx + heightPx + 420 > pageDimensions.height * scale
        ? Math.max(12, topPx - 410)
        : topPx + heightPx + 12;

    return {
      top: `${preferredTop}px`,
      left: `${leftPx}px`,
      touchAction: 'none',
    };
  };

  // Filter fields on current page
  const pageFields = fields.filter((f) => f.page === currentPage);
  const totalCompleted = fields.filter((f) => Boolean(f.value)).length;
  const totalRequired = fields.filter((f) => f.required !== false).length;

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-100 border border-neutral-300 overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between p-3 bg-white border-b border-neutral-200 text-xs gap-2">
        {/* Page Navigation */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoading}
            aria-label="Previous page"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
          </Button>

          <span className="font-semibold text-neutral-800">
            Page {currentPage} of {numPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isLoading}
            aria-label="Next page"
          >
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Guided Signing Indicator & Zoom Controls */}
        <div className="flex items-center space-x-2">
          {fields.length > 0 && (
            <button
              type="button"
              onClick={handleJumpToNextField}
              className="px-2.5 py-1 text-xs border border-black bg-black text-white hover:bg-neutral-800 font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>
                {totalCompleted === fields.length
                  ? 'All Fields Signed ✓'
                  : `Next Field (${totalCompleted}/${fields.length}) →`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleZoomOut}
            className="px-2 py-1 border border-neutral-300 hover:border-black font-mono font-medium focus-visible:outline-black cursor-pointer"
            aria-label="Zoom out"
          >
            -
          </button>
          <span className="font-mono text-neutral-600 text-xs">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="px-2 py-1 border border-neutral-300 hover:border-black font-mono font-medium focus-visible:outline-black cursor-pointer"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleFitWidth}
            className="px-2 py-1 border border-neutral-300 hover:border-black font-medium focus-visible:outline-black cursor-pointer"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Sub-toolbar Guidance Banner */}
      <div className="flex-shrink-0 bg-neutral-50 px-4 py-2 border-b border-neutral-200 flex items-center justify-between text-[11px] text-neutral-700">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-black inline-block" />
          <span className="font-semibold text-black">
            In-Situ Document Signing: Tap any highlighted field to apply your electronic signature or date.
          </span>
        </div>
        <div className="font-mono text-neutral-600 hidden sm:block">
          {totalCompleted} of {totalRequired || fields.length} required fields completed
        </div>
      </div>

      {/* Main Document Viewer with In-Situ Tap-to-Ink Anchors */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto p-4 sm:p-6"
        tabIndex={0}
        aria-label="Contract interactive document signing view"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-full space-y-3">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-neutral-600 font-medium">Loading document for signing...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center min-h-full">
            <div className="text-center p-6 bg-white border border-black max-w-sm">
              <p className="text-sm font-semibold text-black">{error}</p>
            </div>
          </div>
        ) : (
          <div className="min-w-full min-h-full flex items-start justify-center">
            {/* Page Container */}
            <div
              ref={pageContainerRef}
              className="relative inline-block bg-white shadow-lg border border-neutral-300 flex-shrink-0 select-none"
            >
              <canvas ref={canvasRef} className="block pointer-events-none" />

              {/* Render High-Visibility In-Situ Anchors for fields on this page */}
              {pageFields.map((field) => {
                const leftPx = Math.round(field.x * scale);
                const topPx = Math.round((pageDimensions.height - field.y - field.height) * scale);
                const widthPx = Math.round(field.width * scale);
                const heightPx = Math.round(field.height * scale);
                const hasValue = Boolean(field.value);
                const isTrayActive = activeTrayField?.id === field.id;

                return (
                  <div
                    key={field.id}
                    onClick={() => handleOpenTray(field)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${field.label || field.type}: ${hasValue ? 'Signed' : 'Tap to sign'}`}
                    style={{
                      position: 'absolute',
                      left: `${leftPx}px`,
                      top: `${topPx}px`,
                      width: `${widthPx}px`,
                      height: `${heightPx}px`,
                      touchAction: 'manipulation',
                    }}
                    className={`cursor-pointer transition-all duration-150 ${
                      hasValue
                        ? 'border-2 border-black bg-white/95 shadow-sm hover:ring-2 hover:ring-black'
                        : isTrayActive
                        ? 'border-2 border-black bg-white ring-2 ring-black shadow-xl z-30'
                        : 'border-2 border-dashed border-black bg-white/90 hover:bg-neutral-50 shadow-md hover:border-solid z-20'
                    }`}
                  >
                    {/* Header Anchor Tab Badge */}
                    <div
                      className={`absolute -top-6 left-0 text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase flex items-center gap-1 shadow-sm transition-colors ${
                        hasValue
                          ? 'bg-black text-white'
                          : 'bg-black text-white ring-1 ring-black'
                      }`}
                    >
                      <span>
                        {hasValue ? '✓' : '✍'}{' '}
                        {field.label || (field.type === 'SIGNATURE' ? 'Signature' : field.type === 'INITIALS' ? 'Initials' : field.type)}
                      </span>
                      {hasValue && (
                        <span className="text-[8px] bg-neutral-800 text-neutral-300 px-1 py-0.2">
                          DONE
                        </span>
                      )}
                    </div>

                    {/* Field Content Bounding Box */}
                    <div className="w-full h-full p-1 flex items-center justify-center overflow-hidden pointer-events-none">
                      {hasValue ? (
                        field.type === 'SIGNATURE' || (field.type === 'INITIALS' && field.value?.startsWith('data:image')) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={field.value}
                            alt="Applied mark"
                            className="max-h-full max-w-full object-contain select-none"
                          />
                        ) : field.type === 'DATE' ? (
                          <span className="text-xs sm:text-sm font-mono font-bold text-black truncate">
                            {field.value}
                          </span>
                        ) : field.type === 'INITIALS' ? (
                          <span className="text-sm font-mono font-bold text-black tracking-widest">
                            {field.value}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-900 font-medium truncate">
                            {field.value}
                          </span>
                        )
                      ) : (
                        /* Unsigned Tap-to-Ink Prompt */
                        <div className="flex flex-col items-center justify-center text-center p-0.5">
                          <span className="text-[10px] sm:text-[11px] font-bold text-black uppercase tracking-wider flex items-center gap-1">
                            <span>✍</span>
                            <span>
                              {field.type === 'SIGNATURE'
                                ? 'Tap to Sign'
                                : field.type === 'INITIALS'
                                ? 'Tap to Initial'
                                : field.type === 'DATE'
                                ? 'Tap for Date'
                                : 'Tap to Fill'}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* In-Situ Ergonomic Drawing Tray / Popover tethered to active target field */}
              {activeTrayField && (
                <>
                  {/* Backdrop for mobile & click-outside protection */}
                  <div
                    className="fixed inset-0 bg-black/40 z-40 sm:hidden"
                    onClick={handleCloseTray}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    aria-hidden="true"
                  />

                  {/* Tray Container (Responsive: Tethered popover on desktop, bottom sheet on mobile) */}
                  <div
                    role="dialog"
                    aria-label={`Complete ${activeTrayField.label || activeTrayField.type}`}
                    onTouchMove={(e) => e.stopPropagation()}
                    style={getTetheredTrayStyle()}
                    className="fixed sm:absolute z-50 bottom-0 inset-x-0 sm:bottom-auto sm:inset-x-auto w-full sm:w-[420px] bg-white border-t-2 sm:border-2 border-black shadow-2xl p-4 sm:p-5 text-black"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-3 mb-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                          <span>✍</span>
                          <span>
                            {activeTrayField.type === 'SIGNATURE'
                              ? 'Apply Signature'
                              : activeTrayField.type === 'INITIALS'
                              ? 'Apply Initials'
                              : activeTrayField.type === 'TEXT'
                              ? 'Enter Information'
                              : 'Select Date'}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Target line on Page {activeTrayField.page}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCloseTray}
                        className="text-neutral-500 hover:text-black font-mono font-bold text-sm px-1.5 py-0.5 border border-transparent hover:border-black cursor-pointer"
                        aria-label="Close drawing tray"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content for SIGNATURE & INITIALS */}
                    {(activeTrayField.type === 'SIGNATURE' || activeTrayField.type === 'INITIALS') && (
                      <div className="space-y-3">
                        {/* Legal Signer Name or Initials input */}
                        {activeTrayField.type === 'INITIALS' ? (
                          <div>
                            <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                              Signer Initials
                            </label>
                            <input
                              type="text"
                              value={trayInitials}
                              maxLength={6}
                              onChange={(e) => setTrayInitials(e.target.value.toUpperCase())}
                              placeholder="e.g. JD"
                              className="w-full text-xs px-2.5 py-1.5 border border-black focus:ring-1 focus:ring-black outline-none font-mono font-bold tracking-widest uppercase"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                              Signer Legal Full Name
                            </label>
                            <input
                              type="text"
                              value={traySignerName}
                              onChange={(e) => setTraySignerName(e.target.value)}
                              placeholder="Enter your legal full name"
                              className="w-full text-xs px-2.5 py-1.5 border border-black focus:ring-1 focus:ring-black outline-none font-medium"
                            />
                          </div>
                        )}

                        {/* Drawing / Typing Tab Switcher */}
                        <div className="flex border-b border-neutral-300">
                          <button
                            type="button"
                            onClick={() => setTrayMethod('DRAW')}
                            className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider cursor-pointer border-b-2 transition-colors ${
                              trayMethod === 'DRAW'
                                ? 'border-black text-black'
                                : 'border-transparent text-neutral-500 hover:text-black'
                            }`}
                          >
                            Draw Ink
                          </button>
                          <button
                            type="button"
                            onClick={() => setTrayMethod('TYPE')}
                            className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider cursor-pointer border-b-2 transition-colors ${
                              trayMethod === 'TYPE'
                                ? 'border-black text-black'
                                : 'border-transparent text-neutral-500 hover:text-black'
                            }`}
                          >
                            Type Calligraphy
                          </button>
                        </div>

                        {/* Method A: Smooth Pointer Events Drawing Canvas */}
                        {trayMethod === 'DRAW' ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[11px] text-neutral-500">
                              <span>Draw smoothly with finger, stylus, or mouse</span>
                              {hasDrawnStroke && (
                                <button
                                  type="button"
                                  onClick={handleClearTrayCanvas}
                                  className="text-black font-semibold hover:underline cursor-pointer"
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            <div className="relative w-full h-36 border border-black bg-white touch-none cursor-crosshair">
                              <canvas
                                ref={trayCanvasRef}
                                className="w-full h-full block"
                                style={{ touchAction: 'none' }}
                                onPointerDown={handleTrayPointerDown}
                                onPointerMove={handleTrayPointerMove}
                                onPointerUp={handleTrayPointerUp}
                                onPointerCancel={handleTrayPointerUp}
                              />
                              {!hasDrawnStroke && !isDrawingTray && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-neutral-400 text-xs select-none">
                                  {activeTrayField.type === 'INITIALS' ? 'Initial here' : 'Sign here'}
                                </div>
                              )}
                              <div className="absolute bottom-4 left-4 right-4 border-b border-dashed border-neutral-300 pointer-events-none" />
                            </div>
                          </div>
                        ) : (
                          /* Method B: Typed Calligraphy Representation */
                          <div className="space-y-1.5">
                            <div className="text-[11px] text-neutral-500">
                              Calligraphic electronic mark preview
                            </div>
                            <div className="h-36 border border-black bg-white flex items-center justify-center p-3 relative">
                              <div className="font-signature text-3xl sm:text-4xl text-black italic text-center select-none">
                                {activeTrayField.type === 'INITIALS'
                                  ? (trayInitials.trim() || 'IN')
                                  : (traySignerName.trim() || 'Your Signature')}
                              </div>
                              <div className="absolute bottom-4 left-4 right-4 border-b border-dashed border-neutral-300 pointer-events-none" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content for TEXT fields */}
                    {activeTrayField.type === 'TEXT' && (
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-neutral-800 block">
                          {activeTrayField.label || 'Field Value'}
                        </label>
                        <input
                          type="text"
                          value={trayTextInput}
                          onChange={(e) => setTrayTextInput(e.target.value)}
                          placeholder="Enter value"
                          className="w-full text-xs px-3 py-2 border border-black focus:ring-1 focus:ring-black outline-none font-medium"
                          autoFocus
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-2 pt-3 mt-3 border-t border-neutral-200">
                      <Button variant="outline" size="sm" onClick={handleCloseTray}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleApplyTrayMark}>
                        Apply to Document ✓
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
