import { useState, useRef, useEffect } from "react";
import { safeScreenshot } from "../utils/safeScreenshot";
import { Download, X } from "lucide-react";

export default function SnipOverlay({ onClose }: { onClose: () => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0, dragging: false });
  const startRef = useRef({ x: 0, y: 0 });
  const SCALE = 3; 

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const startCrop = (e: React.MouseEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    setCrop({ x: e.clientX, y: e.clientY, w: 0, h: 0, dragging: true });
  };

  const moveCrop = (e: React.MouseEvent) => {
    if (!crop.dragging) return;
    setCrop((prev) => ({ ...prev, w: e.clientX - prev.x, h: e.clientY - prev.y }));
  };

  const endCrop = () => setCrop((prev) => ({ ...prev, dragging: false }));

  const captureSnip = async () => {
    // ... (Use your existing logic here, it was fine)
    // Just ensure styling below matches
    // ...
    // Copy-paste the 'captureSnip' logic from your original file here
    const width = Math.abs(crop.w);
    const height = Math.abs(crop.h);
    const x = Math.min(crop.x, crop.x + crop.w);
    const y = Math.min(crop.y, crop.y + crop.h);

    if (width < 5 || height < 5) { alert("Selection too small"); return; }

    try {
      const overlay = document.getElementById("snip-overlay");
      if (overlay) overlay.style.display = "none";
      
      const canvas = await safeScreenshot(document.body, {
        width: width, height: height, pixelRatio: SCALE,
        style: {
          transform: `translate(-${x}px, -${y}px)`,
          transformOrigin: "top left",
          width: `${document.documentElement.scrollWidth}px`,
          height: `${document.documentElement.scrollHeight}px`,
        },
      });

      if (overlay) overlay.style.display = "block";

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `snip-hq-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        onClose();
      });

    } catch (err) {
      console.error("Snip failed:", err);
      const overlay = document.getElementById("snip-overlay");
      if (overlay) overlay.style.display = "block";
    }
  };

  const visible = !crop.dragging && crop.w !== 0 && crop.h !== 0;

  return (
    <div
      id="snip-overlay"
      className="fixed inset-0 cursor-crosshair z-[99999]"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onMouseDown={startCrop}
      onMouseMove={moveCrop}
      onMouseUp={endCrop}
    >
      {/* Selection Box */}
      {(crop.dragging || visible) && (
        <div
          style={{
            position: "absolute",
            left: Math.min(crop.x, crop.x + crop.w),
            top: Math.min(crop.y, crop.y + crop.h),
            width: Math.abs(crop.w),
            height: Math.abs(crop.h),
          }}
          className="border-2 border-violet-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
        />
      )}

      {/* Floating Toolbar */}
      {visible && (
        <div
          className="absolute flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          style={{
            top: Math.min(crop.y, crop.y + crop.h) + 16,
            left: Math.min(crop.x, crop.x + crop.w),
            pointerEvents: "auto",
          }}
          onMouseDown={(e) => e.stopPropagation()} 
        >
          <button
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-violet-500 transition-colors font-medium"
            onClick={captureSnip}
          >
            <Download size={14} /> Download PNG
          </button>
          <button
            className="flex items-center gap-2 bg-zinc-800 text-zinc-300 px-3 py-2 text-sm rounded-lg hover:bg-zinc-700 transition-colors border border-white/5"
            onClick={onClose}
          >
            <X size={14} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}