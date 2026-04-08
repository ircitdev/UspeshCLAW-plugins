import {
  usePluginData,
  usePluginAction,
  useHostContext,
  type PluginPageProps,
} from "@paperclipai/plugin-sdk/ui";
import { useState } from "react";

const PROJECTS = [
  { id: "sitechist", name: "sitechist.ru", color: "#3b82f6" },
  { id: "itc34", name: "itc34.ru", color: "#8b5cf6" },
  { id: "uspeshnyy", name: "uspeshnyy.ru", color: "#10b981" },
];

const IconDomains = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 80 80" width={size} height={size} fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M9 11C6.803 11 5 12.803 5 15L5 65C5 67.197 6.803 69 9 69L71 69C73.197 69 75 67.197 75 65L75 27C75 24.803 73.197 23 71 23L70 23L70 21C70 18.803 68.197 17 66 17L28.166 17L27.205 14.693C26.274 12.459 24.086 11 21.668 11L9 11ZM9 13L21.668 13C23.285 13 24.738 13.968 25.359 15.461L26.834 19L66 19C67.117 19 68 19.883 68 21L68 23L9 23C8.269 23 7.592 23.214 7 23.561L7 15C7 13.883 7.883 13 9 13ZM9 25L71 25C72.117 25 73 25.883 73 27L73 65C73 66.117 72.117 67 71 67L9 67C7.883 67 7 66.117 7 65L7 27C7 25.883 7.883 25 9 25ZM50.984 27.986C50.44 28.012 50.012 28.458 50 29C50 39.481 58.519 48 69 48C69.552 48 70 47.552 70 47C70 46.449 69.552 46 69 46C59.599 46 52 38.401 52 29C52 28.434 51.548 27.96 50.984 27.986ZM55.984 27.986C55.44 28.012 55.012 28.458 55 29C55 36.72 61.28 43 69 43C69.552 43 70 42.552 70 42C70 41.449 69.552 41 69 41C62.36 41 57 35.64 57 29C57 28.434 56.548 27.96 55.984 27.986ZM60.984 27.986C60.44 28.012 60.012 28.458 60 29C60 33.959 64.041 38 69 38C69.552 38 70 37.552 70 37C70 36.449 69.552 36 69 36C65.123 36 62 32.877 62 29C62 28.434 61.548 27.96 60.984 27.986ZM65.984 27.986C65.44 28.012 65.012 28.458 65 29C65 31.197 66.803 33 69 33C69.552 33 70 32.552 70 32C70 31.449 69.552 31 69 31C67.883 31 67 30.117 67 29C67 28.434 66.548 27.96 65.984 27.986Z"/>
  </svg>
);

