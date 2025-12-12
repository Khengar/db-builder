import { useDBStore } from "../store/dbStore";
import { smoothPan } from "../store/dbStore";
import { useRef, useState } from "react";

export default function MiniMap() {
  const tables = useDBStore((s) => s.tables);
  const viewport = useDBStore((s) => s.viewport);
  const setViewport = useDBStore((s) => s.setViewport);

  const MAP = 200;
  const WORLD = 20000;

  const MINIMAP_ZOOM = 5;
  const SCALE = (MAP / WORLD) * MINIMAP_ZOOM;

  const mapRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // World → minimap positioning
  const worldX = -viewport.x / viewport.scale;
  const worldY = -viewport.y / viewport.scale;

  const viewX = worldX * SCALE;
  const viewY = worldY * SCALE;

  const viewW = (window.innerWidth / viewport.scale) * SCALE;
  const viewH = (window.innerHeight / viewport.scale) * SCALE;

  // Drag-to-pan (direct movement)
  const onMouseDown = () => setIsDragging(true);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const rect = mapRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const worldCenterX = mx / SCALE;
    const worldCenterY = my / SCALE;

    const newX = -(worldCenterX - window.innerWidth / 2 / viewport.scale);
    const newY = -(worldCenterY - window.innerHeight / 2 / viewport.scale);

    setViewport(newX, newY);
  };

  const onMouseUp = () => setIsDragging(false);

  // Smooth panning on click
  const onClick = (e: React.MouseEvent) => {
    if (isDragging) return;

    const rect = mapRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const worldCenterX = mx / SCALE;
    const worldCenterY = my / SCALE;

    const targetX = -(worldCenterX - window.innerWidth / 2 / viewport.scale);
    const targetY = -(worldCenterY - window.innerHeight / 2 / viewport.scale);

    smoothPan(targetX, targetY);
  };

  return (
    <div
      ref={mapRef}
      className="fixed bottom-6 right-6 bg-white border shadow-xl rounded-md p-1"
      style={{ width: MAP, height: MAP }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={onClick}
    >
      <svg width={MAP} height={MAP}>
        {/* Tables */}
        {tables.map((t) => (
          <rect
            key={t.id}
            x={t.x * SCALE}
            y={t.y * SCALE}
            width={80 * SCALE}
            height={50 * SCALE}
            fill="#3b82f6"
            opacity={0.65}
            rx={2}
          />
        ))}

        {/* Viewport rectangle */}
        <rect
          x={viewX}
          y={viewY}
          width={viewW}
          height={viewH}
          stroke="#f97316"
          strokeWidth="2"
          fill="transparent"
        />
      </svg>
    </div>
  );
}
