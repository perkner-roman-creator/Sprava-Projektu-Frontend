import { useEffect, useState, useMemo } from "react";
import { apiGet, apiPost, apiPut, apiDelete, setToken, getToken } from "./lib/api";
import { useDebounce } from "./hooks/useDebounce";
import ConfirmModal from "./components/ConfirmModal";
import './App.css';

const APP_NAME = "Správa projektů";

type Project = { id: number; title: string; description: string };

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  // nově: vyhledávání + originální hodnoty při editaci
  const [query, setQuery] = useState("");
  const [editingOriginal, setEditingOriginal] = useState<{ title: string; description: string } | null>(null);

  // nový stav pro řazení
  const [sortBy, setSortBy] = useState<"title" | "id">("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // modal pro mazání
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const load = async () => {
    try {
      const data = await apiGet<Project[]>("/api/projects");
      setProjects(data);
    } catch (e) {
      console.error("GET /api/projects failed:", e);
    }
  };

  useEffect(() => { 
    load();
    document.title = APP_NAME;
  }, []);

  // automatické odhlášení při 401 (viz lib/api.ts)
  useEffect(() => {
    const onUnauthorized = () => {
      setLoggedIn(false);
      setEditingId(null);
      load();
    };
    window.addEventListener("auth:unauthorized" as any, onUnauthorized as any);
    return () => window.removeEventListener("auth:unauthorized" as any, onUnauthorized as any);
  }, []);

  const loginDemo = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "demo@demo.cz", password: "demo" })
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setToken(data.token);
      setLoggedIn(true);
      await load();
      alert("Přihlášení OK");
    } catch (e) {
      console.error("Login failed:", e);
      alert("Přihlášení se nezdařilo.");
    } finally {
      setLoading(false);
    }
  };

  const addProject = async () => {
    if (!loggedIn) {
      alert("Přihlas se");
      return;
    }
    try {
      await apiPost<Project>("/api/projects", { title, description: desc });
      setTitle("");
      setDesc("");
      await load();
    } catch (e) {
      console.error("POST /api/projects failed:", e);
      alert("Uložení se nezdařilo.");
    }
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditTitle(p.title);
    setEditDesc(p.description);
    setEditingOriginal({ title: p.title, description: p.description }); // <- originál pro porovnání
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDesc("");
    setEditingOriginal(null);
  };

  const saveEdit = async () => {
    if (!loggedIn) return alert("Přihlas se");
    if (!editingId) return;
    if (!editTitle.trim()) return alert("Název je povinný.");

    // potvrzení uložení, pouze pokud došlo ke změně
    const changed =
      !editingOriginal ||
      editingOriginal.title !== editTitle.trim() ||
      (editingOriginal.description ?? "") !== (editDesc ?? "");

    if (changed && !confirm("Uložit změny tohoto projektu?")) {
      return;
    }

    try {
      await apiPut<Project>(`/api/projects/${editingId}`, {
        title: editTitle.trim(),
        description: editDesc
      });
      cancelEdit();
      await load();
    } catch (e) {
      console.error("PUT /api/projects/:id failed:", e);
      alert("Uložení se nezdařilo.");
    }
  };

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/projects/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      console.error("DELETE /api/projects/:id failed:", e);
      alert("Smazání se nezdařilo.");
    }
  };

  // vyfiltrovaný seznam podle query (název i popis, case-insensitive)
  const debouncedQuery = useDebounce(query, 300);
  const filteredProjects = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [projects, debouncedQuery]);

  // seřazený seznam podle zvolených pravidel
  const sortedProjects = useMemo(() => {
    const arr = [...filteredProjects];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "title") {
        cmp = a.title.localeCompare(b.title, "cs", { sensitivity: "base" });
      } else {
        // id ~ pořadí vytvoření
        cmp = a.id - b.id;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredProjects, sortBy, sortDir]);

  return (
    <>
      <h1>Správa projektů</h1>
      <div className="projects-container">
        <header className="topbar">
          <div className="title">
            <span className="dot" />
            <span>{APP_NAME}</span>
          </div>
          <div className="actions">
            <button onClick={loginDemo} className="btn btn-primary" disabled={loading || loggedIn}>
              {loggedIn ? "Přihlášen" : "Přihlásit demo"}
            </button>
            <button
              onClick={async () => {
                localStorage.removeItem("token");
                setLoggedIn(false);
                setEditingId(null);
                await load();
              }}
              className="btn btn-ghost"
              disabled={!loggedIn}
            >
              Odhlásit
            </button>
          </div>
        </header>

        <section className="section">
          <h2 className="intro-title">Projekty</h2>

          <div className="toolbar">
            <input
              className="input"
              placeholder="Hledat podle názvu nebo popisu…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="btn" onClick={() => setQuery("")}>Vyčistit</button>
            )}
            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="title">Řadit: Název</option>
              <option value="id">Řadit: ID (pořadí)</option>
            </select>
            <button className="btn" onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}>
              {sortDir === "asc" ? "A→Z" : "Z→A"}
            </button>
            <span className="count">Zobrazeno: {sortedProjects.length}/{projects.length}</span>
          </div>

          <ul className="list">
            {sortedProjects.length === 0 && (
              <li className="card muted">Žádné projekty pro tento filtr.</li>
            )}

            {sortedProjects.map(p => (
              <li key={p.id} className="card">
                {editingId === p.id ? (
                  <div className="edit-row">
                    <input
                      className="input"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                      placeholder="Název"
                    />
                    <input
                      className="input"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                      placeholder="Popis"
                    />
                    <div className="card-actions">
                      <button className="btn btn-primary" onClick={saveEdit} disabled={!loggedIn || !editTitle.trim()}>
                        Uložit
                      </button>
                      <button className="btn btn-ghost" onClick={cancelEdit}>Zrušit</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <strong>{p.title}</strong>
                      <span className="muted"> — {p.description}</span>
                    </div>
                    {loggedIn && (
                      <div className="card-actions">
                        <button className="btn" onClick={() => startEdit(p)}>Upravit</button>
                        <button className="btn btn-danger" onClick={() => setDeleteTarget(p)}>Smazat</button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>

          <hr className="sep" />

          <h3 style={{ marginTop: 0 }}>Přidat projekt (vyžaduje přihlášení)</h3>
          <div className="form-grid">
            <input
              className="input"
              placeholder="Název"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addProject(); }}
            />
            <input
              className="input"
              placeholder="Popis"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addProject(); }}
            />
            <button className="btn btn-primary" onClick={addProject} disabled={!loggedIn || !title.trim()}>
              Uložit
            </button>
          </div>
        </section>
      </div>
      {/* KONEC: zúžený wrapper */}
      
      {/* ConfirmModal zůstává beze změny nebo ho můžeš později převést na třídy */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Smazat projekt"
        message={`Opravdu smazat projekt "${deleteTarget?.title}"?`}
        confirmText="Smazat"
        cancelText="Zrušit"
        onConfirm={confirmRemove}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
