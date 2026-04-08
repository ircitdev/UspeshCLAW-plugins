import { usePluginData, usePluginAction, useHostContext, type PluginPageProps } from "@paperclipai/plugin-sdk/ui";
import { useState } from "react";

const PROJECTS = [
  { id: "sitechist", name: "sitechist.ru", color: "#3b82f6" },
  { id: "itc34", name: "itc34.ru", color: "#8b5cf6" },
  { id: "uspeshnyy", name: "uspeshnyy.ru", color: "#10b981" },
];

const IconReport = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 80 80" width={size} height={size} fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M15 9L15 71L65 71L65 23.586L50.414 9L15 9ZM17 11L49 11L49 25L63 25L63 69L17 69L17 11ZM51 12.414L61.586 23L51 23L51 12.414ZM41 29C33.28 29 27 35.28 27 43C27 50.72 33.28 57 41 57C48.72 57 55 50.72 55 43C55 35.28 48.72 29 41 29ZM42 31.049C47.837 31.529 52.469 36.162 52.949 42L42 42L42 31.049ZM40 31.051L40 43.414L48.74 52.156C46.653 53.925 43.959 55 41 55C34.361 55 29 49.639 29 43C29 36.699 33.832 31.558 40 31.051ZM43.414 44L52.949 44C52.738 46.564 51.719 48.889 50.156 50.74L43.414 44Z"/>
  </svg>
);

