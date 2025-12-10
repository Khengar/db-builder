import "./index.css";
import Canvas from "./components/canvas/Canvas";
import { useDBStore } from "./store/dbStore";

function App() {
  const addTable = useDBStore((s) => s.addTable);

  return (
    <div className="w-full h-screen flex flex-col bg-background text-foreground">

      {/* ────────────────────────────────
          TOP NAVIGATION
      ──────────────────────────────── */}
      <header className="h-14 px-6 border-b bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            DB
          </div>
          <span className="font-semibold">DB-Builder</span>
        </div>

        <select className="border rounded-md px-3 py-1 text-sm bg-white shadow-sm">
          <option>PostgreSQL</option>
          <option>MySQL</option>
          <option>SQLite</option>
        </select>
      </header>

      {/* ────────────────────────────────
          CANVAS AREA
      ──────────────────────────────── */}
      <main className="flex-1 relative overflow-hidden">

        {/* Background Grid */}
        <div
          className="
            absolute inset-0 pointer-events-none 
            bg-[radial-gradient(circle,#d4d4d466_1px,transparent_0)]
            [background-size:20px_20px]
          "
        />

        {/* Canvas must live inside its OWN absolute container */}
        <div className="absolute inset-0">
          <Canvas />
        </div>

      </main>

      {/* ────────────────────────────────
          FLOATING TOOLBAR
      ──────────────────────────────── */}
      <div style={{zIndex: 999}} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border shadow-lg px-6 py-3 rounded-full flex items-center gap-5">
        
        <button
          onClick={() => {
            console.log("TABLE BUTTON CLICKED");
            addTable();
          }}
          className="text-sm"
        >
          ➕ Table
        </button>

        <button className="text-sm">🔗 Relation</button>
        <button className="text-sm">🖼️ Upload</button>

        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm shadow hover:opacity-90">
          Build SQL
        </button>
      </div>

    </div>
  );
}

export default App;
