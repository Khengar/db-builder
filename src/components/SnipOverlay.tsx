import { useState, useRef, useEffect } from "react";
import { safeScreenshot } from "../utils/safeScreenshot";

export default function SnipOverlay({ onClose }: { onClose: () => void }) {
  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    dragging: false,
  });

  const startRef = useRef({ x: 0, y: 0 });

  /* ESC → Exit */
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  /* Start Snip */
  const startCrop = (e: React.MouseEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    setCrop({
      x: e.clientX,
      y: e.clientY,
      w: 0,
      h: 0,
      dragging: true,
    });
  };

  /* Move */
  const moveCrop = (e: React.MouseEvent) => {
    if (!crop.dragging) return;
    setCrop((prev) => ({
      ...prev,
      w: e.clientX - prev.x,
      h: e.clientY - prev.y,
    }));
  };

  /* End Drag */
  const endCrop = () =>
    setCrop((prev) => ({
      ...prev,
      dragging: false,
    }));

  /* SAVE PNG (FINAL, FIXED) */
  const captureSnip = async () => {
    const overlay = document.getElementById("snip-overlay");

    if (overlay) overlay.style.visibility = "hidden";

    const canvas = await safeScreenshot(document.body, {
      scale: 2,
      backgroundColor: null,
    });

    if (overlay) overlay.style.visibility = "visible";

    // Normalize selection rectangle
    const rect = {
      x: Math.min(crop.x, crop.x + crop.w),
      y: Math.min(crop.y, crop.y + crop.h),
      w: Math.abs(crop.w),
      h: Math.abs(crop.h),
    };

    const out = document.createElement("canvas");
    out.width = rect.w * 2;
    out.height = rect.h * 2;

    const ctx = out.getContext("2d")!;
    ctx.drawImage(
      canvas,
      rect.x * 2,
      rect.y * 2,
      rect.w * 2,
      rect.h * 2,
      0,
      0,
      rect.w * 2,
      rect.h * 2
    );

    out.toBlob((blob) => {
      if (!blob) return alert("Error generating PNG");

      setTimeout(() => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "diagram-snippet.png";

        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
        onClose();
      }, 0);
    }, "image/png");
  };

  const visible = !crop.dragging && crop.w !== 0 && crop.h !== 0;

  return (
    <div
      id="snip-overlay"
      className="fixed inset-0 bg-black/40 cursor-crosshair"
      style={{ zIndex: 999999 }}
      onMouseDown={startCrop}
      onMouseMove={moveCrop}
      onMouseUp={endCrop}
    >
      {(crop.dragging || visible) && (
        <div
          style={{
            position: "absolute",
            left: Math.min(crop.x, crop.x + crop.w),
            top: Math.min(crop.y, crop.y + crop.h),
            width: Math.abs(crop.w),
            height: Math.abs(crop.h),
            border: "2px solid #4A90E2",
            background: "rgba(255,255,255,0.25)",
            boxShadow: "0 0 0 2000px rgba(0,0,0,0.4)",
          }}
        />
      )}

      {visible && (
        <div
          className="absolute bg-white shadow-lg py-2 px-3 rounded-md flex gap-3"
          style={{
            top: Math.min(crop.y, crop.y + crop.h) - 45,
            left: Math.min(crop.x, crop.x + crop.w),
            zIndex: 9999999,
          }}
        >
          <button
            className="bg-blue-600 text-white px-3 py-1 rounded"
            onClick={(e) => {
              e.stopPropagation();
              requestAnimationFrame(captureSnip);
            }}
          >
            Save PNG
          </button>

          <button
            className="bg-gray-300 px-3 py-1 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
