import { useDBStore } from "../store/dbStore";
import { generateSQL } from "../lib/sqlgenerator";
import { useEffect, useRef } from "react";

export default function SqlPanel({ open, onClose }) {
  const tables = useDBStore((s) => s.tables);
  const relations = useDBStore((s) => s.relations);

  const panelRef = useRef<HTMLDivElement | null>(null);

  const sql = generateSQL(tables, relations);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (open) {
      window.addEventListener("mousedown", onClick);
    }

    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!open) return null;

  const downloadSQL = () => {
    const blob = new Blob([sql], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "schema.sql";
    a.click();
  };

  const copySQL = () => {
    navigator.clipboard.writeText(sql);
    alert("SQL copied!");
  };

  return (
    <div
      className="fixed top-0 right-0 h-full w-[450px] bg-white border-l shadow-xl p-4 overflow-y-auto z-[999]"
      ref={panelRef}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Generated SQL</h2>
        <button onClick={onClose} className="text-sm text-red-600">Close</button>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={copySQL}
          className="px-3 py-1 bg-gray-200 rounded text-sm"
        >
          Copy
        </button>
        <button
          onClick={downloadSQL}
          className="px-3 py-1 bg-gray-200 rounded text-sm"
        >
          Download
        </button>
      </div>

      <pre className="bg-gray-900 text-green-300 p-3 rounded text-xs whitespace-pre-wrap overflow-auto">
{sql}
      </pre>
    </div>
  );
}
