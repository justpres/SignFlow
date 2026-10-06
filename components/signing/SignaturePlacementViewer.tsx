'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { SignaturePlacement } from '@/lib/types';

interface SignaturePlacementViewerProps {
  pdfBase64: string;
  signatureDataUrl: string;
  signerName: string;
  placement: SignaturePlacement;
  onPlacementChange: (placement: SignaturePlacement) => void;
  defaultPlacementPage?: number;
}

const SIG_BOX_WIDTH_PT = 170;
const SIG_BOX_HEIGHT_PT = 50;

export function SignaturePlacementViewer({
  pdfBase64,
  signatureDataUrl,
  signerName,
  placement,
  onPlacementChange,
  defaultPlacementPage,
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
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialSigX: number;
    initialSigY: number;
  }>({ pointerX: 0, pointerY: 0, initialSigX: 0, initialSigY: 0 });
  const didDragRef = useRef<boolean>(false);

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

        const rawBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
        const loadingTask = pdfjsLib.getDocument({ data: rawBytes });
        const doc = await loadingTask.promise;

        if (isCancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);

        // Determine target starting page
        const initialTargetPage = defaultPlacementPage && defaultPlacementPage > 0 && defaultPlacementPage <= doc.numPages
          ? defaultPlacementPage
          : placement.page && placement.page > 0 && placement.page <= doc.numPages
          ? placement.page
          : doc.numPages; // Default to last page where contracts are typically signed

        setCurrentPage(initialTargetPage);
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
  }, [pdfBase64, defaultPlacementPage, placement.page]);

  // Render current page onto canvas
  useEffect(() => {
    let isCancelled = false;

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

        await page.render(renderContext).promise;
      } catch (e) {
        if (!isCancelled) {
          console.error('Page render error:', e);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [currentPage, scale]);

  const scaleFactor = scale;

  // Screen CSS dimensions & positions derived from PDF point coordinates
  const badgeWidthPx = SIG_BOX_WIDTH_PT * scaleFactor;
  const sigBoxHeightPx = SIG_BOX_HEIGHT_PT * scaleFactor;
  const badgeLeftPx = placement.signatureX * scaleFactor;
  const badgeTopPx = (pageDimensions.height - (placement.signatureY + SIG_BOX_HEIGHT_PT)) * scaleFactor;

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
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaScreenX = curX - dragStartRef.current.pointerX;
      const deltaScreenY = curY - dragStartRef.current.pointerY;

      if (Math.abs(deltaScreenX) > 3 || Math.abs(deltaScreenY) > 3) {
        didDragRef.current = true;
      }

      // Convert screen delta to PDF points
      // In PDF, Y=0 is bottom and grows upwards, whereas screen Y grows downwards
      const deltaPdfX = deltaScreenX / scaleFactor;
      const deltaPdfY = -(deltaScreenY / scaleFactor);

      const targetSigX = Math.round(dragStartRef.current.initialSigX + deltaPdfX);
      const targetSigY = Math.round(dragStartRef.current.initialSigY + deltaPdfY);

      const clampedSigX = Math.max(10, Math.min(targetSigX, Math.round(pageDimensions.width - SIG_BOX_WIDTH_PT - 10)));
      const clampedSigY = Math.max(40, Math.min(targetSigY, Math.round(pageDimensions.height - SIG_BOX_HEIGHT_PT - 20)));

      onPlacementChange({
        page: currentPage,
        signatureX: clampedSigX,
        signatureY: clampedSigY,
        nameX: clampedSigX,
        nameY: Math.max(clampedSigY - 18, 20),
        dateX: clampedSigX,
        dateY: Math.max(clampedSigY - 30, 10),
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      setIsDragging(false);

      setTimeout(() => {
        didDragRef.current = false;
      }, 100);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  };

  // Tap or Click anywhere on page to place
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didDragRef.current || !pageContainerRef.current) return;

    const rect = pageContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Center signature badge over click point
    const targetLeftPx = clickX - badgeWidthPx / 2;
    const targetTopPx = clickY - sigBoxHeightPx / 2;

    const newSigX = Math.round(targetLeftPx / scaleFactor);
    const newSigY = Math.round(pageDimensions.height - (targetTopPx / scaleFactor) - SIG_BOX_HEIGHT_PT);

    const clampedSigX = Math.max(10, Math.min(newSigX, Math.round(pageDimensions.width - SIG_BOX_WIDTH_PT - 10)));
    const clampedSigY = Math.max(40, Math.min(newSigY, Math.round(pageDimensions.height - SIG_BOX_HEIGHT_PT - 20)));

    onPlacementChange({
      page: currentPage,
      signatureX: clampedSigX,
      signatureY: clampedSigY,
      nameX: clampedSigX,
      nameY: Math.max(clampedSigY - 18, 20),
      dateX: clampedSigX,
      dateY: Math.max(clampedSigY - 30, 10),
    });
  };

  // Keyboard navigation for precision fine-tuning
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

    const clampedSigX = Math.max(10, Math.min(newX, Math.round(pageDimensions.width - SIG_BOX_WIDTH_PT - 10)));
    const clampedSigY = Math.max(40, Math.min(newY, Math.round(pageDimensions.height - SIG_BOX_HEIGHT_PT - 20)));

    onPlacementChange({
      page: currentPage,
      signatureX: clampedSigX,
      signatureY: clampedSigY,
      nameX: clampedSigX,
      nameY: Math.max(clampedSigY - 18, 20),
      dateX: clampedSigX,
      dateY: Math.max(clampedSigY - 30, 10),
    });
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
            title="Reset signature to default signature blank location"
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
            {isCurrentPlacementPage ? (
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
              className="relative inline-block bg-white shadow-md border border-neutral-300 flex-shrink-0 cursor-crosshair select-none"
            >
              <canvas ref={canvasRef} className="block pointer-events-none" />

              {/* Draggable & Tappable Signature Badge */}
              {isCurrentPlacementPage && (
                <div
                  ref={badgeRef}
                  tabIndex={0}
                  role="region"
                  aria-label="Signature badge. Drag or use arrow keys to position."
                  onKeyDown={handleKeyDown}
                  onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY, e)}
                  onTouchStart={(e) => handlePointerDown(e.touches[0].clientX, e.touches[0].clientY, e)}
                  style={{
                    position: 'absolute',
                    left: `${badgeLeftPx}px`,
                    top: `${badgeTopPx}px`,
                    width: `${badgeWidthPx}px`,
                    touchAction: 'none',
                  }}
                  className={`border-2 border-dashed border-black bg-white/95 p-1.5 select-none transition-shadow ${
                    isDragging
                      ? 'shadow-2xl ring-2 ring-black cursor-grabbing'
                      : 'shadow-md hover:shadow-lg cursor-grab focus:outline-none focus:ring-2 focus:ring-black'
                  }`}
                >
                  {/* Drag Handle & Info Header */}
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-neutral-300 text-[10px] font-mono text-neutral-700 pointer-events-none">
                    <span className="flex items-center space-x-1 font-bold text-black">
                      <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                      <span>Drag to position</span>
                    </span>
                    <span className="text-[9px] bg-neutral-100 px-1 py-0.5 border border-neutral-300 font-semibold text-black">
                      P.{placement.page} ({placement.signatureX},{placement.signatureY})
                    </span>
                  </div>

                  {/* Signature Image Box */}
                  <div
                    className="flex items-center justify-center bg-white border border-neutral-200 overflow-hidden pointer-events-none"
                    style={{ height: `${sigBoxHeightPx}px` }}
                  >
                    {signatureDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={signatureDataUrl}
                        alt="Signature preview"
                        className="max-h-full max-w-full object-contain pointer-events-none"
                      />
                    ) : (
                      <span className="text-[10px] text-neutral-400">Signature Blank</span>
                    )}
                  </div>

                  {/* Printed Full Legal Name */}
                  <div
                    className="mt-1 font-bold text-black truncate pointer-events-none tracking-tight"
                    style={{
                      fontSize: `${Math.max(9, Math.round(11 * scaleFactor))}px`,
                      lineHeight: 1.15,
                    }}
                  >
                    {signerName}
                  </div>

                  {/* Digital Stamp Line */}
                  <div
                    className="text-neutral-500 font-mono truncate pointer-events-none"
                    style={{
                      fontSize: `${Math.max(7, Math.round(8 * scaleFactor))}px`,
                      lineHeight: 1.15,
                    }}
                  >
                    Digitally signed &bull; SignFlow Verified
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
