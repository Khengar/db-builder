import type { DBTable, Relation } from "../store/dbStore";

/**
 * SQL Generator — column-driven FK model (Option B)
 *
 * Key points:
 * - Uses table.columns where `isForeign === true` and `references` exist to produce FK constraints.
 * - Relations are used to detect many-to-many join tables and to read optional delete/update rules
 *   (if a relation exists between the same table/column endpoints).
 * - CREATE TYPE (ENUM) emitted first, CREATE TABLE (columns, PK, UNIQUE) emitted next,
 *   then JOIN TABLES, then FK ALTERs (so cycles are safe).
 */

// helper to build enum type name
function enumName(table: DBTable, colName: string) {
  return `${table.name}_${colName}_enum`;
}

// helper for fk constraint name
function fkConstraintName(childTable: string, fkColumn: string) {
  return `fk_${childTable}_${fkColumn}`;
}

// helper to escape identifiers minimally (very simple — adapt if you want quoting)
function ident(name: string) {
  // assume user uses safe names; if not, you could replace with double-quote quoting
  // return `"${name.replace(/"/g, '""')}"`;
  return name;
}

// find relation by endpoints (both directions); returns relation if found
function findRelationForEndpoints(relations: Relation[], fromTableId: string, fromColId: string, toTableId: string, toColId: string) {
  return relations.find((r) =>
    r.from.tableId === fromTableId &&
    r.from.columnId === fromColId &&
    r.to.tableId === toTableId &&
    r.to.columnId === toColId
  ) || relations.find((r) =>
    // allow reversed relation match (in case relation stored reversed)
    r.from.tableId === toTableId &&
    r.from.columnId === toColId &&
    r.to.tableId === fromTableId &&
    r.to.columnId === fromColId
  );
}

