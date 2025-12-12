import { useRef, useState } from "react";
import { useEffect } from "react";
import "./index.css";

import Canvas from "./components/canvas/Canvas";
import MiniMap from "./components/Minimap";
import SQLDrawer from "./components/SqlDrawer";
import SnipOverlay from "./components/SnipOverlay";


import { useDBStore } from "./store/dbStore";
import { saveProject, importProject } from "./lib/projectIO";


function App() {
  const addTable = useDBStore((s) => s.addTable);
  const viewport = useDBStore((s) => s.viewport);
  const deleteSelected = useDBStore((s) => s.deleteSelected);
  const selected = useDBStore((s) => s.selected);

  const relations = useDBStore((s) => s.relations);
  const selectedRelationId = useDBStore((s) => s.selectedRelationId);
  const selectedRelation = relations.find((r) => r.id === selectedRelationId);

  const updateRelationCardinality = useDBStore((s) => s.updateRelationCardinality);
  const deleteRelation = useDBStore((s) => s.deleteRelation);

  const [sqlOpen, setSqlOpen] = useState(false);


  /* -------------------------------------------------------
     DELETE key handler
  -------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete") {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected]);

  /* -------------------------------------------------------
     PAN (middle mouse OR background drag)
  -------------------------------------------------------- */
  const handlePointerDown = (e: React.PointerEvent) => {
    const isMiddle = e.button === 1;
    const target = e.target as HTMLElement;
    const onTable = target.closest(".table-node") !== null;

    // Only pan if middle click OR background click
    if (!isMiddle && onTable) return;

    const store = useDBStore.getState();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = store.viewport.x;
    const initialY = store.viewport.y;

    const move = (ev: PointerEvent) => {
      store.setViewport(
        initialX + (ev.clientX - startX),
        initialY + (ev.clientY - startY)
      );
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* -------------------------------------------------------
     ZOOM (cursor centered — Figma style)
  -------------------------------------------------------- */
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const store = useDBStore.getState();

    const intensity = 0.05; // INCREASED from 0.0015 → stronger zoom
    const direction = e.deltaY > 0 ? -1 : 1;

    const factor = 1 + direction * intensity;
    const newScale = Math.min(4, Math.max(0.2, store.viewport.scale * factor));

    store.setScale(newScale, e.clientX, e.clientY);
  };

  // Undo - Redo

  const undo = useDBStore((s) => s.undo);
  const redo = useDBStore((s) => s.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") undo();
      if (e.ctrlKey && e.key === "y") redo();
      if (e.ctrlKey && e.key === "Shift" && e.key === "Z") redo();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [showSQL, setShowSQL] = useState(false);

  const [snipOpen, setSnipOpen] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".dbb")) {
      await importProject(file);
      alert("Project loaded.");
    }
  };

  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);


  return (
    <div className="w-full h-screen flex flex-col bg-background text-foreground">

      {/* --------------------- TOP NAV --------------------- */}
      <header className="h-14 px-6 border-b bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            DB
          </div>
          <span className="font-semibold">DB-Builder</span>
        </div>

        <select className="border rounded-md px-3 py-1 text-sm bg-white shadow-sm">
          <option>PostgreSQL</option>
          <option>MySQL</option>
          <option>SQLite</option>
        </select>
      </header>

      {/* ---------------------- MAIN ----------------------- */}
      <main
        className="flex-1 relative overflow-hidden"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Background grid */}
        <div
          className="
            absolute inset-0 pointer-events-none 
            bg-[radial-gradient(circle,#d4d4d466_1px,transparent_0)]
            [background-size:20px_20px]
          "
        />

        {/* INFINITE CANVAS WRAPPER (NO OFFSETS — PURE VIEWPORT) */}
        <div
          className="absolute"
          id="diagram-root"
          ref={canvasWrapperRef}
          style={{
            width: "20000px",
            height: "20000px",
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: "0 0",
          }}
        >
          <Canvas />
        </div>
      </main>

      {/* --------------------- TOOLBAR --------------------- */}
      {!snipOpen && (
        <><div
          style={{ zIndex: 999 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border shadow-lg px-6 py-3 rounded-full flex items-center gap-3"
        >
          <button onClick={() => addTable()} className="text-sm">
            ➕ Table
          </button>

          <button
            onClick={() => deleteSelected()}
            disabled={selected.length === 0}
            className={`text-sm ${selected.length === 0 ? "opacity-40 cursor-not-allowed" : ""
              }`}
          >
            🗑️ Delete
          </button>

          <button className="text-sm">🔗 Relation</button>
          <button className="text-sm">🖼️ Upload</button>

          <button
            className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm shadow hover:opacity-90"
            onClick={() => useDBStore.getState().setSQLDrawerOpen(true)}
          >
            Build SQL
          </button>


          {/* RELATION EDITOR */}
          {selectedRelationId && selectedRelation && (
            <div className="flex items-center gap-2 border-l pl-4 ml-4">
              <span className="text-sm text-gray-600">Cardinality:</span>

              <button
                className={`px-2 py-1 rounded text-xs ${selectedRelation.cardinality === "one-to-one"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
                  }`}
                onClick={() =>
                  updateRelationCardinality(selectedRelationId, "one-to-one", false)
                }
              >
                1—1
              </button>

              <button
                className={`px-2 py-1 rounded text-xs ${selectedRelation.cardinality === "one-to-many"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
                  }`}
                onClick={() =>
                  updateRelationCardinality(selectedRelationId, "one-to-many", false)
                }
              >
                1—N
              </button>

              <button
                title="Flip direction (N—1)"
                className="px-2 py-1 rounded text-xs bg-gray-200"
                onClick={() =>
                  updateRelationCardinality(selectedRelationId, "one-to-many", true)
                }
              >
                N—1
              </button>

              <button
                className={`px-2 py-1 rounded text-xs ${selectedRelation.cardinality === "many-to-many"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
                  }`}
                onClick={() =>
                  updateRelationCardinality(selectedRelationId, "many-to-many", false)
                }
              >
                N—N
              </button>

              <button
                className="px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                onClick={() => {
                  if (!confirm("Delete this relation?")) return;
                  deleteRelation(selectedRelationId);
                }}
              >
                Delete Relation
              </button>
            </div>
          )}
          {/* ZOOM SLIDER */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-gray-500">Zoom:</span>

            <input
              type="range"
              min="0.2"
              max="4"
              step="0.01"
              value={viewport.scale}
              onChange={(e) => {
                const store = useDBStore.getState();
                const sliderScale = Number(e.target.value);

                // zoom centered on screen center
                const rect = document.body.getBoundingClientRect();
                const cx = rect.width / 2;
                const cy = rect.height / 2;

                store.setScale(sliderScale, cx, cy);
              }}
              className="w-32"
            />

            <span className="text-xs w-12 text-right">{Math.round(viewport.scale * 100)}%</span>
            <button onClick={() => undo()}>↶ Undo</button>
            <button onClick={() => redo()}>↷ Redo</button>
            <button onClick={saveProject} className="text-sm">
              💾 Save
            </button>

            <input
              type="file"
              accept=".dbb"
              className="hidden"
              id="import-project"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await importProject(file);
              }}
            />

            <label htmlFor="import-project" className="text-sm cursor-pointer">
              📂 Load
            </label>

            <button onClick={() => setSnipOpen(true)}>
              📸 Export Image
            </button>

          </div>
        </div>
          <MiniMap />
        </>)}
      {snipOpen && <SnipOverlay onClose={() => setSnipOpen(false)} />}

      <SQLDrawer />

    </div>
  );
}

export default App;
