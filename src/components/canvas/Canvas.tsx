import { useState, useEffect, useMemo } from "react";
import { useDBStore } from "../../store/dbStore";
import TableNode from "../nodes/TableNode";
import { barPath, crowFootPath } from "../../utils/arrow";

// Helper hook to track window resizing for culling calculations
function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
}

export default function Canvas() {
  const tables = useDBStore((s) => s.tables);
  const relations = useDBStore((s) => s.relations);
  const selectedRelationId = useDBStore((s) => s.selectedRelationId);
  const selectRelation = useDBStore((s) => s.selectRelation);
  const viewport = useDBStore((s) => s.viewport);

  const { width: windowW, height: windowH } = useWindowSize();

  const TABLE_WIDTH = 260;
  const HEADER = 42;
  const ROW = 32;

  // --- 1. CULLING LOGIC (Virtual Infinity) ---
  const visibleTables = useMemo(() => {
    // Define a "Buffer" (in pixels) so tables don't pop in abruptly
    const BUFFER = 600;

    // Calculate the "World" bounds that are currently visible on screen
    // Math: (ScreenCoord - ViewportOffset) / Scale = WorldCoord
    const minVisibleX = -viewport.x / viewport.scale - BUFFER;
    const minVisibleY = -viewport.y / viewport.scale - BUFFER;
    
    const maxVisibleX = (windowW - viewport.x) / viewport.scale + BUFFER;
    const maxVisibleY = (windowH - viewport.y) / viewport.scale + BUFFER;

    return tables.filter((t) => {
      // Estimate table height based on columns (header + rows + padding)
      const tableHeight = HEADER + (t.columns.length * ROW) + 50; 

      // Check if the table overlaps with the visible world rectangle
      const isVisible =
        t.x + TABLE_WIDTH > minVisibleX &&
        t.x < maxVisibleX &&
        t.y + tableHeight > minVisibleY &&
        t.y < maxVisibleY;

      return isVisible;
    });
  }, [tables, viewport, windowW, windowH]);

  const getColumnY = (table: any, index: number) =>
    table.y + HEADER + index * ROW + ROW / 2;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        id="diagram-root"
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: "0 0",
        }}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("path") || t.closest(".table-node")) return;
          selectRelation(null);
        }}
      >
        {/* RELATIONS LAYER */}
        {/* FIX: Removed fixed width/height/viewBox. Used overflow: visible */}
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          style={{ 
            width: 0, 
            height: 0, 
            overflow: "visible", 
            zIndex: 50 
          }}
        >
          {relations.map((rel) => {
            // Note: We search 'tables' (full list), not 'visibleTables', 
            // so lines still draw even if one end is off-screen.
            const tA = tables.find((t) => t.id === rel.from.tableId);
            const tB = tables.find((t) => t.id === rel.to.tableId);
            if (!tA || !tB) return null;

            const iA = tA.columns.findIndex((c) => c.id === rel.from.columnId);
            const iB = tB.columns.findIndex((c) => c.id === rel.to.columnId);
            if (iA === -1 || iB === -1) return null;

            const A = { x: tA.x + TABLE_WIDTH, y: getColumnY(tA, iA) };
            const B = { x: tB.x, y: getColumnY(tB, iB) };

            const cx1 = A.x + (B.x - A.x) * 0.25;
            const cy1 = A.y;
            const cx2 = B.x - (B.x - A.x) * 0.25;
            const cy2 = B.y;

            const d = `M ${A.x} ${A.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${B.x} ${B.y}`;
            const startAngle = Math.atan2(cy1 - A.y, cx1 - A.x);
            const endAngle = Math.atan2(B.y - cy2, B.x - cx2);

            const startSymbol = rel.cardinality === "many-to-many" ? "crow" : "bar";
            const endSymbol =
              rel.cardinality === "many-to-many" || rel.cardinality === "one-to-many"
                ? "crow"
                : "bar";

            const stroke = "#3b82f6";
            const strokeWidth = selectedRelationId === rel.id ? 4 : 3;

            return (
              <g key={rel.id} className="pointer-events-auto cursor-pointer">
                {/* Invisible wide stroke for easier clicking */}
                <path d={d} stroke="transparent" strokeWidth={20} fill="none" 
                  onClick={(e) => {
                    e.stopPropagation();
                    selectRelation(rel.id);
                  }}
                />
                
                {/* Actual Line */}
                <path
                  d={d}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectRelation(rel.id);
                  }}
                />

                <path
                  d={startSymbol === "crow" ? crowFootPath(A.x, A.y, startAngle) : barPath(A.x, A.y, startAngle)}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  fill="none"
                />

                <path
                  d={endSymbol === "crow" ? crowFootPath(B.x, B.y, endAngle) : barPath(B.x, B.y, endAngle)}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
              </g>
            );
          })}
        </svg>

        {/* TABLES LAYER */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 100 }}
        >
          {/* ONLY Render Visible Tables */}
          {visibleTables.map((t) => (
            <TableNode key={t.id} table={t} />
          ))}
        </div>
      </div>
    </div>
  );
}