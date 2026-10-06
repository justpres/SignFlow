'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

export function SignaturePad({ onSignatureChange, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Resize canvas according to device pixel ratio for sharp rendering
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

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
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const coords = getCanvasCoordinates(e);
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 1.25, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !lastPointRef.current) return;

    const coords = getCanvasCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
    if (!hasSignature) {
      setHasSignature(true);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }
    setIsDrawing(false);
    lastPointRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
    onSignatureChange(null);
  };

  return (
    <div className="w-full flex flex-col space-y-2">
      <div className="flex justify-between items-center text-xs text-neutral-600">
        <span>Use your finger, stylus, or mouse to draw your signature</span>
        {hasSignature && (
          <button
            type="button"
            onClick={clearCanvas}
            disabled={disabled}
            className="text-black font-semibold hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-black"
          >
            Clear signature
          </button>
        )}
      </div>

      <div className="relative w-full h-44 border border-black bg-white touch-none cursor-crosshair">
        <canvas
          ref={canvasRef}
          aria-label="Draw your legal signature here"
          role="img"
          className="w-full h-full block"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-neutral-400 text-sm select-none">
            Sign here
          </div>
        )}

        <div className="absolute bottom-6 left-6 right-6 border-b border-dashed border-neutral-300 pointer-events-none" />
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Signature will be rendered in monochrome on the finalized document.</span>
        {hasSignature && <span className="font-medium text-black">✓ Signature recorded</span>}
      </div>
    </div>
  );
}