const s = {
  page: { padding: "1.5rem", fontFamily: "system-ui, sans-serif", color: "#e0e0e0", maxWidth: 1200 } as const,
  tabs: { display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "1px solid #333" } as const,
  tab: (a: boolean) => ({ padding: "0.6rem 1.2rem", cursor: "pointer", background: a ? "#2a2a3a" : "transparent", color: a ? "#7dd3fc" : "#999", border: "none", fontSize: "0.9rem", fontWeight: a ? 600 : 400, borderBottom: a ? "2px solid #7dd3fc" : "2px solid transparent" } as const),
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.85rem" } as const,
  th: { textAlign: "left" as const, padding: "0.6rem", borderBottom: "1px solid #444", color: "#999", fontWeight: 500 } as const,
  td: { padding: "0.6rem", borderBottom: "1px solid #2a2a2a" } as const,
  badge: (c: string) => ({ display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600, background: c === "green" ? "#064e3b" : c === "blue" ? "#1e3a5f" : "#713f12", color: c === "green" ? "#6ee7b7" : c === "blue" ? "#93c5fd" : "#fde047" } as const),
  btn: (v: "primary" | "danger" | "ghost" | "small" = "ghost") => ({ padding: v === "small" ? "0.2rem 0.5rem" : "0.4rem 0.8rem", cursor: "pointer", border: v === "ghost" || v === "small" ? "1px solid #444" : "none", borderRadius: "0.375rem", fontSize: v === "small" ? "0.7rem" : "0.8rem", background: v === "primary" ? "#2563eb" : v === "danger" ? "#991b1b" : "transparent", color: v === "primary" ? "#fff" : v === "danger" ? "#fca5a5" : "#ccc" } as const),
  card: { background: "#1a1a2e", borderRadius: "0.5rem", padding: "1rem", border: "1px solid #333", marginBottom: "1rem" } as const,
  input: { padding: "0.4rem 0.6rem", background: "#1a1a2e", border: "1px solid #444", borderRadius: "0.375rem", color: "#e0e0e0", fontSize: "0.85rem", width: "100%", marginBottom: "0.5rem", display: "block", boxSizing: "border-box" as const } as const,
  textarea: { padding: "0.5rem", background: "#1a1a2e", border: "1px solid #444", borderRadius: "0.375rem", color: "#e0e0e0", fontSize: "0.8rem", width: "100%", minHeight: 100, fontFamily: "monospace", resize: "vertical" as const, boxSizing: "border-box" as const, marginBottom: "0.5rem", display: "block" } as const,
  label: { fontSize: "0.8rem", color: "#999", marginBottom: "0.25rem", display: "block" } as const,
  h2: { fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", color: "#e0e0e0" } as const,
  h3: { fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", color: "#ccc" } as const,
  mono: { fontFamily: "monospace", fontSize: "0.8rem" } as const,
  link: { color: "#7dd3fc", textDecoration: "none" } as const,
  section: { marginBottom: "1.5rem" } as const,
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" } as const,
  colorInput: { width: 50, height: 30, border: "1px solid #444", borderRadius: "0.25rem", cursor: "pointer", background: "transparent", padding: 0 } as const,
};

const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

// ── Config Tab ──

function ConfigTab() {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ configs: any[] }>("project-report-configs", { companyId });
  const saveConfig = usePluginAction("project-report-config-save");
  const saveGcs = usePluginAction("project-gcs-config-save");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [gcsForm, setGcsForm] = useState<any>({});
  const [msg, setMsg] = useState("");

  const configs = data?.configs || [];

  const startEdit = (c: any) => {
    setEditing(c.projectId);
    const cfg = c.config || {};
    setForm({
      branding: cfg.branding || { companyName: "", logo: "", slogan: "", primaryColor: "#2563eb", accentColor: "#7dd3fc" },
      contacts: cfg.contacts || { phone: "", email: "", website: "", telegram: "", address: "" },
      ctas: cfg.ctas || [],
      templates: cfg.templates || [],
      headerHtml: cfg.headerHtml || "",
      footerHtml: cfg.footerHtml || "",
    });
    setGcsForm(c.gcsConfig || { gcsProjectId: "", gcsBucket: "", gcsKeyJson: "" });
  };

  const handleSave = async (projectId: string) => {
    await saveConfig({ projectId, ...form });
    await saveGcs({ projectId, ...gcsForm });
    setEditing(null);
    setMsg("Сохранено!"); setTimeout(() => setMsg(""), 2000);
    refresh();
  };

  const addCta = () => setForm({ ...form, ctas: [...form.ctas, { id: crypto.randomUUID().slice(0, 8), name: "", title: "", text: "", buttonText: "", buttonUrl: "" }] });
  const removeCta = (i: number) => setForm({ ...form, ctas: form.ctas.filter((_: any, idx: number) => idx !== i) });
  const updateCta = (i: number, field: string, val: string) => { const c = [...form.ctas]; c[i] = { ...c[i], [field]: val }; setForm({ ...form, ctas: c }); };

  const addTemplate = () => setForm({ ...form, templates: [...form.templates, { id: crypto.randomUUID().slice(0, 8), name: "", description: "", bodyHtml: "" }] });
  const removeTemplate = (i: number) => setForm({ ...form, templates: form.templates.filter((_: any, idx: number) => idx !== i) });
  const updateTemplate = (i: number, field: string, val: string) => { const t = [...form.templates]; t[i] = { ...t[i], [field]: val }; setForm({ ...form, templates: t }); };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 style={s.h2}>Настройки по проектам</h2>
      {msg && <div style={{ color: "#6ee7b7", marginBottom: "0.5rem", fontSize: "0.85rem" }}>{msg}</div>}

      {configs.map((c: any) => (
        <div key={c.projectId} style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div>
              <strong style={{ fontSize: "1rem" }}>{c.projectName}</strong>
              {c.config ? <span style={{ ...s.badge("green"), marginLeft: "0.5rem" }}>настроен</span> : <span style={{ ...s.badge("yellow"), marginLeft: "0.5rem" }}>не настроен</span>}
            </div>
            <button style={s.btn()} onClick={() => editing === c.projectId ? setEditing(null) : startEdit(c)}>
              {editing === c.projectId ? "Свернуть" : "Настроить"}
            </button>
          </div>

          {c.config && editing !== c.projectId && (
            <div style={{ fontSize: "0.8rem", color: "#888" }}>
              {c.config.branding?.companyName || "—"} | CTA: {c.config.ctas?.length || 0} | Шаблонов: {c.config.templates?.length || 0} | GCS: {c.gcsConfig?.gcsBucket || "—"}
            </div>
          )}

          {editing === c.projectId && (
            <div>
              {/* BRANDING */}
              <div style={s.section}>
                <h3 style={s.h3}>Брендинг</h3>
                <div style={s.grid2}>
                  <div><label style={s.label}>Название компании</label><input style={s.input} value={form.branding.companyName} onChange={e => setForm({ ...form, branding: { ...form.branding, companyName: e.target.value } })} /></div>
                  <div><label style={s.label}>Слоган</label><input style={s.input} value={form.branding.slogan} onChange={e => setForm({ ...form, branding: { ...form.branding, slogan: e.target.value } })} /></div>
                </div>
                <label style={s.label}>URL логотипа</label><input style={s.input} value={form.branding.logo} onChange={e => setForm({ ...form, branding: { ...form.branding, logo: e.target.value } })} placeholder="https://..." />
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  <div><label style={s.label}>Primary</label><input type="color" style={s.colorInput} value={form.branding.primaryColor} onChange={e => setForm({ ...form, branding: { ...form.branding, primaryColor: e.target.value } })} /></div>
                  <div><label style={s.label}>Accent</label><input type="color" style={s.colorInput} value={form.branding.accentColor} onChange={e => setForm({ ...form, branding: { ...form.branding, accentColor: e.target.value } })} /></div>
                </div>
              </div>

              {/* CONTACTS */}
              <div style={s.section}>
                <h3 style={s.h3}>Контакты</h3>
                <div style={s.grid2}>
                  <div><label style={s.label}>Телефон</label><input style={s.input} value={form.contacts.phone} onChange={e => setForm({ ...form, contacts: { ...form.contacts, phone: e.target.value } })} /></div>
                  <div><label style={s.label}>Email</label><input style={s.input} value={form.contacts.email} onChange={e => setForm({ ...form, contacts: { ...form.contacts, email: e.target.value } })} /></div>
                  <div><label style={s.label}>Сайт</label><input style={s.input} value={form.contacts.website} onChange={e => setForm({ ...form, contacts: { ...form.contacts, website: e.target.value } })} /></div>
                  <div><label style={s.label}>Telegram</label><input style={s.input} value={form.contacts.telegram} onChange={e => setForm({ ...form, contacts: { ...form.contacts, telegram: e.target.value } })} /></div>
                </div>
                <label style={s.label}>Адрес</label><input style={s.input} value={form.contacts.address} onChange={e => setForm({ ...form, contacts: { ...form.contacts, address: e.target.value } })} />
              </div>

              {/* HEADER/FOOTER */}
              <div style={s.section}>
                <h3 style={s.h3}>Шапка / Подвал (HTML)</h3>
                <label style={s.label}>Кастомная шапка (оставьте пустым для стандартной)</label>
                <textarea style={{ ...s.textarea, minHeight: 60 }} value={form.headerHtml} onChange={e => setForm({ ...form, headerHtml: e.target.value })} placeholder="<div>Custom header HTML</div>" />
                <label style={s.label}>Кастомный подвал</label>
                <textarea style={{ ...s.textarea, minHeight: 60 }} value={form.footerHtml} onChange={e => setForm({ ...form, footerHtml: e.target.value })} placeholder="<div>Custom footer HTML</div>" />
              </div>

              {/* CTA BLOCKS */}
              <div style={s.section}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={s.h3}>CTA-блоки ({form.ctas.length})</h3>
                  <button style={s.btn("small")} onClick={addCta}>+ Добавить CTA</button>
                </div>
                {form.ctas.map((cta: any, i: number) => (
                  <div key={i} style={{ ...s.card, padding: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <strong style={{ fontSize: "0.85rem" }}>CTA #{i + 1}</strong>
                      <button style={s.btn("danger")} onClick={() => removeCta(i)}>x</button>
                    </div>
                    <div style={s.grid2}>
                      <div><label style={s.label}>Имя (для агента)</label><input style={s.input} value={cta.name} onChange={e => updateCta(i, "name", e.target.value)} placeholder="free-audit" /></div>
                      <div><label style={s.label}>Заголовок</label><input style={s.input} value={cta.title} onChange={e => updateCta(i, "title", e.target.value)} placeholder="Бесплатная проверка" /></div>
                    </div>
                    <label style={s.label}>Текст</label><input style={s.input} value={cta.text} onChange={e => updateCta(i, "text", e.target.value)} placeholder="Проверьте ваш сайт на соответствие 152-ФЗ" />
                    <div style={s.grid2}>
                      <div><label style={s.label}>Текст кнопки</label><input style={s.input} value={cta.buttonText} onChange={e => updateCta(i, "buttonText", e.target.value)} placeholder="Проверить бесплатно" /></div>
                      <div><label style={s.label}>URL кнопки</label><input style={s.input} value={cta.buttonUrl} onChange={e => updateCta(i, "buttonUrl", e.target.value)} placeholder="https://t.me/sitechist_bot" /></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* TEMPLATES */}
              <div style={s.section}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={s.h3}>Шаблоны отчётов ({form.templates.length})</h3>
                  <button style={s.btn("small")} onClick={addTemplate}>+ Добавить шаблон</button>
                </div>
                {form.templates.map((tpl: any, i: number) => (
                  <div key={i} style={{ ...s.card, padding: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <strong style={{ fontSize: "0.85rem" }}>Шаблон #{i + 1}</strong>
                      <button style={s.btn("danger")} onClick={() => removeTemplate(i)}>x</button>
                    </div>
                    <div style={s.grid2}>
                      <div><label style={s.label}>Имя</label><input style={s.input} value={tpl.name} onChange={e => updateTemplate(i, "name", e.target.value)} placeholder="audit-report" /></div>
                      <div><label style={s.label}>Описание</label><input style={s.input} value={tpl.description} onChange={e => updateTemplate(i, "description", e.target.value)} placeholder="Отчёт по аудиту сайта" /></div>
                    </div>
                    <label style={s.label}>HTML-тело шаблона</label>
                    <textarea style={s.textarea} value={tpl.bodyHtml} onChange={e => updateTemplate(i, "bodyHtml", e.target.value)} placeholder="<h1>{{title}}</h1><p>{{content}}</p>" />
                  </div>
                ))}
              </div>

              {/* GCS */}
              <div style={s.section}>
                <h3 style={s.h3}>Google Cloud Storage</h3>
                <div style={s.grid2}>
                  <div><label style={s.label}>Project ID</label><input style={s.input} value={gcsForm.gcsProjectId} onChange={e => setGcsForm({ ...gcsForm, gcsProjectId: e.target.value })} /></div>
                  <div><label style={s.label}>Bucket</label><input style={s.input} value={gcsForm.gcsBucket} onChange={e => setGcsForm({ ...gcsForm, gcsBucket: e.target.value })} /></div>
                </div>
                <label style={s.label}>Service Account Key (JSON)</label>
                <textarea style={{ ...s.textarea, minHeight: 80 }} value={gcsForm.gcsKeyJson} onChange={e => setGcsForm({ ...gcsForm, gcsKeyJson: e.target.value })} />
              </div>

              <button style={s.btn("primary")} onClick={() => handleSave(c.projectId)}>Сохранить все настройки</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Reports Tab ──

function ReportsTab() {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ reports: any[] }>("reports-list", { companyId });
  const createReport = usePluginAction("report-create");
  const deleteReport = usePluginAction("report-delete");
  const uploadGcs = usePluginAction("report-upload-gcs");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState(""); const [html, setHtml] = useState(""); const [toGcs, setToGcs] = useState(false);
  const [error, setError] = useState("");
  const reports = data?.reports || [];

  return (
    <div>
      {error && <div style={{ ...s.card, borderColor: "#991b1b", color: "#fca5a5" }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={s.h2}>Отчёты ({reports.length})</h2>
        <button style={s.btn("primary")} onClick={() => setShowCreate(!showCreate)}>+ Создать</button>
      </div>
      {showCreate && (
        <div style={s.card}>
          <input style={s.input} placeholder="Заголовок" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea style={{ ...s.textarea, minHeight: 200 }} placeholder="HTML-контент" value={html} onChange={e => setHtml(e.target.value)} />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem", cursor: "pointer" }}><input type="checkbox" checked={toGcs} onChange={e => setToGcs(e.target.checked)} /> GCS</label>
            <button style={s.btn("primary")} onClick={async () => { setError(""); try { await createReport({ companyId, title, htmlContent: html, uploadToGcs: toGcs }); setTitle(""); setHtml(""); setShowCreate(false); refresh(); } catch (e: any) { setError(e.message); } }}>Сохранить</button>
          </div>
        </div>
      )}
      {loading ? <div>Загрузка...</div> : (
        <table style={s.table}>
          <thead><tr><th style={s.th}>Заголовок</th><th style={s.th}>Статус</th><th style={s.th}>Размер</th><th style={s.th}>GCS</th><th style={s.th}>Создан</th><th style={s.th}>Действия</th></tr></thead>
          <tbody>
            {reports.map((r: any) => (
              <tr key={r.id}>
                <td style={s.td}>{r.title}</td>
                <td style={s.td}><span style={s.badge(r.status === "uploaded" ? "green" : "blue")}>{r.status === "uploaded" ? "GCS" : "локально"}</span></td>
                <td style={{ ...s.td, ...s.mono }}>{formatBytes(r.sizeBytes || 0)}</td>
                <td style={s.td}>{r.gcsUrl ? <a href={r.gcsUrl} target="_blank" rel="noopener" style={s.link}>Открыть</a> : "—"}</td>
                <td style={{ ...s.td, fontSize: "0.75rem" }}>{r.createdAt ? new Date(r.createdAt).toLocaleString("ru") : "—"}</td>
                <td style={s.td}>
                  {!r.gcsUrl && <button style={s.btn()} onClick={async () => { try { await uploadGcs({ companyId, id: r.id }); refresh(); } catch (e: any) { setError(e.message); } }}>GCS</button>}
                  <button style={{ ...s.btn("danger"), marginLeft: 4 }} onClick={async () => { await deleteReport({ companyId, id: r.id }); refresh(); }}>x</button>
                </td>
              </tr>
            ))}
            {reports.length === 0 && <tr><td colSpan={6} style={{ ...s.td, textAlign: "center", color: "#666" }}>Нет отчётов</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main ──

export function ReportsPage(_props: PluginPageProps) {
  const [tab, setTab] = useState<"reports" | "config">("reports");
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}><IconReport size={24} /> Отчёты</h1>
          <p style={{ color: "#888", fontSize: "0.85rem", margin: 0 }}>HTML-отчёты с брендингом, CTA, шаблонами и GCS</p>
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
        <button style={s.tab(tab === "reports")} onClick={() => setTab("reports")}>Отчёты</button>
        <button style={s.tab(tab === "config")} onClick={() => setTab("config")}>Настройки</button>
      </div>
      {tab === "reports" && <ReportsTab />}
      {tab === "config" && <ConfigTab />}
    </div>
  );
}

export function ReportsSidebarLink() {
  const { companyPrefix } = useHostContext();
  const href = companyPrefix ? `/${companyPrefix}/reports` : "/reports";
  return <a href={href} style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "0.5rem" }}><IconReport size={16} /> Отчёты</a>;
}
