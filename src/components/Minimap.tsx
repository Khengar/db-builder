import { useDBStore } from "../store/dbStore";
import { smoothPan } from "../store/dbStore";
import { useRef, useState } from "react";

export default function MiniMap() {
  const tables = useDBStore((s) => s.tables);
  const viewport = useDBStore((s) => s.viewport);
  const setViewport = useDBStore((s) => s.setViewport);

  const MAP = 200;
  const WORLD = 20000;

  const MINIMAP_ZOOM = 8; // adjust to 3, 5, or 6 depending on visibility


  // FIX 1: dynamic scaling so objects appear properly sized
  const SCALE = (MAP / WORLD) * MINIMAP_ZOOM;


  const mapRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Compute visible window inside world space → minimap space
  const worldX = -viewport.x / viewport.scale;
  const worldY = -viewport.y / viewport.scale;

  const viewX = worldX * SCALE;
  const viewY = worldY * SCALE;

  const viewW = (window.innerWidth / viewport.scale) * SCALE;
  const viewH = (window.innerHeight / viewport.scale) * SCALE;

  /* ----------------------------------------------
        DRAG → direct viewport movement (NO SMOOTH)
  ----------------------------------------------- */
  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const rect = mapRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // convert minimap coords → world coords
    const worldCenterX = mx / SCALE;
    const worldCenterY = my / SCALE;

    // convert world coords → viewport coords
    const newX = -(worldCenterX - window.innerWidth / 2 / viewport.scale);
    const newY = -(worldCenterY - window.innerHeight / 2 / viewport.scale);

    // DIRECT pan, no animation
    setViewport(newX, newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  /* ----------------------------------------------
        CLICK → SMOOTH PANNING (ONLY ON CLICK)
  ----------------------------------------------- */
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return; // prevent click after drag

    const rect = mapRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const worldCenterX = mx / SCALE;
    const worldCenterY = my / SCALE;

    const targetX = -(worldCenterX - window.innerWidth / 2 / viewport.scale);
    const targetY = -(worldCenterY - window.innerHeight / 2 / viewport.scale);

    smoothPan(targetX, targetY);
  };

  // Hide minimap when too zoomed out
  const visible = viewport.scale > 0.35;

  return (
    <div
      ref={mapRef}
      className="fixed bottom-6 right-6 rounded-md bg-white shadow-xl border p-1 transition-all"
      style={{
        width: MAP,
        height: MAP,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      <svg width={MAP} height={MAP}>
        {/* TABLES */}
        {tables.map((t) => (
          <rect
            key={t.id}
            x={t.x * SCALE}
            y={t.y * SCALE}
            width={120 * SCALE}
            height={70 * SCALE}
            fill="#3b82f6"
            opacity={0.7}
            rx={2}
          />
        ))}

        {/* VIEWPORT RECT */}
        {/* VIEWPORT RECT */}
        <rect
          x={viewX}
          y={viewY}
          width={viewW}
          height={viewH}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
        />

      </svg>
    </div>
  );
}
