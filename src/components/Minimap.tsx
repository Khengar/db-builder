import { useDBStore } from "../store/dbStore";
import { smoothPan } from "../store/dbStore";
import { useRef, useState } from "react";

export default function MiniMap() {
  const tables = useDBStore((s) => s.tables);
  const viewport = useDBStore((s) => s.viewport);
  const setViewport = useDBStore((s) => s.setViewport);

  const MAP = 192; // Matched to w-48
  const WORLD = 20000;
  const MINIMAP_ZOOM = 5;
  const SCALE = (MAP / WORLD) * MINIMAP_ZOOM;

  const mapRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Logic remains same, only styling changed
  const worldX = -viewport.x / viewport.scale;
  const worldY = -viewport.y / viewport.scale;
  const viewX = worldX * SCALE;
  const viewY = worldY * SCALE;
  const viewW = (window.innerWidth / viewport.scale) * SCALE;
  const viewH = (window.innerHeight / viewport.scale) * SCALE;

  const handleMove = (clientX: number, clientY: number) => {
    const rect = mapRef.current!.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const worldCenterX = mx / SCALE;
    const worldCenterY = my / SCALE;
    const newX = -(worldCenterX - window.innerWidth / 2 / viewport.scale);
    const newY = -(worldCenterY - window.innerHeight / 2 / viewport.scale);
    
    // If just clicking (not dragging), use smooth pan
    if (!isDragging) smoothPan(newX, newY); 
    else setViewport(newX, newY);
  }

  return (
    <div
      ref={mapRef}
      className="w-full h-full bg-[#121215] cursor-crosshair relative"
      onMouseDown={() => setIsDragging(true)}
      onMouseMove={(e) => isDragging && handleMove(e.clientX, e.clientY)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onClick={(e) => !isDragging && handleMove(e.clientX, e.clientY)}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${MAP} ${MAP}`}>
        {/* Render Tables as small dots */}
        {tables.map((t) => (
          <rect
            key={t.id}
            x={t.x * SCALE}
            y={t.y * SCALE}
            width={80 * SCALE}
            height={60 * SCALE}
            fill="#8b5cf6" // Violet-500
            opacity={0.6}
            rx={2}
          />
        ))}

        {/* Viewport Viewfinder */}
        <rect
          x={viewX}
          y={viewY}
          width={viewW}
          height={viewH}
          stroke="#fff"
          strokeWidth="1.5"
          fill="rgba(255,255,255,0.05)"
          rx={2}
        />
      </svg>
    </div>
  );
}