const s = {
  page: { padding: "1.5rem", fontFamily: "system-ui, sans-serif", color: "#e0e0e0", maxWidth: 1200 } as const,
  tabs: { display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "1px solid #333" } as const,
  tab: (active: boolean) => ({
    padding: "0.6rem 1.2rem", cursor: "pointer", background: active ? "#2a2a3a" : "transparent",
    color: active ? "#7dd3fc" : "#999", border: "none", fontSize: "0.9rem", fontWeight: active ? 600 : 400,
    borderBottom: active ? "2px solid #7dd3fc" : "2px solid transparent",
  } as const),
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.85rem" } as const,
  th: { textAlign: "left" as const, padding: "0.6rem", borderBottom: "1px solid #444", color: "#999", fontWeight: 500 } as const,
  td: { padding: "0.6rem", borderBottom: "1px solid #2a2a2a" } as const,
  badge: (c: string) => ({
    display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600,
    background: c === "green" ? "#064e3b" : c === "red" ? "#7f1d1d" : "#1e3a5f",
    color: c === "green" ? "#6ee7b7" : c === "red" ? "#fca5a5" : "#93c5fd",
  } as const),
  btn: (v: "primary" | "danger" | "ghost" = "ghost") => ({
    padding: "0.4rem 0.8rem", cursor: "pointer",
    border: v === "ghost" ? "1px solid #444" : "none", borderRadius: "0.375rem", fontSize: "0.8rem",
    background: v === "primary" ? "#2563eb" : v === "danger" ? "#991b1b" : "transparent",
    color: v === "primary" ? "#fff" : v === "danger" ? "#fca5a5" : "#ccc",
  } as const),
  card: { background: "#1a1a2e", borderRadius: "0.5rem", padding: "1rem", border: "1px solid #333", marginBottom: "1rem" } as const,
  formRow: { display: "flex", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" } as const,
  input: { padding: "0.4rem 0.6rem", background: "#1a1a2e", border: "1px solid #444", borderRadius: "0.375rem", color: "#e0e0e0", fontSize: "0.85rem", flex: 1 } as const,
  textarea: { padding: "0.4rem 0.6rem", background: "#1a1a2e", border: "1px solid #444", borderRadius: "0.375rem", color: "#e0e0e0", fontSize: "0.85rem", width: "100%", minHeight: 120, fontFamily: "monospace", resize: "vertical" as const } as const,
  mono: { fontFamily: "monospace", fontSize: "0.8rem" } as const,
  link: { color: "#7dd3fc", textDecoration: "none" } as const,
  h2: { fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", color: "#e0e0e0" } as const,
  label: { fontSize: "0.8rem", color: "#999", marginBottom: "0.25rem", display: "block" } as const,
};

// ── Project Config Tab ──

function ProjectConfigTab() {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ configs: any[] }>("project-cf-configs", { companyId });
  const saveConfig = usePluginAction("project-cf-config-save");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ cfEmail: "", cfApiKey: "", cfZoneId: "", serverIp: "2.27.63.110", domain: "" });
  const [msg, setMsg] = useState("");

  const configs = data?.configs || [];

  const startEdit = (c: any) => {
    setEditing(c.projectId);
    setForm(c.config || { cfEmail: "", cfApiKey: "", cfZoneId: "", serverIp: "2.27.63.110", domain: c.projectName });
  };

  const handleSave = async (projectId: string) => {
    await saveConfig({ projectId, ...form });
    setEditing(null);
    setMsg("Сохранено!");
    setTimeout(() => setMsg(""), 2000);
    refresh();
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 style={s.h2}>Cloudflare настройки по проектам ({configs.length})</h2>
      {msg && <div style={{ color: "#6ee7b7", marginBottom: "0.5rem", fontSize: "0.85rem" }}>{msg}</div>}

      {configs.map((c: any) => (
        <div key={c.projectId} style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div>
              <strong style={{ fontSize: "1rem" }}>{c.projectName}</strong>
              {c.config ? (
                <span style={{ ...s.badge("green"), marginLeft: "0.5rem" }}>настроен</span>
              ) : (
                <span style={{ ...s.badge("red"), marginLeft: "0.5rem" }}>не настроен</span>
              )}
            </div>
            <button style={s.btn()} onClick={() => editing === c.projectId ? setEditing(null) : startEdit(c)}>
              {editing === c.projectId ? "Свернуть" : "Настроить"}
            </button>
          </div>

          {c.config && editing !== c.projectId && (
            <div style={{ fontSize: "0.8rem", color: "#888" }}>
              Email: {c.config.cfEmail} | Zone: {c.config.cfZoneId?.slice(0, 12)}... | Domain: {c.config.domain || "—"} | IP: {c.config.serverIp}
            </div>
          )}

          {editing === c.projectId && (
            <div>
              <label style={s.label}>Cloudflare Email</label>
              <input style={{ ...s.input, marginBottom: "0.5rem" }} value={form.cfEmail} onChange={(e) => setForm({ ...form, cfEmail: e.target.value })} placeholder="user@example.com" />

              <label style={s.label}>Cloudflare Global API Key</label>
              <input style={{ ...s.input, marginBottom: "0.5rem" }} value={form.cfApiKey} onChange={(e) => setForm({ ...form, cfApiKey: e.target.value })} placeholder="cfk_..." type="password" />

              <label style={s.label}>Zone ID</label>
              <input style={{ ...s.input, marginBottom: "0.5rem" }} value={form.cfZoneId} onChange={(e) => setForm({ ...form, cfZoneId: e.target.value })} placeholder="f4d541e1..." />

              <label style={s.label}>Домен (для поддоменов)</label>
              <input style={{ ...s.input, marginBottom: "0.5rem" }} value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="sitechist.ru" />

              <label style={s.label}>IP сервера</label>
              <input style={{ ...s.input, marginBottom: "0.5rem" }} value={form.serverIp} onChange={(e) => setForm({ ...form, serverIp: e.target.value })} placeholder="2.27.63.110" />

              <button style={s.btn("primary")} onClick={() => handleSave(c.projectId)}>Сохранить</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Subdomains Tab ──

function SubdomainsTab() {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ subdomains: any[] }>("subdomains-list", { companyId });
  const createSub = usePluginAction("subdomain-create");
  const deleteSub = usePluginAction("subdomain-delete");
  const publishSub = usePluginAction("subdomain-publish");
  const [showCreate, setShowCreate] = useState(false);
  const [showPublish, setShowPublish] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [pubFilename, setPubFilename] = useState("index.html");
  const [pubContent, setPubContent] = useState("");
  const [error, setError] = useState("");

  const subdomains = data?.subdomains || [];

  const handleCreate = async () => {
    setError("");
    try { await createSub({ companyId, subdomain: newName }); setNewName(""); setShowCreate(false); refresh(); }
    catch (e: any) { setError(e.message || "Ошибка"); }
  };

  const handlePublish = async (id: string) => {
    setError("");
    try { await publishSub({ companyId, id, filename: pubFilename, content: pubContent }); setShowPublish(null); setPubContent(""); refresh(); }
    catch (e: any) { setError(e.message || "Ошибка"); }
  };

  return (
    <div>
      {error && <div style={{ ...s.card, borderColor: "#991b1b", color: "#fca5a5" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={s.h2}>Поддомены ({subdomains.length})</h2>
        <button style={s.btn("primary")} onClick={() => setShowCreate(!showCreate)}>+ Создать</button>
      </div>

      {showCreate && (
        <div style={s.card}>
          <div style={s.formRow}>
            <input style={s.input} placeholder="report-123" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <span style={{ color: "#666" }}>.sitechist.ru</span>
            <button style={s.btn("primary")} onClick={handleCreate}>Создать</button>
          </div>
        </div>
      )}

      {loading ? <div>Загрузка...</div> : (
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>Поддомен</th><th style={s.th}>Статус</th><th style={s.th}>Файлы</th>
            <th style={s.th}>Создан</th><th style={s.th}>Действия</th>
          </tr></thead>
          <tbody>
            {subdomains.map((sub: any) => (
              <tr key={sub.id}>
                <td style={{ ...s.td, ...s.mono }}><a href={`https://${sub.fullDomain}`} target="_blank" rel="noopener" style={s.link}>{sub.fullDomain}</a></td>
                <td style={s.td}><span style={s.badge(sub.status === "active" ? "green" : "red")}>{sub.status}</span></td>
                <td style={s.td}>{sub.files?.length || 0}</td>
                <td style={{ ...s.td, fontSize: "0.75rem" }}>{sub.createdAt ? new Date(sub.createdAt).toLocaleString("ru") : "—"}</td>
                <td style={s.td}>
                  <button style={s.btn()} onClick={() => setShowPublish(showPublish === sub.id ? null : sub.id)}>Публикация</button>
                  <button style={{ ...s.btn("danger"), marginLeft: 4 }} onClick={async () => { await deleteSub({ companyId, id: sub.id }); refresh(); }}>Удалить</button>
                </td>
              </tr>
            ))}
            {subdomains.length === 0 && <tr><td colSpan={5} style={{ ...s.td, textAlign: "center", color: "#666" }}>Нет поддоменов</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main Page ──

export function SubdomainsPage(_props: PluginPageProps) {
  const [tab, setTab] = useState<"subdomains" | "config">("subdomains");
  const [projectId, setProjectId] = useState(PROJECTS[0].id);

  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}><IconDomains size={24} /> Поддомены</h1>
          <p style={{ color: "#888", fontSize: "0.85rem", margin: 0 }}>Cloudflare DNS + публикация HTML</p>
        </div>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {PROJECTS.map(p => (
            <button key={p.id} onClick={() => setProjectId(p.id)} style={{
              padding: "0.35rem 0.75rem", borderRadius: "9999px", border: "2px solid",
              borderColor: projectId === p.id ? p.color : "#333",
              background: projectId === p.id ? p.color + "20" : "transparent",
              color: projectId === p.id ? "#fff" : "#888",
              fontSize: "0.8rem", fontWeight: projectId === p.id ? 600 : 400, cursor: "pointer",
            }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: p.color, marginRight: "0.4rem", verticalAlign: "middle" }} />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab === "subdomains")} onClick={() => setTab("subdomains")}>Поддомены</button>
        <button style={s.tab(tab === "config")} onClick={() => setTab("config")}>Настройки проектов</button>
      </div>

      {tab === "subdomains" && <SubdomainsTab />}
      {tab === "config" && <ProjectConfigTab />}
    </div>
  );
}

export function SubdomainsSidebarLink() {
  const { companyPrefix } = useHostContext();
  const href = companyPrefix ? `/${companyPrefix}/subdomains` : "/subdomains";
  return <a href={href} style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "0.5rem" }}>
    <IconDomains size={16} /> Поддомены
  </a>;
}
