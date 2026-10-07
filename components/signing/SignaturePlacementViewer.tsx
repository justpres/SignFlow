'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { SignaturePlacement, PlacedField } from '@/lib/types';

interface SignaturePlacementViewerProps {
  pdfBase64: string;
  signatureDataUrl: string;
  signerName: string;
  placement: SignaturePlacement;
  onPlacementChange: (placement: SignaturePlacement) => void;
  defaultPlacementPage?: number;
  fields?: PlacedField[];
  initialsDataUrl?: string;
}

const SIG_BOX_WIDTH_PT = 170;
const SIG_BOX_HEIGHT_PT = 50;

export function SignaturePlacementViewer({
  pdfBase64,
  signatureDataUrl,
  signerName: _signerName,
  placement,
  onPlacementChange,
  defaultPlacementPage,
  fields,
  initialsDataUrl,
}: SignaturePlacementViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(placement.page || 1);
  const [scale, setScale] = useState<number>(1.1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [focusedFieldIndex, setFocusedFieldIndex] = useState<number>(0);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  const handleNextField = () => {
    if (!fields || fields.length === 0) return;
    const nextIdx = (focusedFieldIndex + 1) % fields.length;
    setFocusedFieldIndex(nextIdx);
    const target = fields[nextIdx];
    if (target.page !== currentPage) {
      setCurrentPage(target.page);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialSigX: number;
    initialSigY: number;
  }>({ pointerX: 0, pointerY: 0, initialSigX: 0, initialSigY: 0 });
  const didDragRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Clamp helper ensuring signature box stays strictly within page bounds
  const clampPlacement = useCallback((targetX: number, targetY: number, pageNum: number): SignaturePlacement => {
    const minTopMarginPt = Math.ceil(32 / scale);
    const maxSigY = Math.round(pageDimensions.height - SIG_BOX_HEIGHT_PT - minTopMarginPt);

    const clampedX = Math.max(10, Math.min(targetX, Math.round(pageDimensions.width - SIG_BOX_WIDTH_PT - 10)));
    const clampedY = Math.max(40, Math.min(targetY, Math.max(40, maxSigY)));

    return {
      page: pageNum,
      signatureX: clampedX,
      signatureY: clampedY,
      nameX: clampedX,
      nameY: Math.max(clampedY - 18, 20),
      dateX: clampedX,
      dateY: Math.max(clampedY - 30, 10),
    };
  }, [pageDimensions.height, pageDimensions.width, scale]);

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

        // Determine target starting page:
        // Priority 1: Admin pre-configured defaultPlacementPage
        // Priority 2: Pre-selected placement page (if explicit admin choice was provided)
        // Priority 3: Last page (doc.numPages) where signature blanks typically reside
        let targetPage = doc.numPages;
        if (defaultPlacementPage && defaultPlacementPage > 0 && defaultPlacementPage <= doc.numPages) {
          targetPage = defaultPlacementPage;
        } else if (placement.page && placement.page > 0 && placement.page <= doc.numPages && defaultPlacementPage !== undefined) {
          targetPage = placement.page;
        }

        setCurrentPage(targetPage);
        if (placement.page !== targetPage) {
          onPlacementChange({
            ...placement,
            page: targetPage,
          });
        }
        setIsLoading(false);
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error('PDF load error:', err);
        setError('Failed to load document for signature placement.');
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

  // Render current page onto canvas with concurrent task cancellation protection
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
        const pdfW = unscaledViewport.width;
        const pdfH = unscaledViewport.height;
        setPageDimensions({ width: pdfW, height: pdfH });

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
        // Suppress benign RenderingCancelledException when page/zoom switches
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

  const scaleFactor = scale;

  // Exact screen dimensions & coordinates for the 170x50pt signature box:
  const sigBoxWidthPx = SIG_BOX_WIDTH_PT * scaleFactor;
  const sigBoxHeightPx = SIG_BOX_HEIGHT_PT * scaleFactor;
  const sigBoxLeftPx = placement.signatureX * scaleFactor;
  const sigBoxTopPx = (pageDimensions.height - (placement.signatureY + SIG_BOX_HEIGHT_PT)) * scaleFactor;

  // Handle Drag Pointer Events (Mouse & Touch)
  const handlePointerDown = (clientX: number, clientY: number, e: React.SyntheticEvent) => {
    e.stopPropagation();
    dragStartRef.current = {
      pointerX: clientX,
      pointerY: clientY,
      initialSigX: placement.signatureX,
      initialSigY: placement.signatureY,
    };
    didDragRef.current = false;
    setIsDragging(true);

    const onPointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      // Prevent mobile page scroll/pan during signature dragging
      if ('cancelable' in moveEvent && moveEvent.cancelable) {
        moveEvent.preventDefault();
      }

      const curX = 'touches' in moveEvent ? moveEvent.touches[0]?.clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0]?.clientY : moveEvent.clientY;
      if (curX === undefined || curY === undefined) return;

      const deltaScreenX = curX - dragStartRef.current.pointerX;
      const deltaScreenY = curY - dragStartRef.current.pointerY;

      if (Math.abs(deltaScreenX) > 3 || Math.abs(deltaScreenY) > 3) {
        didDragRef.current = true;
      }

      // Convert screen delta to PDF points (Y=0 is bottom in PDF)
      const deltaPdfX = deltaScreenX / scaleFactor;
      const deltaPdfY = -(deltaScreenY / scaleFactor);

      const targetSigX = Math.round(dragStartRef.current.initialSigX + deltaPdfX);
      const targetSigY = Math.round(dragStartRef.current.initialSigY + deltaPdfY);

      onPlacementChange(clampPlacement(targetSigX, targetSigY, currentPage));
    };

    const onPointerUp = () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('touchcancel', onPointerUp);
      setIsDragging(false);

      setTimeout(() => {
        didDragRef.current = false;
      }, 100);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('touchcancel', onPointerUp);
  };

  // Tap or Click anywhere on page to place
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didDragRef.current || !pageContainerRef.current) return;

    const rect = pageContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Center signature box over clicked point
    const targetLeftPx = clickX - sigBoxWidthPx / 2;
    const targetTopPx = clickY - sigBoxHeightPx / 2;

    const newSigX = Math.round(targetLeftPx / scaleFactor);
    const newSigY = Math.round(pageDimensions.height - (targetTopPx / scaleFactor) - SIG_BOX_HEIGHT_PT);

    onPlacementChange(clampPlacement(newSigX, newSigY, currentPage));
  };

  // Touch tap handling on mobile devices
  const handlePageTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }
  };

  const handlePageTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartPosRef.current || didDragRef.current || !pageContainerRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    const dt = Date.now() - touchStartPosRef.current.time;

    // Clean tap: minimal movement and short duration
    if (dx < 10 && dy < 10 && dt < 400) {
      const rect = pageContainerRef.current.getBoundingClientRect();
      const clickX = touch.clientX - rect.left;
      const clickY = touch.clientY - rect.top;

      const targetLeftPx = clickX - sigBoxWidthPx / 2;
      const targetTopPx = clickY - sigBoxHeightPx / 2;

      const newSigX = Math.round(targetLeftPx / scaleFactor);
      const newSigY = Math.round(pageDimensions.height - (targetTopPx / scaleFactor) - SIG_BOX_HEIGHT_PT);

      onPlacementChange(clampPlacement(newSigX, newSigY, currentPage));
    }
    touchStartPosRef.current = null;
  };

  // Keyboard navigation for precision micro-adjustments
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 1 : 5;
    let newX = placement.signatureX;
    let newY = placement.signatureY;

    if (e.key === 'ArrowLeft') {
      newX -= step;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      newX += step;
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      newY += step;
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      newY -= step;
      e.preventDefault();
    } else {
      return;
    }

    onPlacementChange(clampPlacement(newX, newY, currentPage));
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((p) => p + 1);
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.6));
  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      setScale(Math.max(0.7, containerWidth / 600));
    }
  };

  const isCurrentPlacementPage = currentPage === placement.page;

  const handleMoveToCurrentPage = () => {
    onPlacementChange({
      ...placement,
      page: currentPage,
    });
  };

  const handleResetToDefault = () => {
    const targetPage = defaultPlacementPage && defaultPlacementPage > 0 && defaultPlacementPage <= numPages
      ? defaultPlacementPage
      : numPages;
    setCurrentPage(targetPage);
    onPlacementChange({
      page: targetPage,
      signatureX: 70,
      signatureY: 115,
      nameX: 70,
      nameY: 97,
      dateX: 70,
      dateY: 85,
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-100 border border-neutral-300 overflow-hidden">
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

          {!isCurrentPlacementPage && (
            <button
              type="button"
              onClick={handleMoveToCurrentPage}
              className="ml-2 px-2 py-1 text-xs font-semibold bg-neutral-100 hover:bg-black hover:text-white border border-neutral-300 transition-colors cursor-pointer"
            >
              Place on this page
            </button>
          )}
        </div>

        {/* Zoom & Reset Toolbar */}
        <div className="flex items-center space-x-2">
          {fields && fields.length > 0 && (
            <button
              type="button"
              onClick={handleNextField}
              className="px-2.5 py-1 text-xs border border-black bg-black text-white hover:bg-neutral-800 font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer ml-1"
            >
              <span>Next Field ({focusedFieldIndex + 1}/{fields.length})</span>
              <span>→</span>
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
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-2 py-1 text-xs border border-neutral-300 hover:border-black font-medium text-neutral-700 hover:text-black cursor-pointer ml-1"
            title="Reset signature to default location on signature page"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Page indicator & coordinates banner */}
      <div className="flex-shrink-0 bg-neutral-50 px-4 py-2 border-b border-neutral-200 flex items-center justify-between text-[11px] text-neutral-600">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-black inline-block" />
          <span>
            {fields && fields.length > 0 ? (
              <span className="font-semibold text-black">
                Guided Signing: Field {focusedFieldIndex + 1} of {fields.length} ({fields[focusedFieldIndex]?.label || fields[focusedFieldIndex]?.type})
              </span>
            ) : isCurrentPlacementPage ? (
              <span className="font-semibold text-black">
                Signature active on Page {placement.page}
              </span>
            ) : (
              <span>
                Viewing Page {currentPage}. Signature currently on{' '}
                <strong className="text-black">Page {placement.page}</strong>.
              </span>
            )}
          </span>
        </div>
        <div className="font-mono text-neutral-700">
          X: {placement.signatureX} pt &bull; Y: {placement.signatureY} pt
        </div>
      </div>

      {/* Main PDF Canvas & Interactive Draggable Overlay */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto p-4 sm:p-6"
        tabIndex={0}
        aria-label="Contract signature placement view"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-full space-y-3">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-neutral-600 font-medium">Preparing document for placement...</p>
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
              onClick={handlePageClick}
              onTouchStart={handlePageTouchStart}
              onTouchEnd={handlePageTouchEnd}
              className="relative inline-block bg-white shadow-md border border-neutral-300 flex-shrink-0 cursor-crosshair select-none"
            >
              <canvas ref={canvasRef} className="block pointer-events-none" />

              {/* Render Multi-Fields if provided */}
              {fields && fields.length > 0 ? (
                fields
                  .filter((f) => f.page === currentPage)
                  .map((f) => {
                    const isFocused = fields[focusedFieldIndex]?.id === f.id;
                    const leftPx = Math.round(f.x * scale);
                    const topPx = Math.round((pageDimensions.height - f.y - f.height) * scale);
                    const widthPx = Math.round(f.width * scale);
                    const heightPx = Math.round(f.height * scale);

                    return (
                      <div
                        key={f.id}
                        style={{
                          position: 'absolute',
                          left: `${leftPx}px`,
                          top: `${topPx}px`,
                          width: `${widthPx}px`,
                          height: `${heightPx}px`,
                        }}
                        className={`border-2 select-none transition-all ${
                          isFocused
                            ? 'border-black bg-white ring-2 ring-black shadow-xl z-20'
                            : 'border-dashed border-neutral-700 bg-white/95 shadow-md z-10'
                        }`}
                      >
                        {/* Header badge tab */}
                        <div className="absolute -top-6 left-0 bg-black text-white text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase flex items-center gap-1 shadow-sm">
                          <span>{f.label || f.type}</span>
                          {isFocused && (
                            <span className="bg-white text-black px-1 text-[8px] font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        {/* Content inside field */}
                        <div className="w-full h-full p-1 flex items-center justify-center overflow-hidden pointer-events-none">
                          {f.type === 'SIGNATURE' && (
                            signatureDataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={signatureDataUrl}
                                alt="Signature"
                                className="max-h-full max-w-full object-contain select-none"
                              />
                            ) : (
                              <span className="text-[10px] text-neutral-400 font-mono">[ Signature ]</span>
                            )
                          )}
                          {f.type === 'INITIALS' && (
                            initialsDataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={initialsDataUrl}
                                alt="Initials"
                                className="max-h-full max-w-full object-contain select-none"
                              />
                            ) : (
                              <span className="text-[11px] font-bold font-mono text-black">
                                {f.value || _signerName?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'IN'}
                              </span>
                            )
                          )}
                          {f.type === 'DATE' && (
                            <span className="text-[11px] font-mono text-neutral-800">
                              {f.value || new Date().toISOString().split('T')[0]}
                            </span>
                          )}
                          {f.type === 'TEXT' && (
                            <span className="text-[11px] text-neutral-800 font-medium truncate">
                              {f.value || '[ Text Field ]'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
              ) : (
                /* Single signature placement fallback */
                isCurrentPlacementPage && (
                  <div
                    ref={badgeRef}
                    tabIndex={0}
                    role="region"
                    aria-label="Signature badge. Drag or use arrow keys to position."
                    onKeyDown={handleKeyDown}
                    onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY, e)}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      const touch = e.touches[0];
                      if (touch) {
                        handlePointerDown(touch.clientX, touch.clientY, e);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${sigBoxLeftPx}px`,
                      top: `${sigBoxTopPx}px`,
                      width: `${sigBoxWidthPx}px`,
                      touchAction: 'none',
                    }}
                    className={`select-none transition-shadow ${
                      isDragging ? 'cursor-grabbing z-30' : 'cursor-grab z-20 hover:z-30'
                    }`}
                  >
                    <div
                      className={`absolute -top-7 left-0 right-0 h-6 px-2 flex items-center justify-between text-[10px] font-mono border border-black shadow-sm pointer-events-none select-none transition-colors ${
                        isDragging ? 'bg-black text-white ring-1 ring-black' : 'bg-black text-white hover:bg-neutral-800'
                      }`}
                    >
                      <span className="flex items-center space-x-1 font-semibold truncate mr-1">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                        <span className="truncate">Drag to position</span>
                      </span>
                      <span className="text-[9px] bg-neutral-800 text-neutral-200 px-1 py-0.5 border border-neutral-700 font-mono flex-shrink-0">
                        P.{placement.page} ({placement.signatureX},{placement.signatureY})
                      </span>
                    </div>

                    <div
                      style={{ height: `${sigBoxHeightPx}px` }}
                      className={`w-full border-2 border-dashed border-black bg-white/90 flex items-center justify-center p-1 overflow-hidden transition-all ${
                        isDragging ? 'shadow-2xl ring-2 ring-black bg-white' : 'shadow-md hover:shadow-lg'
                      }`}
                    >
                      {signatureDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={signatureDataUrl}
                          alt="Signature preview"
                          className="max-h-full max-w-full object-contain pointer-events-none select-none"
                        />
                      ) : (
                        <span className="text-[10px] text-neutral-400 font-mono">Signature Blank</span>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
