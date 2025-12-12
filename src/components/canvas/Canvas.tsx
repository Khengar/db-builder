import { useDBStore } from "../../store/dbStore";
import TableNode from "../nodes/TableNode";

export default function Canvas() {
  const tables = useDBStore((s) => s.tables);
  const relations = useDBStore((s) => s.relations);
  const selectedRelationId = useDBStore((s) => s.selectedRelationId);
  const selectRelation = useDBStore((s) => s.selectRelation);

  const viewport = useDBStore((s) => s.viewport);

  const TABLE_WIDTH = 260;
  const HEADER = 42;
  const ROW = 32;

  const getColumnY = (table: any, index: number) => {
    return table.y + HEADER + index * ROW + ROW / 2;
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* 
      ============================================
      PAN + ZOOM WORLD
      Everything inside here shares same transform
      ============================================
      */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: "0 0",
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;

          // Do NOT clear if clicking on a path (relation)
          if (target.closest("path")) return;

          // Do NOT clear when clicking table-node (its children have pointer-events auto)
          if (target.closest(".table-node")) return;

          // Otherwise clear selection
          selectRelation(null);
        }}
      >
        {/* 
        ================================
        SVG RELATION LINES — behind tables
        ================================
        */}
        <svg
          className="absolute inset-0"
          style={{
            zIndex: 50,
            overflow: "visible",
            pointerEvents: "auto",
          }}
        >
          <defs>
            {/* One-to-one bar */}
            <marker
              id="marker-bar"
              viewBox="0 0 10 20"
              markerWidth="8"
              markerHeight="20"
              refX="10"
              refY="10"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="20"
                stroke="currentColor"
                strokeWidth="2"
              />
            </marker>

            {/* Crow-foot (many) */}
            <marker
              id="marker-crow"
              viewBox="0 0 20 20"
              markerWidth="12"
              markerHeight="20"
              refX="20"
              refY="10"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              {/* <!-- crow foot branches --> */}
              <line
                x1="20"
                y1="10"
                x2="0"
                y2="0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="20"
                y1="10"
                x2="0"
                y2="20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* <!-- optional vertical bar for modern crowfoot --> */}
              <line
                x1="20"
                y1="0"
                x2="20"
                y2="20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </marker>
          </defs>
          {relations.map((rel) => {
            const tA = tables.find((t) => t.id === rel.from.tableId);
            const tB = tables.find((t) => t.id === rel.to.tableId);
            if (!tA || !tB) return null;

            const idxA = tA.columns.findIndex((c) => c.id === rel.from.columnId);
            const idxB = tB.columns.findIndex((c) => c.id === rel.to.columnId);
            if (idxA === -1 || idxB === -1) return null;

            const A = {
              x: tA.x + TABLE_WIDTH,
              y: getColumnY(tA, idxA),
            };

            const B = {
              x: tB.x,
              y: getColumnY(tB, idxB),
            };

            const cx1 = A.x + (B.x - A.x) * 0.25;
            const cy1 = A.y;
            const cx2 = B.x - (B.x - A.x) * 0.25;
            const cy2 = B.y;

            return (
              <g key={rel.id}>
                <path
                  d={`M ${A.x} ${A.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${B.x} ${B.y}`}
                  stroke="currentColor"
                  color={selectedRelationId === rel.id ? "#3b82f6" : "#3b82f6"} // blue line + blue markers
                  strokeWidth={selectedRelationId === rel.id ? 4 : 3}
                  fill="none"
                  strokeLinecap="round"
                  style={{ cursor: "pointer", pointerEvents: "auto" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectRelation(rel.id);
                  }}

                  /* CARDINALITY MARKERS */
                  markerStart={
                    rel.cardinality === "one-to-one"
                      ? "url(#marker-bar)"
                      : rel.cardinality === "one-to-many"
                        ? "url(#marker-bar)"   // 1—N: bar on the '1' side
                        : rel.cardinality === "many-to-many"
                          ? "url(#marker-crow)"
                          : undefined
                  }
                  markerEnd={
                    rel.cardinality === "one-to-one"
                      ? "url(#marker-bar)"
                      : rel.cardinality === "one-to-many"
                        ? "url(#marker-crow)"  // crow-foot on the 'N' side
                        : rel.cardinality === "many-to-many"
                          ? "url(#marker-crow)"
                          : undefined
                  }
                />
              </g>
            );
          })}
        </svg>

        {/* 
        ================================
        TABLES — always above SVG lines
        pointer-events none here allows SVG clicks through
        table-node inner elements re-enable pointer-events
        ================================
        */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 100 }}
        >
          {tables.map((table) => (
            <TableNode key={table.id} table={table} />
          ))}
        </div>
      </div>
    </div>
  );
}
