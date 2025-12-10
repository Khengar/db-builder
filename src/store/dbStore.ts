import { create } from "zustand";
import { v4 as uuid } from "uuid";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

export interface Column {
  id: string;
  name: string;
  type: string;
}

export interface DBTable {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: Column[];
}

export interface Relation {
  id: string;
  from: { tableId: string; columnId: string };
  to: { tableId: string; columnId: string };
}

interface DBState {
  tables: DBTable[];
  relations: Relation[];
  activeLink: { tableId: string; columnId: string } | null;

  addTable: () => void;
  renameTable: (id: string, name: string) => void;

  addColumn: (tableId: string) => void;
  updateColumn: (
    tableId: string,
    columnId: string,
    key: string,
    value: string
  ) => void;
  removeColumn: (tableId: string, columnId: string) => void;

  updateTablePosition: (id: string, x: number, y: number) => void;

  startRelation: (tableId: string, columnId: string) => void;
  commitRelation: (tableId: string, columnId: string) => void;
  cancelRelation: () => void;
}

/* ─────────────────────────────────────────────
   Store
───────────────────────────────────────────── */

export const useDBStore = create<DBState>((set, get) => ({
  tables: [],
  relations: [],
  activeLink: null,

  /* ───── Create New Table ───── */
  addTable: () =>
    set((state) => ({
      tables: [
        ...state.tables,
        {
          id: uuid(),
          name: "new_table",
          x: 200 + Math.random() * 200,
          y: 150 + Math.random() * 150,
          columns: [],
        },
      ],
    })),

  /* ───── Rename Table ───── */
  renameTable: (id, name) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === id ? { ...t, name } : t
      ),
    })),

  /* ───── Manage Columns ───── */
  addColumn: (tableId) =>
  set((state) => ({
    tables: state.tables.map((t) =>
      t.id === tableId
        ? {
            ...t,
            columns: [
              ...t.columns,
              {
                id: uuid(),   // 🔥 REQUIRED
                name: "column_" + (t.columns.length + 1),
                type: "text",
              },
            ],
          }
        : t
    ),
  })),

  updateColumn: (tableId, columnId, key, value) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              columns: t.columns.map((c) =>
                c.id === columnId ? { ...c, [key]: value } : c
              ),
            }
          : t
      ),
    })),

  removeColumn: (tableId, columnId) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.filter((c) => c.id !== columnId) }
          : t
      ),
    })),

  /* ───── Drag Table ───── */
  updateTablePosition: (id, x, y) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === id ? { ...t, x, y } : t
      ),
    })),

  /* ───── Relations ───── */
  startRelation: (tableId, columnId) =>
    set({
      activeLink: { tableId, columnId },
    }),

  commitRelation: (tableId, columnId) =>
  set((state) => {
    if (!state.activeLink) return state;

    // prevent linking to itself
    if (
      state.activeLink.tableId === tableId &&
      state.activeLink.columnId === columnId
    ) {
      return { ...state, activeLink: null };
    }

    const newRelation = {
      id: uuid(),
      from: state.activeLink,
      to: { tableId, columnId },
    };

    return {
      ...state,
      relations: [...state.relations, newRelation],
      activeLink: null,
    };
  }),

  cancelRelation: () => set({ activeLink: null }),
}));
