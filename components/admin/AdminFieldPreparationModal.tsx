'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/Icons';

interface AdminFieldPreparationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBase64: string;
  initialPlacement?: {
    page?: number;
    signatureX?: number;
    signatureY?: number;
  };
  onSavePlacement: (placement: { page: number; signatureX: number; signatureY: number }) => void;
  onClearPlacement: () => void;
}

const SIG_BOX_WIDTH_PT = 170;
const SIG_BOX_HEIGHT_PT = 50;

export function AdminFieldPreparationModal({
  isOpen,
  onClose,
  pdfBase64,
  initialPlacement,
  onSavePlacement,
  onClearPlacement,
}: AdminFieldPreparationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(initialPlacement?.page || 1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  const [currentCoords, setCurrentCoords] = useState<{ x: number; y: number; page: number }>({
    x: initialPlacement?.signatureX ?? 70,
    y: initialPlacement?.signatureY ?? 115,
    page: initialPlacement?.page ?? 1,
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
  const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Clamping helper ensuring signature box stays strictly within page bounds
  const clampCoords = useCallback(
    (targetX: number, targetY: number, pageNum: number) => {
      const minTopMarginPt = Math.ceil(32 / scale);
      const maxSigY = Math.round(pageDimensions.height - SIG_BOX_HEIGHT_PT - minTopMarginPt);

      const clampedX = Math.max(10, Math.min(targetX, Math.round(pageDimensions.width - SIG_BOX_WIDTH_PT - 10)));
      const clampedY = Math.max(40, Math.min(targetY, Math.max(40, maxSigY)));

      return {
        page: pageNum,
        x: clampedX,
        y: clampedY,
      };
    },
    [pageDimensions.height, pageDimensions.width, scale]
  );

  // Initialize coordinates when modal opens or initialPlacement changes
  useEffect(() => {
    if (isOpen) {
      const initialPage = initialPlacement?.page || 1;
      const initialX = initialPlacement?.signatureX ?? 70;
      const initialY = initialPlacement?.signatureY ?? 115;
      setCurrentCoords({ x: initialX, y: initialY, page: initialPage });
      setCurrentPage(initialPage);
    }
  }, [isOpen, initialPlacement]);

  // Load PDF Document
  useEffect(() => {
    if (!isOpen || !pdfBase64) return;
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

        const targetPage = initialPlacement?.page && initialPlacement.page <= doc.numPages
          ? initialPlacement.page
          : doc.numPages; // Default to last page where signature blocks typically reside

        setCurrentPage(targetPage);
        setCurrentCoords((prev) => ({ ...prev, page: targetPage }));
        setIsLoading(false);
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error('PDF load error:', err);
        setError('Failed to render PDF document for signature preparation.');
        setIsLoading(false);
      }
    }

    loadPdf();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, pdfBase64, initialPlacement]);

  // Render Current Page onto Canvas
  useEffect(() => {
    if (!pdfDocRef.current || isLoading || !isOpen) return;
    let isCancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderTask: any = null;

    async function renderPage() {
      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        setPageDimensions({
          width: page.view[2] - page.view[0],
          height: page.view[3] - page.view[1],
        });

        renderTask = page.render({
          canvasContext: context,
          viewport,
        });

        await renderTask.promise;
      } catch (err: unknown) {
        if (isCancelled || (err as { name?: string })?.name === 'RenderingCancelledException') {
          return;
        }
        console.error('Canvas render error:', err);
      }
    }

    renderPage();
    return () => {
      isCancelled = true;
      if (renderTask && typeof renderTask.cancel === 'function') {
        try {
          renderTask.cancel();
        } catch {
          // ignore cancellation errors
        }
      }
    };
  }, [currentPage, scale, isLoading, isOpen]);

  // Page Navigation
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setCurrentCoords((prev) => ({ ...prev, page: newPage }));
    }
  };

  const goToNextPage = () => {
    if (currentPage < numPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setCurrentCoords((prev) => ({ ...prev, page: newPage }));
    }
  };

  // Dragging logic
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    didDragRef.current = false;
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialSigX: currentCoords.x,
      initialSigY: currentCoords.y,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    setIsDragging(true);
    didDragRef.current = false;
    dragStartRef.current = {
      pointerX: touch.clientX,
      pointerY: touch.clientY,
      initialSigX: currentCoords.x,
      initialSigY: currentCoords.y,
    };
  };

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;

      const deltaPixelX = clientX - dragStartRef.current.pointerX;
      const deltaPixelY = clientY - dragStartRef.current.pointerY;

      if (Math.abs(deltaPixelX) > 2 || Math.abs(deltaPixelY) > 2) {
        didDragRef.current = true;
      }

      const deltaPtX = Math.round(deltaPixelX / scale);
      const deltaPtY = Math.round(-deltaPixelY / scale);

      const targetX = dragStartRef.current.initialSigX + deltaPtX;
      const targetY = dragStartRef.current.initialSigY + deltaPtY;

      const clamped = clampCoords(targetX, targetY, currentPage);
      setCurrentCoords(clamped);
    },
    [isDragging, scale, clampCoords, currentPage]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    touchStartPosRef.current = null;
  }, []);

  // Global listeners for mouse move and mouse up
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch move & touch end listeners
  useEffect(() => {
    if (!isDragging) return;

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchEnd = () => {
      handleDragEnd();
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Click or Tap anywhere on the page to jump badge to that position
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    if (badgeRef.current && badgeRef.current.contains(e.target as Node)) {
      return;
    }

    if (!pageContainerRef.current) return;
    const rect = pageContainerRef.current.getBoundingClientRect();
    const clickPixelX = e.clientX - rect.left;
    const clickPixelY = e.clientY - rect.top;

    const centeredPixelX = clickPixelX - (SIG_BOX_WIDTH_PT * scale) / 2;
    const centeredPixelY = clickPixelY - (SIG_BOX_HEIGHT_PT * scale) / 2;

    const targetPtX = Math.round(centeredPixelX / scale);
    const targetPtY = Math.round(pageDimensions.height - centeredPixelY / scale - SIG_BOX_HEIGHT_PT);

    const clamped = clampCoords(targetPtX, targetPtY, currentPage);
    setCurrentCoords(clamped);
  };

  // Keyboard navigation for arrow key fine-tuning
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        let nextX = currentCoords.x;
        let nextY = currentCoords.y;

        if (e.key === 'ArrowUp') nextY += step;
        if (e.key === 'ArrowDown') nextY -= step;
        if (e.key === 'ArrowLeft') nextX -= step;
        if (e.key === 'ArrowRight') nextX += step;

        const clamped = clampCoords(nextX, nextY, currentPage);
        setCurrentCoords(clamped);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentCoords, currentPage, clampCoords]);

  if (!isOpen) return null;

  // Convert PDF point coordinates to screen CSS pixels for rendering the draggable badge
  const badgeLeftPx = currentCoords.x * scale;
  const badgeTopPx = (pageDimensions.height - (currentCoords.y + SIG_BOX_HEIGHT_PT)) * scale;
  const badgeWidthPx = SIG_BOX_WIDTH_PT * scale;
  const badgeHeightPx = SIG_BOX_HEIGHT_PT * scale;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white border border-neutral-300 w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-base font-bold text-black tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-black inline-block" />
              Prepare Signature Location (Visual Placement)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Navigate to the target page and click or drag the signature placeholder to position the client&apos;s signature blank.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-black text-xl p-1 font-mono transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="py-2 px-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0 text-xs">
          {/* Page controls */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={currentPage <= 1 || isLoading}
              aria-label="Previous Page"
              className="h-8 px-2"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
            </Button>

            <span className="font-mono text-xs px-2 py-1 bg-white border border-neutral-300">
              Page {currentPage} of {numPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= numPages || isLoading}
              aria-label="Next Page"
              className="h-8 px-2"
            >
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Coordinates readout badge */}
          <div className="hidden sm:flex items-center gap-3 font-mono text-xs text-neutral-600 bg-white border border-neutral-300 px-3 py-1">
            <span>Target: <strong>Page {currentCoords.page}</strong></span>
            <span>|</span>
            <span>X: <strong>{currentCoords.x} pt</strong></span>
            <span>|</span>
            <span>Y: <strong>{currentCoords.y} pt</strong></span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
              disabled={scale <= 0.6 || isLoading}
              className="h-8 px-2 font-mono"
            >
              -
            </Button>
            <span className="font-mono text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
              disabled={scale >= 2.0 || isLoading}
              className="h-8 px-2 font-mono"
            >
              +
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(1.0)}
              className="h-8 px-2 text-[11px]"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* PDF Canvas Viewport */}
        <div
          ref={containerRef}
          className="flex-1 bg-neutral-100 overflow-auto flex items-start justify-center p-4 min-h-0 select-none relative"
        >
          {isLoading && (
            <div className="my-auto flex flex-col items-center justify-center p-8 text-neutral-600">
              <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold">Rendering document page...</p>
            </div>
          )}

          {error && (
            <div className="my-auto p-4 border border-black bg-white text-xs text-black max-w-md">
              <p className="font-bold underline mb-1">Preview Error</p>
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && (
            <div
              ref={pageContainerRef}
              onClick={handlePageClick}
              className="relative shadow-md border border-neutral-300 bg-white cursor-crosshair transition-shadow hover:shadow-lg"
              style={{
                width: pageDimensions.width * scale,
                height: pageDimensions.height * scale,
              }}
            >
              <canvas ref={canvasRef} className="block pointer-events-none" />

              {/* Interactive Draggable Signature Placement Badge */}
              <div
                ref={badgeRef}
                onMouseDown={handleDragStart}
                onTouchStart={handleTouchStart}
                style={{
                  left: `${badgeLeftPx}px`,
                  top: `${badgeTopPx}px`,
                  width: `${badgeWidthPx}px`,
                  height: `${badgeHeightPx}px`,
                }}
                className={`absolute select-none group border-2 border-dashed transition-shadow ${
                  isDragging
                    ? 'border-black bg-neutral-100/90 shadow-2xl cursor-grabbing'
                    : 'border-black bg-white/95 shadow-md hover:shadow-xl cursor-grab'
                }`}
              >
                {/* Drag Handle Tag on top */}
                <div className="absolute -top-6 left-0 bg-black text-white text-[9px] font-bold tracking-wider px-2 py-0.5 uppercase flex items-center gap-1 shadow-sm">
                  <span>Signature Line</span>
                  <span className="text-[8px] opacity-75 font-mono">({currentCoords.x}, {currentCoords.y})</span>
                </div>

                {/* Badge Interior */}
                <div className="w-full h-full p-2 flex flex-col justify-between pointer-events-none">
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 font-medium">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-black rounded-full" />
                      Client Signature Area
                    </span>
                    <span className="text-[9px] font-mono text-neutral-400">170 × 50 pt</span>
                  </div>

                  <div className="border-b border-black/40 border-dashed pb-0.5">
                    <span className="text-[11px] font-mono text-neutral-400 italic">
                      [ Signer stamps signature here ]
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-neutral-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClearPlacement();
                onClose();
              }}
              className="text-xs text-neutral-600 hover:text-black"
            >
              Clear (Let Client Place Freely)
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onSavePlacement({
                  page: currentCoords.page,
                  signatureX: currentCoords.x,
                  signatureY: currentCoords.y,
                });
                onClose();
              }}
              className="text-xs"
            >
              Save Signature Location (Page {currentCoords.page})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
