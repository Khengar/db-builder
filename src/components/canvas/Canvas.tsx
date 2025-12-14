import { useDBStore } from "../../store/dbStore";
import TableNode from "../nodes/TableNode";
import { barPath, crowFootPath } from "../../utils/arrow";

export default function Canvas() {
  const tables = useDBStore((s) => s.tables);
  const relations = useDBStore((s) => s.relations);
  const selectedRelationId = useDBStore((s) => s.selectedRelationId);
  const selectRelation = useDBStore((s) => s.selectRelation);
  const viewport = useDBStore((s) => s.viewport);

  const TABLE_WIDTH = 260;
  const HEADER = 42;
  const ROW = 32;

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
        {/* RELATIONS */}
        <svg
          width="20000"
          height="20000"
          viewBox="0 0 20000 20000"
          className="absolute inset-0"
          style={{ zIndex: 50, overflow: "visible" }}
        >
          {relations.map((rel) => {
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

            const startSymbol =
              rel.cardinality === "many-to-many" ? "crow" : "bar";

            const endSymbol =
              rel.cardinality === "many-to-many" ||
              rel.cardinality === "one-to-many"
                ? "crow"
                : "bar";

            const stroke = "#3b82f6";
            const strokeWidth = selectedRelationId === rel.id ? 4 : 3;

            return (
              <g key={rel.id}>
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
                  d={
                    startSymbol === "crow"
                      ? crowFootPath(A.x, A.y, startAngle)
                      : barPath(A.x, A.y, startAngle)
                  }
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  fill="none"
                />

                <path
                  d={
                    endSymbol === "crow"
                      ? crowFootPath(B.x, B.y, endAngle)
                      : barPath(B.x, B.y, endAngle)
                  }
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
              </g>
            );
          })}
        </svg>

        {/* TABLES */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 100 }}
        >
          {tables.map((t) => (
            <TableNode key={t.id} table={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
