import type { DBTable, Relation } from "../store/dbStore";

/**
 * Enterprise SQL Generator for PostgreSQL
 * * Features:
 * - Proper Identifier Quoting (handles keywords like "user", "order")
 * - JSONB support (Postgres best practice)
 * - Automatic Indexing on Foreign Keys (Crucial for performance)
 * - Circular Dependency handling via deferred ALTER TABLE
 * - Smart Defaults (gen_random_uuid, CURRENT_TIMESTAMP)
 */

// --- 1. Utilities ---

// Double-quote identifiers to handle reserved keywords and special chars
function quoteId(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// Generate consistent name for Enum types
function enumName(table: DBTable, colName: string) {
  return `enum_${table.name}_${colName}`.toLowerCase();
}

// Generate consistent Constraint names
function constraintName(prefix: string, table: string, col: string) {
  // Truncate to avoid PG 63-char limit
  const raw = `${prefix}_${table}_${col}`;
  return quoteId(raw.length > 60 ? raw.substring(0, 60) : raw);
}

export function generateSQL(tables: DBTable[], relations: Relation[]): string {
  const lines: string[] = [];
  
  // Helper to find a table by ID
  const getTable = (id: string) => tables.find(t => t.id === id);
  // Helper to find a column by ID
  const getCol = (table: DBTable, id: string) => table.columns.find(c => c.id === id);

  lines.push("-- =========================================================");
  lines.push("-- Database Schema Export");
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
        if (processedEnums.has(eName)) continue; // Prevent duplicates

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
  // 2. TABLES (Structure Only)
  // ===================================================================
  lines.push("-- [2] Tables");
  
  for (const table of tables) {
    lines.push(`CREATE TABLE IF NOT EXISTS ${quoteId(table.name)} (`);
    const colDefs: string[] = [];
    const pkCols = table.columns.filter((c) => c.isPrimary);

    for (const col of table.columns) {
      let sqlType = col.type.toLowerCase();
      let defaultVal = (col as any).default;

      // --- Type Mapping ---
      switch (sqlType) {
        case "int":
        case "integer":
          // If PK, use serial (auto-increment)
          sqlType = col.isPrimary ? "SERIAL" : "INTEGER";
          break;
        case "uuid":
          sqlType = "UUID";
          // Smart default for UUID PKs
          if (col.isPrimary && !defaultVal) defaultVal = "gen_random_uuid()";
          break;
        case "text":
        case "string":
          sqlType = "TEXT";
          break;
        case "bool":
        case "boolean":
          sqlType = "BOOLEAN";
          break;
        case "date":
        case "datetime":
          sqlType = "TIMESTAMPTZ"; // Best practice for global apps
          if (!defaultVal && col.name.includes("created")) defaultVal = "CURRENT_TIMESTAMP";
          break;
        case "json":
        case "jsonb":
          sqlType = "JSONB"; // Always use JSONB in Postgres
          break;
        case "enum":
          sqlType = quoteId(enumName(table, col.name));
          break;
        default:
          sqlType = "TEXT"; // Fallback
      }

      let def = `  ${quoteId(col.name)} ${sqlType}`;

      // Constraints
      if (!col.isNullable && !col.isPrimary) def += " NOT NULL";
      if (col.isUnique) def += " UNIQUE";
      if (defaultVal !== undefined) def += ` DEFAULT ${defaultVal}`;

      colDefs.push(def);
    }

    // Primary Key Definition
    if (pkCols.length > 0) {
      const pkNames = pkCols.map(c => quoteId(c.name)).join(", ");
      colDefs.push(`  PRIMARY KEY (${pkNames})`);
    }

    lines.push(colDefs.join(",\n"));
    lines.push(");");
    lines.push("");
  }

  // ===================================================================
  // 3. RELATIONS & FOREIGN KEYS (One-to-One / One-to-Many)
  // ===================================================================
  lines.push("-- [3] Foreign Keys & Indices");
  
  const fkStatements: string[] = [];
  const indexStatements: string[] = [];
  const generatedFKs = new Set<string>(); // prevent duplicates

  // We iterate RELATIONS as the source of truth, 
  // ensuring visual lines result in actual constraints.
  for (const rel of relations) {
    if (rel.cardinality === "many-to-many") continue; // Handled in section 4

    const sourceTable = getTable(rel.from.tableId);
    const targetTable = getTable(rel.to.tableId);
    if (!sourceTable || !targetTable) continue;

    // In a visual editor:
    // 1-1: FK can be on either side, but usually 'From' -> 'To'
    // 1-N: FK is ALWAYS on the "Many" side (the 'To' side usually, assuming drawn Parent->Child)
    // However, users might draw lines backwards. 
    // We assume the stored relation includes the specific columnId where the FK lives.
    
    // Logic: The "From" of the relation usually holds the FK column in this store's logic
    // based on the provided JSON (e.g., users.id -> posts.user_id)
    
    const fkTable = sourceTable;
    const fkCol = getCol(sourceTable, rel.from.columnId);
    
    const refTable = targetTable;
    const refCol = getCol(targetTable, rel.to.columnId);

    if (!fkCol || !refCol) continue;

    // Unique key for deduping
    const relKey = `${fkTable.name}.${fkCol.name}-${refTable.name}.${refCol.name}`;
    if (generatedFKs.has(relKey)) continue;
    generatedFKs.add(relKey);

    const cName = constraintName("fk", fkTable.name, fkCol.name);
    
    // Rules
    const onDel = rel.deleteRule === "cascade" ? " ON DELETE CASCADE" : 
                  rel.deleteRule === "set-null" ? " ON DELETE SET NULL" : "";
    const onUpd = rel.updateRule === "cascade" ? " ON UPDATE CASCADE" : "";

    fkStatements.push(
      `ALTER TABLE ${quoteId(fkTable.name)} ` +
      `ADD CONSTRAINT ${cName} ` +
      `FOREIGN KEY (${quoteId(fkCol.name)}) ` +
      `REFERENCES ${quoteId(refTable.name)}(${quoteId(refCol.name)})${onDel}${onUpd};`
    );

    // AUTOMATIC INDEX (Performance Win)
    const idxName = constraintName("idx", fkTable.name, fkCol.name);
    indexStatements.push(
      `CREATE INDEX IF NOT EXISTS ${idxName} ON ${quoteId(fkTable.name)}(${quoteId(fkCol.name)});`
    );
  }

  // ===================================================================
  // 4. MANY-TO-MANY (Junction Tables)
  // ===================================================================
  lines.push("-- [4] Junction Tables (Many-to-Many)");
  
  const processedJunctions = new Set<string>();

  for (const rel of relations) {
    if (rel.cardinality !== "many-to-many") continue;

    const tA = getTable(rel.from.tableId);
    const tB = getTable(rel.to.tableId);
    if (!tA || !tB) continue;

    // Canonical name: alphabetical order
    const sorted = [tA, tB].sort((a, b) => a.name.localeCompare(b.name));
    const [table1, table2] = sorted;
    
    const joinTableName = `_junction_${table1.name}_${table2.name}`;
    if (processedJunctions.has(joinTableName)) continue;
    processedJunctions.add(joinTableName);

    // Identify PKs to reference
    const pk1 = table1.columns.find(c => c.isPrimary);
    const pk2 = table2.columns.find(c => c.isPrimary);
    if (!pk1 || !pk2) continue; // Cannot link without PKs

    // Type mapping for the ID columns
    const type1 = pk1.type === "int" || pk1.type === "integer" ? "INTEGER" : "UUID";
    const type2 = pk2.type === "int" || pk2.type === "integer" ? "INTEGER" : "UUID";

    // Create Junction Table
    lines.push(`CREATE TABLE IF NOT EXISTS ${quoteId(joinTableName)} (`);
    lines.push(`  ${quoteId(table1.name + "_id")} ${type1} NOT NULL,`);
    lines.push(`  ${quoteId(table2.name + "_id")} ${type2} NOT NULL,`);
    lines.push(`  PRIMARY KEY (${quoteId(table1.name + "_id")}, ${quoteId(table2.name + "_id")})`);
    lines.push(");");

    // Add Constraints immediately for Junctions
    const fk1 = constraintName("fk_junc", joinTableName, table1.name);
    const fk2 = constraintName("fk_junc", joinTableName, table2.name);

    fkStatements.push(`ALTER TABLE ${quoteId(joinTableName)} ADD CONSTRAINT ${fk1} FOREIGN KEY (${quoteId(table1.name + "_id")}) REFERENCES ${quoteId(table1.name)}(${quoteId(pk1.name)}) ON DELETE CASCADE;`);
    fkStatements.push(`ALTER TABLE ${quoteId(joinTableName)} ADD CONSTRAINT ${fk2} FOREIGN KEY (${quoteId(table2.name + "_id")}) REFERENCES ${quoteId(table2.name)}(${quoteId(pk2.name)}) ON DELETE CASCADE;`);

    // Indices for Junction (Make queries from both sides fast)
    indexStatements.push(`CREATE INDEX IF NOT EXISTS ${constraintName("idx_junc", joinTableName, table2.name)} ON ${quoteId(joinTableName)}(${quoteId(table2.name + "_id")});`);
  }
  lines.push("");

  // ======================`=============================================
  // 5. COMMIT CONSTRAINTS & INDICES
  // ===================================================================
  if (fkStatements.length > 0) {
    lines.push(...fkStatements);
    lines.push("");
  }
  
  if (indexStatements.length > 0) {
    lines.push("-- Indices for performance");
    lines.push(...indexStatements);
    lines.push("");
  }

  return lines.join("\n");
}