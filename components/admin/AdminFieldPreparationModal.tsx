'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/Icons';
import { PlacedField, FieldType } from '@/lib/types';

interface AdminFieldPreparationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBase64: string;
  initialPlacement?: {
    page?: number;
    signatureX?: number;
    signatureY?: number;
  };
  initialFields?: PlacedField[];
  onSavePlacement: (placement: { page: number; signatureX: number; signatureY: number }) => void;
  onSaveFields?: (fields: PlacedField[], primaryPlacement: { page: number; signatureX: number; signatureY: number }) => void;
  onClearPlacement: () => void;
}

const FIELD_DEFAULTS: Record<FieldType, { width: number; height: number; label: string }> = {
  SIGNATURE: { width: 170, height: 50, label: 'Signature Line' },
  INITIALS: { width: 80, height: 40, label: 'Initials' },
  DATE: { width: 110, height: 28, label: 'Date Signed' },
  TEXT: { width: 160, height: 28, label: 'Text Field' },
};

export function AdminFieldPreparationModal({
  isOpen,
  onClose,
  pdfBase64,
  initialPlacement,
  initialFields,
  onSavePlacement,
  onSaveFields,
  onClearPlacement,
}: AdminFieldPreparationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);

  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(initialPlacement?.page || 1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });

  // Multi-fields collection
  const [fields, setFields] = useState<PlacedField[]>(() => {
    if (initialFields && initialFields.length > 0) return initialFields;
    return [
      {
        id: 'field-sig-primary',
        type: 'SIGNATURE',
        page: initialPlacement?.page || 1,
        x: initialPlacement?.signatureX ?? 70,
        y: initialPlacement?.signatureY ?? 115,
        width: 170,
        height: 50,
        label: 'Signature Line',
        required: true,
      },
    ];
  });

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialX: number;
    initialY: number;
    width: number;
    height: number;
  }>({ pointerX: 0, pointerY: 0, initialX: 0, initialY: 0, width: 170, height: 50 });

  // Clamp helper
  const clampField = useCallback(
    (targetX: number, targetY: number, width: number, height: number) => {
      const minTopMarginPt = Math.ceil(32 / scale);
      const maxY = Math.round(pageDimensions.height - height - minTopMarginPt);

      const clampedX = Math.max(10, Math.min(targetX, Math.round(pageDimensions.width - width - 10)));
      const clampedY = Math.max(20, Math.min(targetY, Math.max(20, maxY)));

      return { x: clampedX, y: clampedY };
    },
    [pageDimensions.height, pageDimensions.width, scale]
  );

  // Reset or initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialFields && initialFields.length > 0) {
        setFields(initialFields);
        setSelectedFieldId(initialFields[0].id);
        setCurrentPage(initialFields[0].page || initialPlacement?.page || 1);
      } else {
        const initPage = initialPlacement?.page || 1;
        setFields([
          {
            id: 'field-sig-primary',
            type: 'SIGNATURE',
            page: initPage,
            x: initialPlacement?.signatureX ?? 70,
            y: initialPlacement?.signatureY ?? 115,
            width: 170,
            height: 50,
            label: 'Signature Line',
            required: true,
          },
        ]);
        setSelectedFieldId('field-sig-primary');
        setCurrentPage(initPage);
      }
    }
  }, [isOpen, initialPlacement, initialFields]);

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
          : doc.numPages;

        setCurrentPage(targetPage);
        setIsLoading(false);
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error('PDF load error:', err);
        setError('Failed to render PDF document for field preparation.');
        setIsLoading(false);
      }
    }

    loadPdf();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, pdfBase64, initialPlacement]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDocRef.current || isLoading || !isOpen) return;
    let isCancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderTask: any = null;

    async function renderPage() {
      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (isCancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({
          width: unscaledViewport.width,
          height: unscaledViewport.height,
        });

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

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
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [currentPage, scale, isLoading, isOpen]);

  // Page navigation
  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const goToNextPage = () => {
    if (currentPage < numPages) setCurrentPage((p) => p + 1);
  };

  // Add a new field
  const addField = (type: FieldType) => {
    const config = FIELD_DEFAULTS[type];
    const pageFields = fields.filter((f) => f.page === currentPage);
    const offset = pageFields.length * 36;
    const initialY = Math.max(40, 160 - offset);

    const newField: PlacedField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      page: currentPage,
      x: 70,
      y: initialY,
      width: config.width,
      height: config.height,
      label: config.label,
      required: true,
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  // Delete a field
  const removeField = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  // Drag start
  const handleDragStart = (field: PlacedField, clientX: number, clientY: number) => {
    setSelectedFieldId(field.id);
    setDraggingFieldId(field.id);
    setIsDragging(true);

    dragStartRef.current = {
      pointerX: clientX,
      pointerY: clientY,
      initialX: field.x,
      initialY: field.y,
      width: field.width,
      height: field.height,
    };
  };

  // Drag move
  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || !draggingFieldId) return;

      const deltaPixelX = clientX - dragStartRef.current.pointerX;
      const deltaPixelY = clientY - dragStartRef.current.pointerY;

      const deltaPtX = Math.round(deltaPixelX / scale);
      const deltaPtY = Math.round(-deltaPixelY / scale);

      const targetX = dragStartRef.current.initialX + deltaPtX;
      const targetY = dragStartRef.current.initialY + deltaPtY;

      const clamped = clampField(
        targetX,
        targetY,
        dragStartRef.current.width,
        dragStartRef.current.height
      );

      setFields((prev) =>
        prev.map((f) =>
          f.id === draggingFieldId
            ? { ...f, x: clamped.x, y: clamped.y }
            : f
        )
      );
    },
    [isDragging, draggingFieldId, scale, clampField]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggingFieldId(null);
  }, []);

  // Global listeners for mouse move and up
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

  // Touch handlers
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
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Save handler
  const handleSave = () => {
    const primarySig = fields.find((f) => f.type === 'SIGNATURE') || fields[0];
    const primaryPlacement = primarySig
      ? { page: primarySig.page, signatureX: primarySig.x, signatureY: primarySig.y }
      : { page: currentPage, signatureX: 70, signatureY: 115 };

    onSavePlacement(primaryPlacement);
    if (onSaveFields) {
      onSaveFields(fields, primaryPlacement);
    }
    onClose();
  };

  if (!isOpen) return null;

  const currentPageFields = fields.filter((f) => f.page === currentPage);
  const selectedField = fields.find((f) => f.id === selectedFieldId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm"
    >
      <div className="bg-white border-2 border-black w-full max-w-5xl h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-black text-white shrink-0">
          <div>
            <h2 className="text-base font-bold tracking-tight">Prepare Document Fields</h2>
            <p className="text-xs text-neutral-300 mt-0.5">
              Add signature, initials, date, or text inputs. Drag anywhere to position.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-neutral-300 font-mono text-xl p-1 leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Toolbar: Page Controls & Add Field Tools */}
        <div className="py-2.5 px-4 border-b border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* Page navigation */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={currentPage <= 1 || isLoading}
              className="h-8 px-2"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
            </Button>
            <span className="font-mono text-xs px-2.5 py-1 bg-white border border-neutral-300">
              Page {currentPage} of {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= numPages || isLoading}
              className="h-8 px-2"
            >
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Add Field Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mr-1">
              + Add:
            </span>
            <button
              type="button"
              onClick={() => addField('SIGNATURE')}
              className="px-2.5 py-1 text-xs border border-black bg-black text-white hover:bg-neutral-800 font-medium"
            >
              Signature
            </button>
            <button
              type="button"
              onClick={() => addField('INITIALS')}
              className="px-2.5 py-1 text-xs border border-neutral-400 bg-white hover:border-black text-black font-medium"
            >
              Initials
            </button>
            <button
              type="button"
              onClick={() => addField('DATE')}
              className="px-2.5 py-1 text-xs border border-neutral-400 bg-white hover:border-black text-black font-medium"
            >
              Date Signed
            </button>
            <button
              type="button"
              onClick={() => addField('TEXT')}
              className="px-2.5 py-1 text-xs border border-neutral-400 bg-white hover:border-black text-black font-medium"
            >
              Text Input
            </button>
          </div>

          {/* Selected coordinates readout & Zoom */}
          <div className="flex items-center space-x-2">
            {selectedField && (
              <span className="hidden md:inline-block font-mono text-[11px] bg-white border border-neutral-300 px-2 py-1">
                {selectedField.label}: ({selectedField.x}, {selectedField.y}) pt
              </span>
            )}
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
              <span className="font-mono text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
                disabled={scale >= 2.0 || isLoading}
                className="h-8 px-2 font-mono"
              >
                +
              </Button>
            </div>
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
              className="relative shadow-md border border-neutral-300 bg-white cursor-default select-none"
              style={{
                width: pageDimensions.width * scale,
                height: pageDimensions.height * scale,
              }}
            >
              <canvas ref={canvasRef} className="block pointer-events-none" />

              {/* Placed Fields on Current Page */}
              {currentPageFields.map((field) => {
                const isSelected = selectedFieldId === field.id;
                const isThisDragging = draggingFieldId === field.id;
                const leftPx = Math.round(field.x * scale);
                const topPx = Math.round((pageDimensions.height - field.y - field.height) * scale);
                const widthPx = Math.round(field.width * scale);
                const heightPx = Math.round(field.height * scale);

                return (
                  <div
                    key={field.id}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleDragStart(field, e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      if (e.touches.length === 1) {
                        e.stopPropagation();
                        handleDragStart(field, e.touches[0].clientX, e.touches[0].clientY);
                      }
                    }}
                    style={{
                      left: `${leftPx}px`,
                      top: `${topPx}px`,
                      width: `${widthPx}px`,
                      height: `${heightPx}px`,
                    }}
                    className={`absolute select-none border-2 transition-shadow cursor-grab ${
                      isThisDragging
                        ? 'border-black bg-neutral-100/90 shadow-2xl cursor-grabbing z-30'
                        : isSelected
                        ? 'border-black bg-white/95 shadow-xl z-20'
                        : 'border-dashed border-neutral-600 bg-white/80 hover:border-black z-10'
                    }`}
                  >
                    {/* Handle Tag */}
                    <div className="absolute -top-5 left-0 bg-black text-white text-[9px] font-bold tracking-wider px-1.5 py-0.5 uppercase flex items-center gap-1 shadow-sm">
                      <span>{field.label || field.type}</span>
                      <span className="text-[8px] opacity-75 font-mono">({field.x}, {field.y})</span>
                      <button
                        type="button"
                        onClick={(e) => removeField(field.id, e)}
                        className="ml-1 hover:text-red-300 text-[10px] leading-none"
                        title="Delete field"
                      >
                        ×
                      </button>
                    </div>

                    {/* Field Interior Content */}
                    <div className="w-full h-full p-1.5 flex flex-col justify-between pointer-events-none">
                      <div className="flex items-center justify-between text-[9px] text-neutral-600 font-medium">
                        <span className="truncate">{field.label || field.type}</span>
                        <span className="text-[8px] font-mono opacity-70">
                          {field.width} × {field.height} pt
                        </span>
                      </div>
                      <div className="border-b border-black/40 border-dashed pb-0.5">
                        <span className="text-[10px] font-mono text-neutral-400 italic">
                          {field.type === 'SIGNATURE' && '[ Signer Signature ]'}
                          {field.type === 'INITIALS' && '[ Signer Initials ]'}
                          {field.type === 'DATE' && '[ YYYY-MM-DD ]'}
                          {field.type === 'TEXT' && '[ Text Input ]'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
              Clear Fields
            </Button>
            <span className="text-xs text-neutral-500 font-mono">
              Total placed: {fields.length} {fields.length === 1 ? 'field' : 'fields'}
            </span>
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
              onClick={handleSave}
              className="text-xs"
            >
              Save Field Placements ({fields.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
