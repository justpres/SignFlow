'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';

interface PdfViewerProps {
  pdfBase64: string;
}

export function PdfViewer({ pdfBase64 }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setIsLoading(true);
      setError(null);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // Point worker to matching unpkg/cdnjs or local cdn distribution
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
        }

        const rawBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
        const loadingTask = pdfjsLib.getDocument({ data: rawBytes });
        const doc = await loadingTask.promise;

        if (isCancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setIsLoading(false);
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error('PDF render error:', err);
        setError('Failed to load document preview. You can still inspect the document details.');
        setIsLoading(false);
      }
    }

    if (pdfBase64) {
      loadPdf();
    }

    return () => {
      isCancelled = true;
    };
  }, [pdfBase64]);

  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      if (!pdfDocRef.current || !canvasRef.current) return;

      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled) return;

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

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-100 border border-neutral-300 overflow-hidden">
      {/* Viewer Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between p-3 bg-white border-b border-neutral-200 text-xs">
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

          <span className="font-medium text-neutral-800">
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

        <div className="flex items-center space-x-2 mt-2 sm:mt-0">
          <button
            type="button"
            onClick={handleZoomOut}
            className="px-2 py-1 border border-neutral-300 hover:border-black font-mono font-medium focus-visible:outline-black cursor-pointer"
            aria-label="Zoom out"
          >
            -
          </button>
          <span className="font-mono text-neutral-600">{Math.round(scale * 100)}%</span>
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
            className="px-2 py-1 border border-neutral-300 hover:border-black font-medium focus-visible:outline-black cursor-pointer ml-1"
          >
            Fit
          </button>
        </div>
      </div>

      {/* PDF Canvas Viewport */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto p-4 sm:p-6"
        tabIndex={0}
        aria-label="Contract document page view"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'PageDown') handleNextPage();
          if (e.key === 'ArrowLeft' || e.key === 'PageUp') handlePrevPage();
        }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-full space-y-3">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-neutral-600">Loading document pages...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center min-h-full">
            <div className="text-center p-6 bg-white border border-black max-w-sm">
              <p className="text-sm font-semibold text-black">{error}</p>
            </div>
          </div>
        ) : (
          <div className="min-w-full min-h-full flex items-start justify-center">
            <div className="bg-white shadow-md border border-neutral-300 flex-shrink-0">
              <canvas ref={canvasRef} className="block" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
