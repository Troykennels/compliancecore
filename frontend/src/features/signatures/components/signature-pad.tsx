import { useRef } from 'react';
import type { PointerEvent } from 'react';

export function SignaturePad({ onChange }: { onChange: (image: string | undefined) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number | null>(null);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) * event.currentTarget.width / box.width, y: (event.clientY - box.top) * event.currentTarget.height / box.height };
  };
  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext('2d'); if (!ctx) return;
    const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.strokeStyle = '#172554'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    onChange(undefined);
  }
  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault(); const ctx = event.currentTarget.getContext('2d'); const p = point(event); ctx?.lineTo(p.x, p.y); ctx?.stroke();
  }
  function end(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    onChange(event.currentTarget.toDataURL('image/png'));
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div>
    <p id="signature-pad-instructions" className="mb-2 text-xs text-slate-600">Draw with your mouse, pen or finger. Clear the box to start again.</p>
    <canvas ref={canvas} width={840} height={240} aria-label="Draw your signature" aria-describedby="signature-pad-instructions" className="w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white" onPointerDown={start} onPointerMove={draw} onPointerUp={end} onPointerCancel={end} />
    <button type="button" className="mt-2 text-xs font-medium text-indigo-700 underline" onClick={() => { const c = canvas.current; if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height); pointer.current = null; onChange(undefined); }}>Clear signature</button>
  </div>;
}
