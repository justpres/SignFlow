'use client';

import React, { useEffect, useRef } from 'react';

interface TypedSignatureProps {
  name: string;
  onSignatureGenerated: (dataUrl: string | null) => void;
  disabled?: boolean;
}

export function TypedSignature({ name, onSignatureGenerated }: TypedSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!name.trim()) {
      onSignatureGenerated(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render crisp offscreen preview to PNG data URL
    canvas.width = 600;
    canvas.height = 200;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'italic 58px "Brush Script MT", "Segoe Script", "Dancing Script", cursive';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.trim(), canvas.width / 2, canvas.height / 2);

    const dataUrl = canvas.toDataURL('image/png');
    onSignatureGenerated(dataUrl);
  }, [name, onSignatureGenerated]);

  return (
    <div className="w-full flex flex-col space-y-2">
      <div className="text-xs text-neutral-600">
        Generated electronic signature representation based on your legal name
      </div>

      <div className="h-44 border border-black bg-white flex flex-col items-center justify-center p-4 relative">
        <canvas ref={canvasRef} className="hidden" />

        {name.trim() ? (
          <div className="font-signature text-3xl sm:text-4xl text-black select-none italic text-center px-4">
            {name.trim()}
          </div>
        ) : (
          <div className="text-neutral-400 text-sm">Enter your full legal name above to preview</div>
        )}

        <div className="absolute bottom-6 left-6 right-6 border-b border-dashed border-neutral-300 pointer-events-none" />
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Legally equivalent typed representation.</span>
        {name.trim() && <span className="font-medium text-black">✓ Signature generated</span>}
      </div>
    </div>
  );
}
