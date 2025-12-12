import React, { useRef, useState } from "react";
import { useDBStore, type DBTable } from "../../store/dbStore";
import { X } from "lucide-react";

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
    const activeLink = useDBStore((s) => s.activeLink);

    const toggleColumnFlag = useDBStore((s) => s.toggleColumnFlag);

    const GRID = 20;
    const snap = (value) => Math.round(value / GRID) * GRID;

    // selection
    const selectTable = useDBStore((s) => s.selectTable);
    const selected = useDBStore((s) => s.selected);
    const removeTable = useDBStore((s) => s.removeTable);

    const isSelected = selected.includes(table.id);

    const nodeRef = useRef<HTMLDivElement | null>(null);

    // title editing
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

    const cancelEditing = () => {
        setEditing(false);
        setTempName(table.name);
    };

    // select on pointer down (before drag)
    const onAnyPointerDown = (e: React.PointerEvent) => {
        const additive = e.shiftKey;
        selectTable(table.id, additive);
        // do not stop propagation — let drag logic proceed
    };

    // DRAG only when user drags the BODY (not header)
    const onBodyPointerDown = (e: React.PointerEvent) => {
        if (editing) return;

        useDBStore.getState().recordHistory();

        const target = e.target as HTMLElement;
        if (target.closest("input,select,button,textarea")) return;

        const startX = e.clientX;
        const startY = e.clientY;

        const initialX = table.x;
        const initialY = table.y;

        nodeRef.current?.setPointerCapture(e.pointerId);

        const move = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;

            const newX = snap(initialX + dx);
            const newY = snap(initialY + dy);

            updatePos(table.id, newX, newY);
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
            className={`pointer-events-auto
 absolute w-90 rounded-md border bg-white shadow select-none table-node ${isSelected ? "ring-2 ring-blue-500" : ""
                }`}
            style={{ left: table.x, top: table.y}}
            onPointerDown={onAnyPointerDown}
        >
            {/* HEADER — double click to edit */}
            <div className="border-b px-3 py-2 text-sm bg-gray-100 font-semibold flex items-center justify-between pointer-events-auto">
                <span onDoubleClick={startEditing} className="cursor-text">
                    {editing ? (
                        <input
                            ref={inputRef}
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onBlur={finishEditing}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") finishEditing();
                                if (e.key === "Escape") cancelEditing();
                            }}
                            className="border rounded px-1 py-0.5 text-xs w-full bg-white"
                        />
                    ) : (
                        table.name
                    )}
                </span>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm("Delete this table?")) return;
                        removeTable(table.id);
                    }}
                    className="text-red-500 hover:text-red-700 text-xs ml-2 pointer-events-auto"
                    title="Delete table"
                >
                    ✕
                </button>
            </div>

            {/* BODY — drag zone */}
            <div className="p-2 space-y-2 cursor-grab active:cursor-grabbing pointer-events-auto" onPointerDown={onBodyPointerDown}>
                {table.columns.map((col) => (
                    <div key={col.id} className="flex items-center gap-2 pointer-events-auto">
                        <button
                            type="button"
                            className="h-2 w-2 rounded-full bg-blue-500 hover:bg-blue-600 pointer-events-auto"
                            onClick={(e) => {
                                e.stopPropagation();

                                const current = useDBStore.getState().activeLink;

                                if (current) {
                                    commitRelation(table.id, col.id);
                                } else {
                                    startRelation(table.id, col.id);
                                }
                            }}
                        ></button>

                        <input
                            value={col.name}
                            onChange={(e) => updateColumn(table.id, col.id, "name", e.target.value)}
                            className="border rounded px-2 py-1 text-xs w-24 pointer-events-auto"
                        />

                        <select
                            value={col.type}
                            onChange={(e) => updateColumn(table.id, col.id, "type", e.target.value)}
                            className="border rounded px-1 py-1 text-xs pointer-events-auto"
                        >
                            <option value="text">text</option>
                            <option value="int">int</option>
                            <option value="uuid">uuid</option>
                            <option value="date">date</option>
                        </select>
                        <button
                            className={`text-xs px-1 rounded ${col.isPrimary ? "bg-yellow-300" : "bg-gray-200"}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleColumnFlag(table.id, col.id, "isPrimary");
                            }}
                        >
                            PK
                        </button>

                        {col.isForeign && (
                            <span className="text-[10px] px-1 py-[1px] rounded bg-gray-200 border border-gray-300">
                                FK
                            </span>
                        )}

                        <button
                            className={`text-xs px-1 rounded ${col.isUnique ? "bg-blue-300" : "bg-gray-200"}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleColumnFlag(table.id, col.id, "isUnique");
                            }}
                        >
                            UQ
                        </button>

                        <button
                            className={`text-xs px-1 rounded ${col.isNullable ? "bg-green-300" : "bg-gray-200"}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleColumnFlag(table.id, col.id, "isNullable");
                            }}
                        >
                            NULL
                        </button>

                        <button className="pointer-events-auto text-red-500 hover:text-red-700" onClick={() => removeColumn(table.id, col.id)}>
                            <X size={14} />
                        </button>
                    </div>
                ))}

                <button onClick={() => addColumn(table.id)} className="pointer-events-auto text-xs text-blue-600 hover:underline">
                    + Add Column
                </button>
            </div>
        </div>
    );
}
