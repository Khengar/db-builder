import { useDBStore } from "../../store/dbStore";
import TableNode from "../nodes/TableNode";

export default function Canvas() {
  const tables = useDBStore((s) => s.tables);
  const relations = useDBStore((s) => s.relations);

  const TABLE_WIDTH = 260;
  const HEADER = 42;
  const ROW = 32;

  const getColumnY = (table: any, index: number) => {
    return table.y + HEADER + index * ROW + ROW / 2;
  };

  return (
    <div className="relative w-full h-full overflow-hidden">


      {/* ───────────────────────────────────────────────
          SVG LAYER (BELOW TABLES)
          BUT pointer-events ARE DISABLED
      ─────────────────────────────────────────────── */}
      <svg
  className="absolute top-0 left-0 w-full h-full"
  style={{
    zIndex: 1,
    pointerEvents: "none",
    border: "3px solid red" // keep temporarily
  }}
>


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

  // CURVE CONTROL POINTS (smooth)
  const cx1 = A.x + (B.x - A.x) * 0.25;
  const cy1 = A.y;

  const cx2 = B.x - (B.x - A.x) * 0.25;
  const cy2 = B.y;

  return (
    <g key={rel.id}>

      {/* DEBUG DOTS — you can remove later */}
      <circle cx={A.x} cy={A.y} r={6} fill="red" />
      <circle cx={B.x} cy={B.y} r={6} fill="blue" />

      {/* BEAUTIFUL CURVE */}
      <path
        d={`M ${A.x} ${A.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${B.x} ${B.y}`}
        stroke="lime"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />

    </g>
  );
})}
      </svg>

      {/* ───────────────────────────────────────────────
          TABLE NODES (INTERACTIVE) — MUST BE ABOVE SVG
      ─────────────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 2,   // ABOVE LINES
          pointerEvents: "auto",
        }}
      >
        {tables.map((table) => (
          <TableNode key={table.id} table={table} />
        ))}
      </div>
    </div>
  );
}
