import { useEffect } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-sql";  
import { generateSQL } from "../lib/sqlgenerator";
import { useDBStore } from "../store/dbStore";

export default function SQLDrawer() {
  const tables = useDBStore((s) => s.tables);
  const relations = useDBStore((s) => s.relations);
  const drawerOpen = useDBStore((s) => s.sqlDrawerOpen);
  const setDrawerOpen = useDBStore((s) => s.setSQLDrawerOpen);

  const sql = generateSQL(tables, relations);

  useEffect(() => {
    Prism.highlightAll();
  }, [sql, drawerOpen]);

  if (!drawerOpen) return null;

  const downloadSQL = () => {
    const blob = new Blob([sql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "schema.sql";
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40"
      onClick={() => setDrawerOpen(false)}
    >
      <aside
        className="absolute right-0 top-0 h-full w-[500px] bg-white shadow-xl border-l p-6 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Generated SQL</h2>

          <button
            onClick={() => setDrawerOpen(false)}
            className="text-gray-600 hover:text-black"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => navigator.clipboard.writeText(sql)}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Copy
          </button>

          <button
            onClick={downloadSQL}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Download
          </button>
        </div>

        <pre className="rounded-md bg-gray-900 text-gray-100 p-4 overflow-auto">
          <code className="language-sql">{sql}</code>
        </pre>
      </aside>
    </div>
  );
}
