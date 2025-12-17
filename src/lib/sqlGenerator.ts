import type { DBTable, Relation } from "../store/dbStore";

/**
 * Enterprise SQL Generator for PostgreSQL (FIXED)
 * - Fixed: FK Direction (Applies constraint to Child, references Parent)
 * - Feature: Proper Quoting
 * - Feature: JSONB & Enums
 * - Feature: Auto-Indexing
 */

// --- 1. Utilities ---

function quoteId(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function enumName(table: DBTable, colName: string) {
  return `enum_${table.name}_${colName}`.toLowerCase();
}

function constraintName(prefix: string, table: string, col: string) {
  const raw = `${prefix}_${table}_${col}`;
  return quoteId(raw.length > 60 ? raw.substring(0, 60) : raw);
}

export function generateSQL(tables: DBTable[], relations: Relation[]): string {
  const lines: string[] = [];
  
  const getTable = (id: string) => tables.find(t => t.id === id);
  const getCol = (table: DBTable, id: string) => table.columns.find(c => c.id === id);

  lines.push("-- =========================================================");
  lines.push("-- Database Schema Export (Fixed Direction)");
  lines.push(`-- Generated at ${new Date().toISOString()}`);
  lines.push("-- =========================================================");
  lines.push("");

  // ===================================================================
  // 1. ENUM TYPES
  // ===================================================================
  lines.push("-- [1] Enum Types");
  const processedEnums = new Set<string>();

  for (const table of tables) {
    for (const col of table.columns) {
      if (col.type === "enum" && Array.isArray((col as any).enumValues)) {
        const eName = enumName(table, col.name);
        if (processedEnums.has(eName)) continue; 

        const values = (col as any).enumValues
          .map((v: string) => `'${v.replace(/'/g, "''")}'`)
          .join(", ");
        
        lines.push(`CREATE TYPE ${quoteId(eName)} AS ENUM (${values});`);
        processedEnums.add(eName);
      }
    }
  }
  lines.push("");

  // ===================================================================
  // 2. TABLES
  // ===================================================================
  lines.push("-- [2] Tables");
  
  for (const table of tables) {
    lines.push(`CREATE TABLE IF NOT EXISTS ${quoteId(table.name)} (`);
    const colDefs: string[] = [];
    const pkCols = table.columns.filter((c) => c.isPrimary);

    for (const col of table.columns) {
      let sqlType = col.type.toLowerCase();
      let defaultVal = (col as any).default;

      // Type Mapping
      switch (sqlType) {
        case "int":
        case "integer":
          sqlType = col.isPrimary ? "SERIAL" : "INTEGER";
          break;
        case "uuid":
          sqlType = "UUID";
          if (col.isPrimary && !defaultVal) defaultVal = "gen_random_uuid()";
          break;
        case "text":
        case "string":
        case "varchar":
          sqlType = "TEXT";
          break;
        case "bool":
        case "boolean":
          sqlType = "BOOLEAN";
          break;
        case "date":
        case "datetime":
        case "timestamp":
          sqlType = "TIMESTAMPTZ"; 
          if (!defaultVal && (col.name.includes("created") || col.name.includes("at"))) defaultVal = "NOW()";
          break;
        case "json":
        case "jsonb":
          sqlType = "JSONB"; 
          break;
        case "enum":
          sqlType = quoteId(enumName(table, col.name));
          break;
        default:
          sqlType = "TEXT"; 
      }

      let def = `  ${quoteId(col.name)} ${sqlType}`;

      if (!col.isNullable && !col.isPrimary) def += " NOT NULL";
      if (col.isUnique) def += " UNIQUE";
      if (defaultVal !== undefined) def += ` DEFAULT ${defaultVal}`;

      colDefs.push(def);
    }

    if (pkCols.length > 0) {
      const pkNames = pkCols.map(c => quoteId(c.name)).join(", ");
      colDefs.push(`  PRIMARY KEY (${pkNames})`);
    }

    lines.push(colDefs.join(",\n"));
    lines.push(");");
    lines.push("");
  }

  // ===================================================================
  // 3. FOREIGN KEYS (THE FIX)
  // ===================================================================
  lines.push("-- [3] Foreign Keys & Indices");
  
  const fkStatements: string[] = [];
  const indexStatements: string[] = [];
  const generatedFKs = new Set<string>(); 

  for (const rel of relations) {
    if (rel.cardinality === "many-to-many") continue; 

    // Visual Source (Where line starts) -> Visual Target (Where line ends)
    // Usually: Parent (PK) -> Child (FK)
    const visualSourceTable = getTable(rel.from.tableId);
    const visualTargetTable = getTable(rel.to.tableId);
    
    if (!visualSourceTable || !visualTargetTable) continue;

    // --- LOGIC SWAP HERE ---
    // The table that NEEDS the constraint is the TARGET (Child), not the Source (Parent).
    // The column that stores the ID is on the TARGET side.
    
    const childTable = visualTargetTable; // The table WITH the FK column
    const childCol = getCol(childTable, rel.to.columnId); // The FK column (e.g. user.org_id)
    
    const parentTable = visualSourceTable; // The table WITH the PK
    const parentCol = getCol(parentTable, rel.from.columnId); // The PK column (e.g. org.id)

    if (!childCol || !parentCol) continue;

    // Dedup
    const relKey = `${childTable.name}.${childCol.name}-${parentTable.name}.${parentCol.name}`;
    if (generatedFKs.has(relKey)) continue;
    generatedFKs.add(relKey);

    // Name: fk_users_org_id
    const cName = constraintName("fk", childTable.name, childCol.name);
    
    const onDel = rel.deleteRule === "cascade" ? " ON DELETE CASCADE" : 
                  rel.deleteRule === "set-null" ? " ON DELETE SET NULL" : "";
    
    // ALTER TABLE "CHILD" ... REFERENCES "PARENT"
    fkStatements.push(
      `ALTER TABLE ${quoteId(childTable.name)} ` +
      `ADD CONSTRAINT ${cName} ` +
      `FOREIGN KEY (${quoteId(childCol.name)}) ` +
      `REFERENCES ${quoteId(parentTable.name)}(${quoteId(parentCol.name)})${onDel};`
    );

    // Auto-Index the Foreign Key on the Child Table
    const idxName = constraintName("idx", childTable.name, childCol.name);
    indexStatements.push(
      `CREATE INDEX IF NOT EXISTS ${idxName} ON ${quoteId(childTable.name)}(${quoteId(childCol.name)});`
    );
  }

  // ===================================================================
  // 4. MANY-TO-MANY (No Changes needed, this logic is directionless)
  // ===================================================================
  lines.push("-- [4] Junction Tables");
  
  const processedJunctions = new Set<string>();

  for (const rel of relations) {
    if (rel.cardinality !== "many-to-many") continue;

    const tA = getTable(rel.from.tableId);
    const tB = getTable(rel.to.tableId);
    if (!tA || !tB) continue;

    const sorted = [tA, tB].sort((a, b) => a.name.localeCompare(b.name));
    const [table1, table2] = sorted;
    
    const joinTableName = `_junction_${table1.name}_${table2.name}`;
    if (processedJunctions.has(joinTableName)) continue;
    processedJunctions.add(joinTableName);

    const pk1 = table1.columns.find(c => c.isPrimary);
    const pk2 = table2.columns.find(c => c.isPrimary);
    if (!pk1 || !pk2) continue; 

    const type1 = pk1.type.includes("int") ? "INTEGER" : "UUID";
    const type2 = pk2.type.includes("int") ? "INTEGER" : "UUID";

    lines.push(`CREATE TABLE IF NOT EXISTS ${quoteId(joinTableName)} (`);
    lines.push(`  ${quoteId(table1.name + "_id")} ${type1} NOT NULL,`);
    lines.push(`  ${quoteId(table2.name + "_id")} ${type2} NOT NULL,`);
    lines.push(`  PRIMARY KEY (${quoteId(table1.name + "_id")}, ${quoteId(table2.name + "_id")})`);
    lines.push(");");

    const fk1 = constraintName("fk_junc", joinTableName, table1.name);
    const fk2 = constraintName("fk_junc", joinTableName, table2.name);

    fkStatements.push(`ALTER TABLE ${quoteId(joinTableName)} ADD CONSTRAINT ${fk1} FOREIGN KEY (${quoteId(table1.name + "_id")}) REFERENCES ${quoteId(table1.name)}(${quoteId(pk1.name)}) ON DELETE CASCADE;`);
    fkStatements.push(`ALTER TABLE ${quoteId(joinTableName)} ADD CONSTRAINT ${fk2} FOREIGN KEY (${quoteId(table2.name + "_id")}) REFERENCES ${quoteId(table2.name)}(${quoteId(pk2.name)}) ON DELETE CASCADE;`);

    indexStatements.push(`CREATE INDEX IF NOT EXISTS ${constraintName("idx_junc", joinTableName, table2.name)} ON ${quoteId(joinTableName)}(${quoteId(table2.name + "_id")});`);
  }
  lines.push("");

  // ===================================================================
  // 5. OUTPUT
  // ===================================================================
  if (fkStatements.length > 0) {
    lines.push(...fkStatements);
    lines.push("");
  }
  
  if (indexStatements.length > 0) {
    lines.push("-- Indices");
    lines.push(...indexStatements);
    lines.push("");
  }

  return lines.join("\n");
}