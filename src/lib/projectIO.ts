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
  const text = await file.text();
  const json = JSON.parse(text);

  useDBStore.setState({
    tables: json.tables ?? [],
    relations: json.relations ?? [],
    viewport: json.viewport ?? { x: 0, y: 0, scale: 1 },
    selected: [],
    selectedRelationId: null,
    activeLink: null,
  });
}
