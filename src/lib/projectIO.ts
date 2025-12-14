import { useDBStore } from "../store/dbStore";

// SAVE
export function saveProject() {
  const state = useDBStore.getState();
  const data = {
    tables: state.tables,
    relations: state.relations,
    viewport: state.viewport,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "project.dbb";
  a.click();
}

// LOAD
export async function importProject(file: File) {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const tables = json.tables || [];

    // If no tables, just load as is
    if (tables.length === 0) {
      useDBStore.setState({
        tables: [],
        relations: json.relations || [],
        viewport: { x: 0, y: 0, scale: 1 },
      });
      return;
    }

    // 1. Measure the "World" bounds of the incoming tables
    // We assume a default width/height of ~200px per table if not stored
    const TABLE_W = 200;
    const TABLE_H = 150;

    const minX = Math.min(...tables.map((t: any) => t.x));
    const maxX = Math.max(...tables.map((t: any) => t.x + TABLE_W));
    const minY = Math.min(...tables.map((t: any) => t.y));
    const maxY = Math.max(...tables.map((t: any) => t.y + TABLE_H));

    // 2. Calculate the center of the CONTENT
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    // 3. Get the center of the USER'S SCREEN
    const { innerWidth, innerHeight } = window;
    const screenCenterX = innerWidth / 2;
    const screenCenterY = innerHeight / 2;

    // 4. (Optional) Auto-Scale to fit if diagram is huge
    // Padding of 100px
    const PADDING = 100;
    const scaleX = (innerWidth - PADDING * 2) / contentWidth;
    const scaleY = (innerHeight - PADDING * 2) / contentHeight;
    // Fit to screen, but don't zoom in more than 100% (1.0)
    // and don't zoom out less than 20% (0.2)
    const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1);

    // 5. Calculate new Viewport X/Y
    // Logic: Screen = Viewport + (World * Scale)
    // Thus: Viewport = Screen - (World * Scale)
    const newViewportX = screenCenterX - (contentCenterX * fitScale);
    const newViewportY = screenCenterY - (contentCenterY * fitScale);

    // 6. Apply State
    useDBStore.setState({
      tables: tables,
      relations: json.relations ?? [],
      viewport: { 
        x: newViewportX, 
        y: newViewportY, 
        scale: fitScale 
      },
      selected: [],
      selectedRelationId: null,
      activeLink: null,
    });

  } catch (err) {
    console.error("Failed to load project:", err);
    alert("Invalid file format.");
  }
}