export function generateSQL(tables: DBTable[], relations: Relation[]): string {
  const lines: string[] = [];

  // utility: get column by id
  const getColumn = (table: DBTable, colId: string) => table.columns.find((c) => c.id === colId);

  // ===================================================================
  // 1) ENUM TYPE CREATION (emit before tables)
  // ===================================================================
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.type === "enum" && Array.isArray((col as any).enumValues) && (col as any).enumValues.length > 0) {
        const eName = enumName(table, col.name);
        const values = (col as any).enumValues.map((v: string) => `'${v.replace(/'/g, "''")}'`).join(", ");
        lines.push(`-- ENUM for ${table.name}.${col.name}`);
        lines.push(`CREATE TYPE ${ident(eName)} AS ENUM (${values});`);
        lines.push(""); // blank line
      }
    }
  }

  // ===================================================================
  // 2) CREATE TABLE (columns, primary keys, unique constraints)
  //    We will *not* emit FK constraints here. FK constraints emitted later via ALTER TABLE.
  // ===================================================================
  for (const table of tables) {
    lines.push(`-- ------------------------------------------------`);
    lines.push(`-- TABLE: ${table.name}`);
    lines.push(`-- ------------------------------------------------`);
    lines.push(`CREATE TABLE ${ident(table.name)} (`);

    const colDefs: string[] = [];

    // check for composite PK (multiple columns with isPrimary)
    const pkCols = table.columns.filter((c) => c.isPrimary).map((c) => c.name);

    for (const col of table.columns) {
      // determine SQL type
      let sqlType = col.type;

      // map common type aliases to PG types if needed
      if (sqlType === "int") sqlType = "integer";
      if (sqlType === "uuid") sqlType = "uuid";
      // enum handled below
      if (col.isPrimary) {
        // auto-increment for integer/bigint primary
        if (col.type === "int" || col.type === "integer") sqlType = "serial";
        if (col.type === "bigint") sqlType = "bigserial";
      }

      if (col.type === "enum" && Array.isArray((col as any).enumValues)) {
        sqlType = enumName(table, col.name);
      }

      let def = `  ${ident(col.name)} ${sqlType}`;

      // NOT NULL/NULL
      if (col.isPrimary) {
        // primary key columns are NOT NULL by definition (unless serial behavior)
        def += " NOT NULL";
      } else {
        if (col.isNullable === false) {
          def += " NOT NULL";
        }
      }

      // UNIQUE (column-level)
      if (col.isUnique) def += " UNIQUE";

      // default values handling (if you later add default in column metadata)
      if ((col as any).default !== undefined) {
        def += ` DEFAULT ${(col as any).default}`;
      }

      colDefs.push(def);
    }

    // If single-column PK, we already appended NOT NULL and can rely on column-level PRIMARY KEY annotation
    // but push a table-level primary key if composite
    if (pkCols.length === 1) {
      // annotate single pk column inline (replace the column definition to include PRIMARY KEY)
      const pkName = pkCols[0];
      // find and alter the existing line to include PRIMARY KEY if not already present
      for (let i = 0; i < colDefs.length; i++) {
        if (colDefs[i].startsWith(`  ${ident(pkName)} `) && !/PRIMARY KEY/.test(colDefs[i])) {
          colDefs[i] = colDefs[i] + " PRIMARY KEY";
          break;
        }
      }
    } else if (pkCols.length > 1) {
      // add table-level composite PK
      colDefs.push(`  PRIMARY KEY (${pkCols.map(ident).join(", ")})`);
    }

    lines.push(colDefs.join(",\n"));
    lines.push(");");
    lines.push(""); // blank line
  }

  // ===================================================================
  // 3) Many-to-Many: Generate explicit join tables for relations that are many-to-many
  //    Use relation endpoints to find parent tables + their PKs. Skip if join table already exists.
  // ===================================================================
  const producedJoinTables = new Set<string>();

  for (const rel of relations) {
    if (rel.cardinality !== "many-to-many") continue;

    const tableA = tables.find((t) => t.id === rel.from.tableId);
    const tableB = tables.find((t) => t.id === rel.to.tableId);
    if (!tableA || !tableB) continue;

    // canonical join name (alphabetical to avoid duplicates in swapped relations)
    const names = [tableA.name, tableB.name].sort();
    const joinName = `${names[0]}_${names[1]}`;

    if (producedJoinTables.has(joinName)) continue;

    const pkA = tableA.columns.find((c) => c.isPrimary);
    const pkB = tableB.columns.find((c) => c.isPrimary);
    if (!pkA || !pkB) {
      // skip join if either side lacks PK (user should create PK first)
      continue;
    }

    producedJoinTables.add(joinName);

    lines.push(`-- ------------------------------------------------`);
    lines.push(`-- MANY-TO-MANY JOIN TABLE: ${joinName}`);
    lines.push(`-- ------------------------------------------------`);
    lines.push(`CREATE TABLE ${ident(joinName)} (`);
    lines.push(`  ${ident(tableA.name + "_id")} ${pkA.type} NOT NULL,`);
    lines.push(`  ${ident(tableB.name + "_id")} ${pkB.type} NOT NULL,`);
    lines.push(`  PRIMARY KEY (${ident(tableA.name + "_id")}, ${ident(tableB.name + "_id")})`);
    lines.push(");");
    lines.push("");

    // We'll emit FK constraints for join tables below (same ALTER TABLE flow)
  }

  // ===================================================================
  // 4) FOREIGN KEY CONSTRAINTS (use column metadata: isForeign + references)
  //    We collect all constraint statements and emit them after tables, so ordering is safe.
  // ===================================================================
  const fkStatements: string[] = [];

  // helper to find relation (if any) that corresponds to this FK
  const relationForFK = (fromTableId: string, fromColId: string, toTableId: string, toColId: string) =>
    findRelationForEndpoints(relations, fromTableId, fromColId, toTableId, toColId);

  for (const table of tables) {
    for (const col of table.columns) {
      if (!col.isForeign || !col.references) continue;
      const { tableId: refTableId, columnId: refColumnId } = col.references;

      const parent = tables.find((t) => t.id === refTableId);
      if (!parent) {
        // referenced table missing — skip and annotate
        lines.push(`-- WARNING: FK ${table.name}.${col.name} references unknown table id=${refTableId}`);
        continue;
      }

      const parentCol = getColumn(parent, refColumnId);
      if (!parentCol) {
        lines.push(`-- WARNING: FK ${table.name}.${col.name} references unknown column id=${refColumnId} on table ${parent.name}`);
        continue;
      }

      // find matching relation (if user created relation between same endpoints)
      const rel = relationForFK(parent.id, parentCol.id, table.id, col.id);

      // derive ON DELETE / ON UPDATE rules from relation if present
      const deleteRule = rel?.deleteRule === "cascade"
        ? " ON DELETE CASCADE"
        : rel?.deleteRule === "set-null"
        ? " ON DELETE SET NULL"
        : "";

      const updateRule = rel?.updateRule === "cascade" ? " ON UPDATE CASCADE" : "";

      const fkName = fkConstraintName(table.name, col.name);

      fkStatements.push(`-- FK: ${table.name}.${col.name} -> ${parent.name}.${parentCol.name}`);
      fkStatements.push(`ALTER TABLE ${ident(table.name)} ADD CONSTRAINT ${ident(fkName)} FOREIGN KEY (${ident(col.name)}) REFERENCES ${ident(parent.name)}(${ident(parentCol.name)})${deleteRule}${updateRule};`);
      fkStatements.push("");
    }
  }

  // Also emit FK constraints for join tables (generate from producedJoinTables using relations info)
  for (const joinName of Array.from(producedJoinTables)) {
    // deduce which two tables were used — find a relation that corresponds to this join
    // find any relation that produced this join table (matching by sorted table names)
    const rel = relations.find((r) => {
      if (r.cardinality !== "many-to-many") return false;
      const a = tables.find((t) => t.id === r.from.tableId);
      const b = tables.find((t) => t.id === r.to.tableId);
      if (!a || !b) return false;
      const names = [a.name, b.name].sort();
      return `${names[0]}_${names[1]}` === joinName;
    });

    if (!rel) continue;

    const tableA = tables.find((t) => t.id === rel.from.tableId);
    const tableB = tables.find((t) => t.id === rel.to.tableId);
    if (!tableA || !tableB) continue;

    const pkA = tableA.columns.find((c) => c.isPrimary);
    const pkB = tableB.columns.find((c) => c.isPrimary);
    if (!pkA || !pkB) continue;

    // join fk names
    const fkA = fkConstraintName(joinName, `${tableA.name}_id`);
    const fkB = fkConstraintName(joinName, `${tableB.name}_id`);

    fkStatements.push(`-- FK: ${joinName}.${tableA.name}_id -> ${tableA.name}.${pkA.name}`);
    fkStatements.push(`ALTER TABLE ${ident(joinName)} ADD CONSTRAINT ${ident(fkA)} FOREIGN KEY (${ident(tableA.name + "_id")}) REFERENCES ${ident(tableA.name)}(${ident(pkA.name)}) ON DELETE CASCADE;`);
    fkStatements.push("");
    fkStatements.push(`-- FK: ${joinName}.${tableB.name}_id -> ${tableB.name}.${pkB.name}`);
    fkStatements.push(`ALTER TABLE ${ident(joinName)} ADD CONSTRAINT ${ident(fkB)} FOREIGN KEY (${ident(tableB.name + "_id")}) REFERENCES ${ident(tableB.name)}(${ident(pkB.name)}) ON DELETE CASCADE;`);
    fkStatements.push("");
  }

  // ===================================================================
  // 5) Emit FK statements
  // ===================================================================
  if (fkStatements.length > 0) {
    lines.push("-- ------------------------------------------------");
    lines.push("-- FOREIGN KEY CONSTRAINTS (added after table creation)");
    lines.push("-- ------------------------------------------------");
    lines.push("");
    lines.push(...fkStatements);
  }

  // Final join and return
  return lines.join("\n");
}
