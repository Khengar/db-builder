import React, { useRef, useState } from "react";
import { useDBStore, type DBTable } from "../../store/dbStore";
import { X, Key, Fingerprint, Plus } from "lucide-react";

interface Props {
  table: DBTable;
}

export default function TableNode({ table }: Props) {
  const updatePos = useDBStore((s) => s.updateTablePosition);
  const addColumn = useDBStore((s) => s.addColumn);
  const updateColumn = useDBStore((s) => s.updateColumn);
  const removeColumn = useDBStore((s) => s.removeColumn);
  const renameTable = useDBStore((s) => s.renameTable);
  const startRelation = useDBStore((s) => s.startRelation);
  const commitRelation = useDBStore((s) => s.commitRelation);
  const removeTable = useDBStore((s) => s.removeTable);
  const toggleColumnFlag = useDBStore((s) => s.toggleColumnFlag);
  
  // Selection
  const selectTable = useDBStore((s) => s.selectTable);
  const selected = useDBStore((s) => s.selected);
  const isSelected = selected.includes(table.id);

  const GRID = 20;
  const snap = (value: number) => Math.round(value / GRID) * GRID;
  const nodeRef = useRef<HTMLDivElement | null>(null);

  // Title Editing
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState(table.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const startEditing = () => {
    setEditing(true);
    setTempName(table.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const finishEditing = () => {
    setEditing(false);
    renameTable(table.id, tempName.trim() || "table");
  };

  // 1. STOP PROPAGATION on click so we select the table but don't drag the canvas
  const onAnyPointerDown = (e: React.PointerEvent) => {
    const additive = e.shiftKey;
    selectTable(table.id, additive);
  };

  const onBodyPointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    
    const target = e.target as HTMLElement;
    // Prevent dragging if clicking inputs/selects
    if (target.closest("input,select,button,textarea")) {
        return;
    }

    // 2. ONLY Drag if we are clicking the header/body background
    useDBStore.getState().recordHistory();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = table.x;
    const initialY = table.y;

    nodeRef.current?.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      updatePos(table.id, snap(initialX + dx), snap(initialY + dy));
    };

    const up = () => {
      nodeRef.current?.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={nodeRef}
      onPointerDown={onAnyPointerDown}
      className={`
        table-node pointer-events-auto cursor-default
        absolute w-80 rounded-xl bg-[#18181b] border shadow-2xl transition-shadow duration-200
        flex flex-col overflow-hidden z-10
        ${isSelected 
          ? "border-violet-500 ring-2 ring-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.2)]" 
          : "border-white/10 hover:border-white/20"
        }
      `}
      style={{ left: table.x, top: table.y }}
    >
      {/* --- HEADER --- */}
      <div 
        className="h-10 bg-zinc-900/50 border-b border-white/5 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing group"
        onPointerDown={onBodyPointerDown}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1 rounded bg-gradient-to-br from-violet-600 to-indigo-600">
             <div className="w-2 h-2 bg-white rounded-full opacity-80" />
          </div>
          
          <div className="flex-1 min-w-0" onDoubleClick={startEditing}>
             {editing ? (
               <input
                 ref={inputRef}
                 value={tempName}
                 onChange={(e) => setTempName(e.target.value)}
                 onBlur={finishEditing}
                 onKeyDown={(e) => e.key === "Enter" && finishEditing()}
                 onPointerDown={(e) => e.stopPropagation()} 
                 className="bg-black/50 text-white text-sm font-semibold w-full px-1 rounded outline-none border border-violet-500/50"
               />
             ) : (
               <span className="text-sm font-semibold text-zinc-100 truncate block hover:text-white transition-colors">
                 {table.name}
               </span>
             )}
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!confirm("Delete table?")) return;
            removeTable(table.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-400"
        >
          <X size={14} />
        </button>
      </div>

      {/* --- COLUMNS --- */}
      <div className="p-2 space-y-1 bg-[#18181b] cursor-default">
        {table.columns.map((col) => (
          <div 
            key={col.id} 
            className="group flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors relative"
          >
            {/* Connection Port */}
            <button
              className="w-3 h-3 rounded-full border-2 border-zinc-600 bg-zinc-900 hover:border-violet-400 hover:bg-violet-400 transition-all flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                const current = useDBStore.getState().activeLink;
                if (current) commitRelation(table.id, col.id);
                else startRelation(table.id, col.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Connect Relation"
            />

            {/* Column Name */}
            <input
              value={col.name}
              onChange={(e) => updateColumn(table.id, col.id, "name", e.target.value)}
              className="bg-transparent text-zinc-300 text-xs font-medium w-full outline-none focus:text-white placeholder:text-zinc-600 cursor-text"
              placeholder="col_name"
              onPointerDown={(e) => e.stopPropagation()} 
            />

            {/* Column Type */}
            <select
              value={col.type}
              onChange={(e) => updateColumn(table.id, col.id, "type", e.target.value)}
              className="bg-transparent text-zinc-500 text-[10px] uppercase font-bold outline-none cursor-pointer hover:text-violet-400 text-right w-16 appearance-none"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <option className="bg-zinc-900 text-zinc-300" value="int">INT</option>
              <option className="bg-zinc-900 text-zinc-300" value="text">TEXT</option>
              <option className="bg-zinc-900 text-zinc-300" value="uuid">UUID</option>
              <option className="bg-zinc-900 text-zinc-300" value="date">DATE</option>
              <option className="bg-zinc-900 text-zinc-300" value="bool">BOOL</option>
              <option className="bg-zinc-900 text-zinc-300" value="json">JSON</option>
            </select>

            {/* Flags */}
            <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
               <button
                 onClick={() => toggleColumnFlag(table.id, col.id, "isPrimary")}
                 className={`p-1 rounded ${col.isPrimary ? "text-amber-400 bg-amber-400/10" : "text-zinc-700 hover:text-zinc-500"}`}
                 title="Primary Key"
               >
                 <Key size={10} />
               </button>

               <button
                 onClick={() => toggleColumnFlag(table.id, col.id, "isUnique")}
                 className={`p-1 rounded ${col.isUnique ? "text-blue-400 bg-blue-400/10" : "text-zinc-700 hover:text-zinc-500"}`}
                 title="Unique"
               >
                 <Fingerprint size={10} />
               </button>

               <button
                 onClick={() => toggleColumnFlag(table.id, col.id, "isNullable")}
                 className={`px-1 rounded text-[9px] font-bold transition-colors ${col.isNullable ? "text-emerald-400 bg-emerald-400/10" : "text-zinc-700 hover:text-zinc-500"}`}
                 title="Nullable"
               >
                 ?
               </button>
            </div>

            {/* Remove Column */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                removeColumn(table.id, col.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Add Column Action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            addColumn(table.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full flex items-center gap-2 px-2 py-1.5 mt-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded transition-colors"
        >
          <Plus size={12} />
          <span>Add Column</span>
        </button>
      </div>
    </div>
  );
}