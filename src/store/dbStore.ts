// src/store/dbStore.ts
import { create } from "zustand";
import { v4 as uuid } from "uuid";

/* Types (unchanged) */
export interface Column {
  id: string;
  name: string;
  type: string;

  // constraints
  isPrimary?: boolean;
  isForeign?: boolean;
  isUnique?: boolean;
  isNullable?: boolean;

  // if FK, this points to the referenced table/column
  references?: { tableId: string; columnId: string } | null;
}

export interface DBTable {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: Column[];
}

export type RelationCardinality = "one-to-one" | "one-to-many" | "many-to-many";

export interface Relation {
  id: string;
  from: { tableId: string; columnId: string };
  to: { tableId: string; columnId: string };
  cardinality?: RelationCardinality; // new
  deleteRule?: "cascade" | "set-null" | "restrict";
  updateRule?: "cascade" | "restrict";
}

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface DBState {
  tables: DBTable[];
  relations: Relation[];
  activeLink: { tableId: string; columnId: string } | null;

  viewport: Viewport;
  setViewport: (x: number, y: number) => void;
  setScale: (scale: number, cursorX: number, cursorY: number) => void;

  // selection
  selected: string[]; // array of selected tableIds
  selectTable: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  deleteSelected: () => void;

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

  removeTable: (tableId: string) => void;

  toggleColumnFlag: (
    tableId: string,
    columnId: string,
    flag: "isPrimary" | "isForeign" | "isUnique" | "isNullable"
  ) => void;

  updateRelationCardinality: (
    relationId: string,
    cardinality: RelationCardinality,
    reverse?: boolean
  ) => void;
  selectedRelationId: string | null;
  selectRelation: (id: string | null) => void;

  deleteRelation: (relationId: string) => void;

  deleteTable: (tableId: string) => void;
  history: {
    past: { tables: DBTable[]; relations: Relation[] }[];
    future: { tables: DBTable[]; relations: Relation[] }[];
  };

  undo: () => void;
  redo: () => void;
  recordHistory: () => void;

  sqlDrawerOpen: false,

}

