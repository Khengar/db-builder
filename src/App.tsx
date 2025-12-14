import { useRef, useState, useEffect } from "react";
import "./index.css";

// Components
import Canvas from "./components/canvas/Canvas";
import MiniMap from "./components/Minimap";
import SQLDrawer from "./components/SqlDrawer";
import SnipOverlay from "./components/SnipOverlay";

// Store & Lib
import { useDBStore } from "./store/dbStore";
import { saveProject, importProject } from "./lib/projectIO";

// Icons for the Figma/Miro look
import { 
  Plus, 
  Trash2, 
  Database, 
  Camera, 
  Save, 
  FolderOpen, 
  Undo2, 
  Redo2, 
  MousePointer2,
  Settings2,
  X,
  Share2,
  Check
} from "lucide-react";

function App() {
  // --- STATE & STORE (Kept exactly as original) ---
  const addTable = useDBStore((s) => s.addTable);
  const viewport = useDBStore((s) => s.viewport);
  const deleteSelected = useDBStore((s) => s.deleteSelected);
  const selected = useDBStore((s) => s.selected);

  const relations = useDBStore((s) => s.relations);
  const selectedRelationId = useDBStore((s) => s.selectedRelationId);
  const selectedRelation = relations.find((r) => r.id === selectedRelationId);

  const updateRelationCardinality = useDBStore((s) => s.updateRelationCardinality);
  const deleteRelation = useDBStore((s) => s.deleteRelation);

  const undo = useDBStore((s) => s.undo);
  const redo = useDBStore((s) => s.redo);
  
  const [snipOpen, setSnipOpen] = useState(false);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  /* -------------------------------------------------------
     KEYBOARD HANDLERS
  -------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Delete
      if (e.key === "Delete") {
        e.preventDefault();
        deleteSelected();
      }
      // Undo/Redo
      if (e.ctrlKey && e.key === "z") undo();
      if (e.ctrlKey && e.key === "y") redo();
      if (e.ctrlKey && e.key === "Shift" && e.key === "Z") redo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, undo, redo]);

  /* -------------------------------------------------------
     PAN (Middle Mouse / Space Drag simulation)
  -------------------------------------------------------- */
  const handlePointerDown = (e: React.PointerEvent) => {
    const isMiddle = e.button === 1;
    const target = e.target as HTMLElement;
    const onTable = target.closest(".table-node") !== null;

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
     ZOOM (Figma Style)
  -------------------------------------------------------- */
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const store = useDBStore.getState();
    const intensity = 0.05;
    const direction = e.deltaY > 0 ? -1 : 1;
    const factor = 1 + direction * intensity;
    const newScale = Math.min(4, Math.max(0.2, store.viewport.scale * factor));
    store.setScale(newScale, e.clientX, e.clientY);
  };

  /* -------------------------------------------------------
     DRAG & DROP FILE
  -------------------------------------------------------- */
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".dbb")) {
      await importProject(file);
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-[#09090b] text-zinc-100 font-sans selection:bg-violet-500/30 relative flex flex-col">
      
      {/* ---------------------- 1. MAIN CANVAS AREA ----------------------- */}
      <main
        className="absolute inset-0 z-0 overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Modern Dot Grid Background */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"></div>

        {/* The Infinite Canvas Wrapper */}
        <div
          className="absolute"
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

      {/* ---------------------- 2. UI LAYERS (Floating) ----------------------- */}

      {/* --- TOP LEFT: Project & File Menu --- */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-xl shadow-xl">
          <div className="h-6 w-6 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-md flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Database size={14} className="text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">
            DB-Builder <span className="text-zinc-500 font-normal">/ Project</span>
          </span>
        </div>

        {/* File Actions */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-xl shadow-xl">
          <ControlButton onClick={saveProject} icon={<Save size={16} />} tooltip="Save Project" />
          
          <label className="cursor-pointer">
            <input type="file" accept=".dbb" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await importProject(file);
              }} 
            />
            <div className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
              <FolderOpen size={16} />
            </div>
          </label>

          <ControlButton onClick={() => setSnipOpen(true)} icon={<Camera size={16} />} tooltip="Export Image" />
        </div>
      </div>

      {/* --- TOP RIGHT: Inspector / Properties Panel --- */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-3 items-end">
        
        {/* 1. Global DB Settings (Always Visible) */}
        <div className="px-3 py-2 bg-zinc-900/80 backdrop-blur-md border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-xl shadow-xl flex items-center gap-2 transition-all duration-200 group">
           <Settings2 size={14} className="text-zinc-600 group-hover:text-zinc-500 transition-colors" />
           <select className="bg-transparent border-none outline-none text-xs font-medium text-zinc-400 group-hover:text-zinc-300 cursor-pointer transition-colors">
              <option className="bg-zinc-900 text-zinc-400">PostgreSQL</option>
              <option className="bg-zinc-900 text-zinc-400">MySQL</option>
              <option className="bg-zinc-900 text-zinc-400">SQLite</option>
            </select>
        </div>

        {/* 2. Contextual Editor: Only shows when a RELATION is selected */}
        {selectedRelationId && selectedRelation && (
          <div className="w-64 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/5">
              <span className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">Relationship</span>
              <button onClick={() => deleteRelation(selectedRelationId)} className="text-red-400 hover:text-red-300 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase text-zinc-500 font-bold">Cardinality</label>
                <div className="grid grid-cols-2 gap-2">
                  <CardinalityBtn 
                    label="1 — 1" 
                    active={selectedRelation.cardinality === "one-to-one"} 
                    onClick={() => updateRelationCardinality(selectedRelationId, "one-to-one", false)} 
                  />
                  <CardinalityBtn 
                    label="1 — N" 
                    active={selectedRelation.cardinality === "one-to-many" && !selectedRelation.isOneToManyReversed} 
                    onClick={() => updateRelationCardinality(selectedRelationId, "one-to-many", false)} 
                  />
                  <CardinalityBtn 
                    label="N — 1" 
                    active={selectedRelation.cardinality === "one-to-many" && selectedRelation.isOneToManyReversed} 
                    onClick={() => updateRelationCardinality(selectedRelationId, "one-to-many", true)} 
                  />
                  <CardinalityBtn 
                    label="N — N" 
                    active={selectedRelation.cardinality === "many-to-many"} 
                    onClick={() => updateRelationCardinality(selectedRelationId, "many-to-many", false)} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- BOTTOM CENTER: The "Dock" (Main Tools) --- */}
      {!snipOpen && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-1 p-2 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl ring-1 ring-black/50">
            
            <DockButton 
              onClick={() => addTable()} 
              icon={<Plus size={20} />} 
              label="Add Table" 
              hotkey="T"
            />
            
            <div className="w-px h-8 bg-white/10 mx-1"></div>

            <DockButton 
              onClick={undo} 
              icon={<Undo2 size={18} />} 
              label="Undo" 
              hotkey="Ctrl+Z"
            />
             <DockButton 
              onClick={redo} 
              icon={<Redo2 size={18} />} 
              label="Redo" 
              hotkey="Ctrl+Y"
            />

            <div className="w-px h-8 bg-white/10 mx-1"></div>

            <DockButton 
              onClick={() => deleteSelected()} 
              icon={<Trash2 size={18} />} 
              label="Delete" 
              disabled={selected.length === 0}
              danger
            />

            <div className="w-px h-8 bg-white/10 mx-1"></div>

            <button 
              onClick={() => useDBStore.getState().setSQLDrawerOpen(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-violet-900/20 flex items-center gap-2"
            >
              <Share2 size={16} />
              <span>Build SQL</span>
            </button>
          </div>
        </div>
      )}

      {/* --- BOTTOM RIGHT: Navigation & Zoom --- */}
      {!snipOpen && (
        <div className="absolute bottom-8 right-8 z-40 flex flex-col items-end gap-4 pointer-events-none">
          {/* MiniMap Container - Pointer events allowed inside */}
          <div className="pointer-events-auto rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/90 w-48 h-32">
             <MiniMap />
          </div>

          {/* Zoom Controls */}
          <div className="pointer-events-auto flex items-center gap-3 px-3 py-2 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full shadow-xl">
             <span className="text-xs font-mono text-zinc-400 w-12 text-center">
                {Math.round(viewport.scale * 100)}%
             </span>
             <input
                type="range"
                min="0.2"
                max="4"
                step="0.01"
                value={viewport.scale}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const rect = document.body.getBoundingClientRect();
                  useDBStore.getState().setScale(val, rect.width / 2, rect.height / 2);
                }}
                className="w-24 accent-violet-500 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
          </div>
        </div>
      )}

      {/* --- OVERLAYS --- */}
      {snipOpen && <SnipOverlay onClose={() => setSnipOpen(false)} />}
      <SQLDrawer />
      
    </div>
  );
}

// --- SUB-COMPONENTS for the UI ---

const ControlButton = ({ onClick, icon, tooltip }: { onClick: () => void, icon: any, tooltip: string }) => (
  <button 
    onClick={onClick} 
    title={tooltip}
    className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
  >
    {icon}
  </button>
);

const DockButton = ({ onClick, icon, label, hotkey, disabled, danger }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`
      group relative flex items-center justify-center p-3 rounded-xl transition-all
      ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'}
      ${danger ? 'hover:text-red-400' : 'hover:text-violet-300'}
    `}
  >
    <div className={`text-zinc-400 ${!disabled && (danger ? 'group-hover:text-red-400' : 'group-hover:text-violet-300')}`}>
      {icon}
    </div>
    
    {/* Tooltip */}
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
      {label} {hotkey && <span className="opacity-50 ml-1">({hotkey})</span>}
    </div>
  </button>
);

const CardinalityBtn = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`
      px-3 py-2 text-xs font-medium rounded-lg border transition-all
      ${active 
        ? 'bg-violet-500/20 border-violet-500 text-violet-200' 
        : 'bg-zinc-800 border-transparent text-zinc-400 hover:bg-zinc-700 hover:text-white'
      }
    `}
  >
    {label}
  </button>
);

export default App;