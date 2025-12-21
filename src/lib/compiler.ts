import { v4 as uuidv4 } from 'uuid';

// --- Types ---
export type ProjectData = {
  tables: any[];
  relations: any[];
  viewport: { x: number; y: number; scale: number };
};

export type Diagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  fixed: boolean;
};

export type CompileResult = {
  success: boolean;
  diagnostics: Diagnostic[];
  patchedData: ProjectData;
  requiresLayout: boolean;
};

// --- The Compiler Engine ---
export const ProjectCompiler = {
  
  compile: (rawData: any): CompileResult => {
    const diagnostics: Diagnostic[] = [];
    
    // 1. CLONE & SAFE DEFAULT
    const project: ProjectData = {
      viewport: rawData.viewport || { x: 0, y: 0, scale: 1 },
      tables: Array.isArray(rawData.tables) ? JSON.parse(JSON.stringify(rawData.tables)) : [],
      relations: Array.isArray(rawData.relations) ? JSON.parse(JSON.stringify(rawData.relations)) : []
    };

    // --- PASS 0: DEEP SANITIZATION (Trims " user_id " -> "user_id") ---
    const sanitize = (obj: any) => {
      if (!obj) return;
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      });
    };
    sanitize(project);

    // --- PASS 1: STRUCTURAL INTEGRITY ---
    project.tables = project.tables.filter(t => {
      if (!t.id) {
        diagnostics.push({ severity: "warning", code: "NO_ID", message: `Skipped table without ID.`, fixed: true });
        return false;
      }
      if (!t.columns) t.columns = [];
      return true;
    });

    // --- PASS 2: DUPLICATE DETECTION ---
    const seenTableIds = new Set();
    project.tables.forEach(t => {
      if (seenTableIds.has(t.id)) {
        const newId = `${t.id}_${Math.floor(Math.random() * 1000)}`;
        t.id = newId;
      }
      seenTableIds.add(t.id);
    });

    // --- PASS 3: RELATION INTEGRITY ---
    project.relations = project.relations.filter(rel => {
      if (!rel || !rel.from || !rel.to || !rel.from.tableId || !rel.to.tableId) return false;

      const fromTable = project.tables.find(t => t.id === rel.from.tableId);
      const toTable = project.tables.find(t => t.id === rel.to.tableId);

      if (!fromTable || !toTable) return false;

      const ensureColumn = (table: any, colId: string, role: string) => {
        if (!colId) return;
        const col = table.columns.find((c: any) => c.id === colId);
        if (!col) {
          table.columns.push({
            id: colId,
            name: `${role}_id`, 
            type: "uuid",
            isForeignKey: true
          });
        }
      };

      ensureColumn(fromTable, rel.from.columnId, "source");
      ensureColumn(toTable, rel.to.columnId, "target");
      return true;
    });

    // --- PASS 4: SMART TYPE MAPPING ---
    const typeMap: Record<string, string> = {
      "string": "varchar", "text": "text", "int": "int", "integer": "int",
      "number": "int", "boolean": "boolean", "bool": "boolean",
      "date": "date", "datetime": "timestamp", "timestamp": "timestamp",
      "uid": "uuid", "uuid": "uuid", "json": "json"
    };

    project.tables.forEach(t => {
      t.columns.forEach((c: any) => {
        if (!c.type) { 
            c.type = "varchar"; 
        } else {
            let rawType = c.type.toLowerCase().replace(/\(.*\)/, ""); 
            c.type = typeMap[rawType] || rawType || "varchar"; 
        }
      });
    });

    // --- PASS 5: AUTO-INFER RELATIONS ---
    project.tables.forEach(sourceTable => {
      sourceTable.columns.forEach((col: any) => {
        const isFkNaming = /_id$/i.test(col.name) || /Id$/.test(col.name);
        
        if (isFkNaming && !col.isPrimary) {
          const targetNameBase = col.name.replace(/_id$/i, "").replace(/Id$/, "");
          const targetTable = project.tables.find(t => 
            t.name.toLowerCase() === targetNameBase.toLowerCase() || 
            t.name.toLowerCase() === targetNameBase.toLowerCase() + "s"
          );

          if (targetTable) {
            const targetPk = targetTable.columns.find((c: any) => c.name === 'id' || c.isPrimary);
            if (targetPk) {
              const exists = project.relations.some(r => 
                r.from.tableId === targetTable.id && 
                r.to.tableId === sourceTable.id && 
                r.to.columnId === col.id
              );

              if (!exists) {
                project.relations.push({
                  id: `gen_rel_${Math.floor(Math.random() * 100000)}`,
                  from: { tableId: targetTable.id, columnId: targetPk.id },
                  to: { tableId: sourceTable.id, columnId: col.id },
                  cardinality: "one-to-many"
                });
              }
            }
          }
        }
      });
    });

    // --- PASS 6: LAYOUT DETECTION ---
    const requiresLayout = project.tables.length > 0 && project.tables.every(t => !t.x && !t.y);

    return {
      success: true,
      diagnostics,
      patchedData: project,
      requiresLayout
    };
  }
};