function toSnake(s: string) {
  return s
    .trim()
    .replace(/([A-Z])/g, "_$1")
    .replace(/[\s\-]+/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function fkNameFor(refTableName: string, refColumnName: string) {
  // common convention: table_column (snake_case)
  return `${toSnake(refTableName)}_${toSnake(refColumnName)}`;
}

const GRID = 20;
const snap = (value: number) => Math.round(value / GRID) * GRID;

function smoothPan(targetX: number, targetY: number) {
  const store = useDBStore.getState();

  let startX = store.viewport.x;
  let startY = store.viewport.y;

  const duration = 200; // ms
  const startTime = performance.now();

  function frame(now: number) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out

    const newX = startX + (targetX - startX) * ease;
    const newY = startY + (targetY - startY) * ease;

    store.setViewport(newX, newY);

    if (t < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function makeFKName(parentTableName: string) {
  return `${parentTableName}_id`;
}

const MAX_HISTORY = 60;

export const useDBStore = create<DBState>((set, get) => {
  // helper deep clone with fallback
  const deepClone = <T,>(v: T): T => {
    // structuredClone is modern and preferable
    // fall back to JSON stringify/parse if not available
    // (works for our plain data structures)
    try {
      // @ts-ignore - structuredClone may not be in types in some environments
      if (typeof structuredClone === "function") {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return structuredClone(v);
      }
    } catch (e) {
      // ignore and fallback
    }
    return JSON.parse(JSON.stringify(v));
  };

  return {
    tables: [],
    relations: [],
    activeLink: null,

    viewport: { x: 0, y: 0, scale: 1 },

    // viewport
    setViewport: (x, y) => set((state) => ({ viewport: { ...state.viewport, x, y } })),

    setScale: (scale, cursorX, cursorY) =>
      set((state) => {
        const prev = state.viewport.scale;
        const clamped = Math.min(2.5, Math.max(0.25, scale));
        const ratio = clamped / prev;

        const newX = cursorX - (cursorX - state.viewport.x) * ratio;
        const newY = cursorY - (cursorY - state.viewport.y) * ratio;

        return { viewport: { x: newX, y: newY, scale: clamped } };
      }),

    // selection
    selected: [],
    selectTable: (id, additive = false) =>
      set((state) => {
        const exists = state.selected.includes(id);
        if (!additive) {
          // single select (replace)
          return { selected: [id] };
        } else {
          // additive: toggle
          if (exists) {
            return { selected: state.selected.filter((s) => s !== id) };
          } else {
            return { selected: [...state.selected, id] };
          }
        }
      }),
    clearSelection: () => set({ selected: [] }),
    deleteSelected: () => {
      const s = get();
      s.recordHistory();
      set((state) => {
        const toDelete = new Set(state.selected);
        const tables = state.tables.filter((t) => !toDelete.has(t.id));
        const relations = state.relations.filter(
          (r) => !toDelete.has(r.from.tableId) && !toDelete.has(r.to.tableId)
        );

        // clear activeLink if it referenced removed table
        const activeLink =
          state.activeLink && toDelete.has(state.activeLink.tableId)
            ? null
            : state.activeLink;

        return { tables, relations, activeLink, selected: [] };
      });
    },

    /* Create New Table */
    addTable: () => {
      const s = get();
      s.recordHistory();
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
      }));
    },

    renameTable: (id, name) => {
      const s = get();
      s.recordHistory();
      set((state) => ({ tables: state.tables.map((t) => (t.id === id ? { ...t, name } : t)) }));
    },

    addColumn: (tableId) => {
      const s = get();
      s.recordHistory();
      set((state) => ({
        tables: state.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                columns: [
                  ...t.columns,
                  {
                    id: uuid(),
                    name: "column_" + (t.columns.length + 1),
                    type: "text",
                    isNullable: true,
                  },
                ],
              }
            : t
        ),
      }));
    },

    updateColumn: (tableId, columnId, key, value) => {
      const s = get();
      s.recordHistory();

      set((state) => {
        // If user renames a column (key === "name"), we may need to update FK names that reference it
        const tables = state.tables.map((t) => {
          if (t.id !== tableId) return t;
          return {
            ...t,
            columns: t.columns.map((c) =>
              c.id === columnId ? { ...c, [key]: value } : c
            ),
          };
        });

        // Propagate rename to FK columns that reference this (only when renaming name)
        if (key === "name") {
          const updatedTables = tables.map((t) => {
            // iterate every table to find columns referencing (tableId, columnId)
            const newCols = t.columns.map((col) => {
              if (!col.references) return col;
              const { tableId: refTableId, columnId: refColumnId } = col.references;
              if (refTableId === tableId && refColumnId === columnId) {
                // compute new FK name based on new referenced name
                // find referenced table name
                const refTable = tables.find((x) => x.id === refTableId);
                const newFkName = refTable
                  ? fkNameFor(refTable.name, (tables.find((x) => x.id === refTableId)!.columns.find(c => c.id === refColumnId) || { name: value }).name)
                  : fkNameFor("", value);

                return { ...col, name: newFkName };
              }
              return col;
            });
            return { ...t, columns: newCols };
          });

          return { ...state, tables: updatedTables };
        }

        return { ...state, tables };
      });
    },

    removeColumn: (tableId, columnId) => {
      const s = get();
      s.recordHistory();
      set((state) => ({
        tables: state.tables.map((t) =>
          t.id === tableId ? { ...t, columns: t.columns.filter((c) => c.id !== columnId) } : t
        ),
      }));
    },

    updateTablePosition: (id, x, y) =>
      set((state) => ({
        tables: state.tables.map((t) =>
          t.id === id ? { ...t, x, y } : t
        ),
      })),

    startRelation: (tableId, columnId) => set({ activeLink: { tableId, columnId } }),

    commitRelation: (tableId, columnId) => {
      const s = get();
      s.recordHistory();
      set((state) => {
        if (!state.activeLink) return state;

        const A = state.activeLink;
        const B = { tableId, columnId };

        if (A.tableId === B.tableId && A.columnId === B.columnId) {
          return { ...state, activeLink: null };
        }

        const tableA = state.tables.find((t) => t.id === A.tableId);
        const tableB = state.tables.find((t) => t.id === B.tableId);
        if (!tableA || !tableB) return { ...state, activeLink: null };

        const pkA = tableA.columns.find((c) => c.isPrimary);
        const pkB = tableB.columns.find((c) => c.isPrimary);

        let parentTable, childTable;
        let parentEndpoint, childEndpoint;
        let parentPK;

        // CASE 1: A has PK → A is parent
        if (pkA) {
          parentTable = tableA;
          childTable = tableB;
          parentEndpoint = A;
          childEndpoint = B;
          parentPK = pkA;
        }
        // CASE 2: B has PK → B is parent
        else if (pkB) {
          parentTable = tableB;
          childTable = tableA;
          parentEndpoint = B;
          childEndpoint = A;
          parentPK = pkB;
        }
        // Neither has PK → require PK first
        else {
          console.warn("Relation requires at least one table to have a PK.");
          return { ...state, activeLink: null };
        }

        const fkName = makeFKName(parentTable.name);

        // Avoid duplicate FK
        const childHasFK = childTable.columns.some((c) => c.name === fkName);

        let updatedTables = state.tables.map((t) => {
          if (t.id !== childTable.id) return t;
          if (childHasFK) return t;

          return {
            ...t,
            columns: [
              ...t.columns,
              {
                id: uuid(),
                name: fkName,
                type: parentPK.type,
                isForeign: true,
                isNullable: true,
              },
            ],
          };
        });

        const newRelation = {
          id: uuid(),
          from: parentEndpoint,
          to: childEndpoint,
          cardinality: "one-to-many" as RelationCardinality,
          deleteRule: "restrict",
          updateRule: "cascade",
        };

        return {
          ...state,
          tables: updatedTables,
          relations: [...state.relations, newRelation],
          activeLink: null,
        };
      });
    },

    cancelRelation: () => set({ activeLink: null }),

    // removeTable: quick remove (keeps minimal behavior) — records history
    removeTable: (tableId) => {
      const s = get();
      s.recordHistory();
      set((state) => ({
        tables: state.tables.filter((t) => t.id !== tableId),
        relations: state.relations.filter((r) => r.from.tableId !== tableId && r.to.tableId !== tableId),
        activeLink: state.activeLink?.tableId === tableId ? null : state.activeLink,
        selected: state.selected.filter((s) => s !== tableId),
      }));
    },

    toggleColumnFlag: (
      tableId: string,
      columnId: string,
      flag: "isPrimary" | "isForeign" | "isUnique" | "isNullable"
    ) => {
      const s = get();
      s.recordHistory();
      set((state) => ({
        tables: state.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                columns: t.columns.map((c) =>
                  c.id === columnId ? { ...c, [flag]: !c[flag] } : c
                ),
              }
            : t
        ),
      }));
    },

    selectedRelationId: null,

    selectRelation: (id) => set({ selectedRelationId: id }),

    updateRelationCardinality: (relationId, cardinality, reverse = false) => {
      const s = get();
      s.recordHistory();
      set((state) => {
        // find relation
        const relIndex = state.relations.findIndex((r) => r.id === relationId);
        if (relIndex === -1) return state;

        // make shallow copies
        const relations = state.relations.map((r) => ({ ...r }));
        const relation = { ...relations[relIndex] };

        // optionally reverse endpoints (user chose N->1)
        if (reverse) {
          const tmp = relation.from;
          relation.from = relation.to;
          relation.to = tmp;
        }

        const oldCard = relation.cardinality;
        relation.cardinality = cardinality;

        // update relations array
        relations[relIndex] = relation;

        // shallow copy tables for mutation
        let tables = state.tables.map((t) => ({ ...t, columns: t.columns.slice() }));

        // helper to remove FK columns that reference a given target (tableId, columnId)
        const removeFKReferencing = (targetTableId: string, targetColumnId: string) => {
          tables = tables.map((t) => {
            const cols = t.columns.filter(
              (c) =>
                !(c.references && c.references.tableId === targetTableId && c.references.columnId === targetColumnId)
            );
            return { ...t, columns: cols };
          });
        };

        // helper to ensure FK exists on a target table referencing source col
        const ensureFKOn = (sourceTableId: string, sourceColumnId: string, targetTableId: string) => {
          const sourceTable = tables.find((x) => x.id === sourceTableId);
          const targetTable = tables.find((x) => x.id === targetTableId);
          if (!sourceTable || !targetTable) return;

          const sourceCol = sourceTable.columns.find((c) => c.id === sourceColumnId);
          if (!sourceCol) return;

          // check duplicate
          const exists = targetTable.columns.some(
            (c) =>
              c.references &&
              c.references.tableId === sourceTableId &&
              c.references.columnId === sourceColumnId
          );
          if (exists) return;

          const candidateFkName = fkNameFor(sourceTable.name, sourceCol.name);

          const fkCol = {
            id: uuid(),
            name: candidateFkName,
            type: sourceCol.type || "text",
            isPrimary: false,
            isUnique: false,
            isNullable: true, // default nullable; change if you prefer NOT NULL
            isForeign: true,
            references: { tableId: sourceTableId, columnId: sourceColumnId },
          } as Column;

          targetTable.columns = [...targetTable.columns, fkCol];
          tables = tables.map((t) => (t.id === targetTable.id ? targetTable : t));
        };

        // CLEANUP/REBALANCE rules depending on cardinality
        const from = relation.from;
        const to = relation.to;

        // remove any FK referencing from or to (clean slate)
        removeFKReferencing(from.tableId, from.columnId);
        removeFKReferencing(to.tableId, to.columnId);

        if (cardinality === "one-to-many") {
          // ensure FK on child (to)
          ensureFKOn(from.tableId, from.columnId, to.tableId);
        } else if (cardinality === "one-to-one") {
          // place FK on 'to' side (child) by default
          ensureFKOn(from.tableId, from.columnId, to.tableId);
        } else if (cardinality === "many-to-many") {
          // do not create FKs; modeling an N-N requires an explicit join table (not auto-created here)
          // we already removed any previous FKs above
        }

        return {
          ...state,
          relations,
          tables,
        };
      });
    },

    deleteRelation: (relationId) => {
      const s = get();
      s.recordHistory();
      set((state) => {
        const rel = state.relations.find((r) => r.id === relationId);
        if (!rel) return state;

        const parentTable = state.tables.find((t) => t.id === rel.from.tableId);
        const childTable = state.tables.find((t) => t.id === rel.to.tableId);

        if (!parentTable || !childTable) {
          return { ...state, relations: state.relations.filter((r) => r.id !== relationId) };
        }

        const fkName = makeFKName(parentTable.name);

        // check if another relation also uses this FK
        const otherRelations = state.relations.filter(
          (r) =>
            r.id !== relationId &&
            r.to.tableId === childTable.id &&
            makeFKName(parentTable.name) === fkName
        );

        const shouldRemoveFK = otherRelations.length === 0;

        let updatedTables = state.tables.map((t) => {
          if (t.id !== childTable.id) return t;

          if (!shouldRemoveFK) return t;

          return {
            ...t,
            columns: t.columns.filter((c) => c.name !== fkName),
          };
        });

        return {
          ...state,
          tables: updatedTables,
          relations: state.relations.filter((r) => r.id !== relationId),
          selectedRelationId: null,
        };
      });
    },

    deleteTable: (tableId) => {
      const s = get();
      s.recordHistory();
      set((state) => {
        const table = state.tables.find((t) => t.id === tableId);
        if (!table) return state;

        // 1) Remove all relations involving this table
        const remainingRelations = state.relations.filter(
          (r) => r.from.tableId !== tableId && r.to.tableId !== tableId
        );

        // 2) Remove all FK columns that were created by those relations
        const cleanedTables = state.tables
          .filter((t) => t.id !== tableId)
          .map((t) => {
            let cols = t.columns;

            state.relations.forEach((rel) => {
              if (rel.to.tableId === t.id && rel.from.tableId === tableId) {
                const parentTable = state.tables.find((p) => p.id === tableId);
                if (parentTable) {
                  const fkName = makeFKName(parentTable.name);
                  cols = cols.filter((c) => c.name !== fkName);
                }
              }
            });

            return { ...t, columns: cols };
          });

        return {
          ...state,
          tables: cleanedTables,
          relations: remainingRelations,
          selectedRelationId: null,
          selected: state.selected.filter((id) => id !== tableId),
        };
      });
    },

    // history
    history: {
      past: [],
      future: [],
    },

    recordHistory: () =>
      set((state) => {
        const snapshot = {
          tables: deepClone(state.tables),
          relations: deepClone(state.relations),
        };

        const past = [...state.history.past, snapshot];
        if (past.length > MAX_HISTORY) past.shift();

        return {
          history: {
            past,
            future: [],
          },
        };
      }),

    undo: () =>
      set((state) => {
        if (state.history.past.length === 0) return state;

        const previous = state.history.past[state.history.past.length - 1];

        const newPast = state.history.past.slice(0, -1);
        const future = [
          {
            tables: deepClone(state.tables),
            relations: deepClone(state.relations),
          },
          ...state.history.future,
        ].slice(0, MAX_HISTORY);

        return {
          tables: previous.tables,
          relations: previous.relations,
          history: {
            past: newPast,
            future,
          },
          selected: [],
          selectedRelationId: null,
        };
      }),

    redo: () =>
      set((state) => {
        if (state.history.future.length === 0) return state;

        const next = state.history.future[0];
        const newFuture = state.history.future.slice(1);

        const past = [
          ...state.history.past,
          {
            tables: deepClone(state.tables),
            relations: deepClone(state.relations),
          },
        ].slice(-MAX_HISTORY);

        return {
          tables: next.tables,
          relations: next.relations,
          history: {
            past,
            future: newFuture,
          },
          selected: [],
          selectedRelationId: null,
        };
      }),
      setSQLDrawerOpen: (open: boolean) => set({ sqlDrawerOpen: open }),
  };
});

export { smoothPan };
