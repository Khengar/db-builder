import { useRef } from "react";
import { useDBStore } from "../store/dbStore";

export default function MiniMap() {
  const tables = useDBStore((s) => s.tables);
  const viewport = useDBStore((s) => s.viewport);
  const setViewport = useDBStore((s) => s.setViewport);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // --- UPDATED CONSTANTS (Matches w-80 h-56) ---
  // w-80 = 20rem = 320px
  // h-56 = 14rem = 224px
  const MAP_WIDTH = 320; 
  const MAP_HEIGHT = 224; 
  
  const TABLE_W_ESTIMATE = 200;
  const TABLE_H_ESTIMATE = 150;

  // 1. Calculate the "Bounding Box" of the entire world
  const getBounds = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // A. Include Tables
    if (tables.length === 0) return { minX: -1000, minY: -1000, w: 2000, h: 2000 };
    
    tables.forEach((t) => {
      if (t.x < minX) minX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.x + TABLE_W_ESTIMATE > maxX) maxX = t.x + TABLE_W_ESTIMATE;
      if (t.y + TABLE_H_ESTIMATE > maxY) maxY = t.y + TABLE_H_ESTIMATE;
    });

    // B. Include Current Viewport (Camera)
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    const camWorldX = -viewport.x / viewport.scale;
    const camWorldY = -viewport.y / viewport.scale;
    const camWorldW = screenW / viewport.scale;
    const camWorldH = screenH / viewport.scale;

    minX = Math.min(minX, camWorldX);
    minY = Math.min(minY, camWorldY);
    maxX = Math.max(maxX, camWorldX + camWorldW);
    maxY = Math.max(maxY, camWorldY + camWorldH);

    // C. Add Padding
    const PADDING = 1000;
    minX -= PADDING;
    minY -= PADDING;
    maxX += PADDING;
    maxY += PADDING;

    return { minX, minY, w: maxX - minX, h: maxY - minY };
  };

  const bounds = getBounds();

  // 2. Calculate Scale Factor to fit World into MiniMap
  const scaleX = MAP_WIDTH / bounds.w;
  const scaleY = MAP_HEIGHT / bounds.h;
  const mapScale = Math.min(scaleX, scaleY); // fit contain

  // Helper: World -> MiniMap px
  const toMap = (val: number, isX: boolean) => {
    const offset = isX ? bounds.minX : bounds.minY;
    return (val - offset) * mapScale;
  };

  // 3. Interaction: Click/Drag to teleport
  const handlePointer = (e: React.PointerEvent) => {
    // Only left click
    if (e.buttons !== 1) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert MiniMap px -> World Coords
    const worldX = (clickX / mapScale) + bounds.minX;
    const worldY = (clickY / mapScale) + bounds.minY;

    // Center the viewport on this spot
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    const newVx = (screenW / 2) - (worldX * viewport.scale);
    const newVy = (screenH / 2) - (worldY * viewport.scale);

    setViewport(newVx, newVy);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[#09090b] cursor-crosshair select-none"
      onPointerDown={handlePointer}
      onPointerMove={handlePointer}
    >
      {/* 4. Render Tables (Little Blocks) */}
      {tables.map((t) => (
        <div
          key={t.id}
          className="absolute bg-zinc-600/50 border border-zinc-500/30 rounded-[1px]"
          style={{
            left: toMap(t.x, true),
            top: toMap(t.y, false),
            width: Math.max(4, TABLE_W_ESTIMATE * mapScale), 
            height: Math.max(3, TABLE_H_ESTIMATE * mapScale),
          }}
        />
      ))}

      {/* 5. Render Viewport (The Glowing Lens) */}
      <div
        className="absolute border-2 border-violet-500 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.3)] rounded-sm pointer-events-none transition-transform duration-75"
        style={{
          left: toMap(-viewport.x / viewport.scale, true),
          top: toMap(-viewport.y / viewport.scale, false),
          width: (window.innerWidth / viewport.scale) * mapScale,
          height: (window.innerHeight / viewport.scale) * mapScale,
        }}
      />
    </div>
  );
}