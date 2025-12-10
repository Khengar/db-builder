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

    // DRAG only when user drags the BODY (not header)
    const onBodyPointerDown = (e: React.PointerEvent) => {
        if (editing) return;

        const target = e.target as HTMLElement;
        if (target.closest("input,select,button,textarea")) return;

        const startX = e.clientX;
        const startY = e.clientY;

        const initialX = table.x;
        const initialY = table.y;

        nodeRef.current?.setPointerCapture(e.pointerId);

        const move = (ev: PointerEvent) => {
            updatePos(table.id, initialX + (ev.clientX - startX), initialY + (ev.clientY - startY));
        };

        const up = () => {
            nodeRef.current?.releasePointerCapture(e.pointerId);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };

        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
    };
    // console.log("CLICK RELATION HANDLE", { tableId: table.id, colId: col.id, activeLink });

    return (
        <div
            ref={nodeRef}
            className="absolute w-56 rounded-md border bg-white shadow select-none"
            style={{ left: table.x, top: table.y }}
        >
            {/* HEADER — double click to edit */}
            <div
                className="border-b px-3 py-2 text-sm bg-gray-100 font-semibold cursor-text"
                onDoubleClick={startEditing}
            >
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
            </div>

            {/* BODY — drag zone */}
            <div
                className="p-2 space-y-2 cursor-grab active:cursor-grabbing"
                onPointerDown={onBodyPointerDown}
            >
                {table.columns.map((col) => (
                    <div key={col.id} className="flex items-center gap-2">
                        <button
  type="button"
  className="h-2 w-2 rounded-full bg-blue-500 hover:bg-blue-600"
  onClick={(e) => {
    e.stopPropagation();

    const current = useDBStore.getState().activeLink;

    console.log("CLICK", {
      tableId: table.id,
      colId: col.id,
      activeLink_before: current,
    });

    if (current) {
      commitRelation(table.id, col.id);
    } else {
      startRelation(table.id, col.id);
    }

    console.log(
      "activeLink_after",
      useDBStore.getState().activeLink
    );
  }}
></button>

                        <input
                            value={col.name}
                            onChange={(e) => updateColumn(table.id, col.id, "name", e.target.value)}
                            className="border rounded px-2 py-1 text-xs w-24"
                        />

                        <select
                            value={col.type}
                            onChange={(e) => updateColumn(table.id, col.id, "type", e.target.value)}
                            className="border rounded px-1 py-1 text-xs"
                        >
                            <option value="text">text</option>
                            <option value="int">int</option>
                            <option value="uuid">uuid</option>
                            <option value="date">date</option>
                        </select>

                        <button
                            className="text-red-500 hover:text-red-700"
                            onClick={() => removeColumn(table.id, col.id)}
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}

                <button
                    onClick={() => addColumn(table.id)}
                    className="text-xs text-blue-600 hover:underline"
                >
                    + Add Column
                </button>
            </div>
        </div>
    );
}
