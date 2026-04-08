import {
  usePluginData,
  usePluginAction,
  useHostContext,
  type PluginPageProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import { useState } from "react";

// ── Icon ──
const IconSmm = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M22.598 5.1C22.407 5.076 22.218 5.156 22.201 5.316C22.201 5.316 20.617 7.614 18.701 10.225C16.785 12.836 14.508 15.781 13.252 16.969C11.32 18.795 10 21.225 10 23.941L10 30.5C10 36.293 14.707 41 20.5 41L29.84 41C33.112 41 35.879 38.558 36.289 35.312L37.652 25.568L37.996 23.123C38.374 20.425 36.263 18 33.539 18L24.375 18C24.163 18 24.055 17.916 23.975 17.773C23.895 17.631 23.871 17.421 23.963 17.205C24.785 15.286 25.259 13.694 25.646 11.787C25.854 10.767 26.01 10 26.01 9.307C26.01 7.551 25.178 6.442 24.355 5.846C23.533 5.249 22.697 5.107 22.697 5.107Z"/>
  </svg>
);

// ── Projects ──
const PROJECTS = [
  { id: "sitechist", name: "sitechist.ru" },
  { id: "itc34", name: "itc34.ru" },
  { id: "uspeshnyy", name: "uspeshnyy.ru" },
];

const PLATFORMS = ["vk", "instagram", "telegram", "x", "facebook", "youtube", "linkedin", "dzen", "wordpress", "telegraph"];

const PLATFORM_LABELS: Record<string, string> = {
  vk: "VK", instagram: "Instagram", telegram: "Telegram", x: "X (Twitter)",
  facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn",
  dzen: "Дзен", wordpress: "WordPress", telegraph: "Telegra.ph",
};

// ── Styles (shared with sitechist-devices) ──
const s = {
  page: { padding: "1.5rem", fontFamily: "system-ui, sans-serif", color: "#e0e0e0", maxWidth: 1400 } as const,
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
    background: c === "green" ? "#064e3b" : c === "red" ? "#7f1d1d" : c === "yellow" ? "#713f12" : "#1e3a5f",
    color: c === "green" ? "#6ee7b7" : c === "red" ? "#fca5a5" : c === "yellow" ? "#fde047" : "#93c5fd",
  } as const),
  btn: (v: "primary" | "danger" | "ghost" | "small" = "ghost") => ({
    padding: v === "small" ? "0.2rem 0.5rem" : "0.4rem 0.8rem", cursor: "pointer",
    border: v === "ghost" || v === "small" ? "1px solid #444" : "none", borderRadius: "0.375rem",
    fontSize: v === "small" ? "0.7rem" : "0.8rem",
    background: v === "primary" ? "#2563eb" : v === "danger" ? "#991b1b" : "transparent",
    color: v === "primary" ? "#fff" : v === "danger" ? "#fca5a5" : "#ccc",
  } as const),
  formRow: { display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" as const, alignItems: "center" } as const,
  input: { padding: "0.4rem 0.6rem", background: "#1a1a2e", border: "1px solid #444", borderRadius: "0.375rem", color: "#e0e0e0", fontSize: "0.85rem", minWidth: 140 } as const,
  select: { padding: "0.4rem 0.6rem", background: "#1a1a2e", border: "1px solid #444", borderRadius: "0.375rem", color: "#e0e0e0", fontSize: "0.85rem" } as const,
  card: { background: "#1a1a2e", borderRadius: "0.5rem", padding: "1rem", border: "1px solid #333", marginBottom: "1rem" } as const,
  h2: { fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", color: "#e0e0e0" } as const,
  mono: { fontFamily: "monospace", fontSize: "0.8rem" } as const,
  modal: { position: "fixed" as const, top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modalBox: { background: "#1a1a2e", border: "1px solid #444", borderRadius: "0.75rem", padding: "1.5rem", minWidth: 380, maxWidth: 560, maxHeight: "80vh", overflowY: "auto" as const } as const,
  textarea: { padding: "0.4rem 0.6rem", background: "#1a1a2e", border: "1px solid #444", borderRadius: "0.375rem", color: "#e0e0e0", fontSize: "0.85rem", width: "100%", minHeight: 80, resize: "vertical" as const } as const,
};

const statusColor = (st: string) =>
  st === "active" ? "green" : st === "error" ? "red" : st === "disabled" ? "yellow" : "blue";

// ── Project Selector ──
function ProjectSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select style={s.select} value={value} onChange={e => onChange(e.target.value)}>
      {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

// ── Accounts Tab ──
function AccountsTab({ projectId: pid }: { projectId?: string }) {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ accounts: any[]; projects: any[] }>("smm-accounts", { companyId, projectId: pid });
  const createAccount = usePluginAction("smm-account-create");
  const deleteAccount = usePluginAction("smm-account-delete");
  const checkAccount = usePluginAction("smm-account-check");
  const checkAll = usePluginAction("smm-account-check-all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ platform: "vk", projectId: pid || PROJECTS[0].id, accountName: "", accountUrl: "", apiToken: "", login: "", password: "", oauthToken: "", note: "" });
  const [checking, setChecking] = useState<string | null>(null);

  const accounts: any[] = data?.accounts || [];

  async function handleCreate() {
    await createAccount({ companyId, ...form });
    setShowForm(false);
    setForm({ platform: "vk", projectId: PROJECTS[0].id, accountName: "", accountUrl: "", apiToken: "", login: "", password: "", oauthToken: "", note: "" });
    refresh();
  }

  async function handleCheck(id: string) {
    setChecking(id);
    await checkAccount({ companyId, id });
    setChecking(null);
    refresh();
  }

  async function handleCheckAll() {
    setChecking("all");
    await checkAll({ companyId });
    setChecking(null);
    refresh();
  }

  const needsApiToken = ["vk", "telegram", "x", "facebook", "youtube", "telegraph"];
  const needsLoginPassword = ["instagram", "dzen", "wordpress"];
  const needsOAuth = ["linkedin"];

  return (
    <div>
      <div style={s.formRow}>
        <button style={s.btn("primary")} onClick={() => setShowForm(true)}>+ Добавить аккаунт</button>
        <button style={s.btn()} onClick={handleCheckAll} disabled={checking === "all"}>
          {checking === "all" ? "Проверяю..." : "Проверить все"}
        </button>
        <button style={s.btn()} onClick={refresh}>Обновить</button>
        <span style={{ color: "#666", fontSize: "0.8rem" }}>{accounts.length} аккаунт(ов)</span>
      </div>

      {loading && <div style={{ color: "#666" }}>Загрузка...</div>}

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Платформа</th>
            <th style={s.th}>Аккаунт</th>
            <th style={s.th}>Проект</th>
            <th style={s.th}>Статус</th>
            <th style={s.th}>Проверено</th>
            <th style={s.th}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a: any) => (
            <tr key={a.id}>
              <td style={s.td}><span style={{ fontWeight: 600 }}>{PLATFORM_LABELS[a.platform] || a.platform}</span></td>
              <td style={s.td}>
                <span style={s.mono}>{a.accountName || a.login || a.apiToken?.slice(0, 12) + "…" || "—"}</span>
                {a.accountUrl && <div style={{ fontSize: "0.75rem", color: "#666" }}>{a.accountUrl}</div>}
                {a.statusDetail && <div style={{ fontSize: "0.75rem", color: "#888" }}>{a.statusDetail}</div>}
              </td>
              <td style={s.td}>{PROJECTS.find(p => p.id === a.projectId)?.name || a.projectId}</td>
              <td style={s.td}><span style={s.badge(statusColor(a.status))}>{a.status || "unknown"}</span></td>
              <td style={s.td} title={a.lastCheckedAt || "—"}>
                <span style={{ color: "#666", fontSize: "0.75rem" }}>{a.lastCheckedAt ? new Date(a.lastCheckedAt).toLocaleDateString("ru") : "—"}</span>
              </td>
              <td style={s.td}>
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  <button style={s.btn("small")} onClick={() => handleCheck(a.id)} disabled={checking === a.id}>
                    {checking === a.id ? "…" : "Проверить"}
                  </button>
                  <button style={{ ...s.btn("small"), color: "#fca5a5", borderColor: "#7f1d1d" }}
                    onClick={async () => { await deleteAccount({ companyId, id: a.id }); refresh(); }}>
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!loading && !accounts.length && (
            <tr><td colSpan={6} style={{ ...s.td, color: "#555", textAlign: "center", padding: "2rem" }}>Аккаунты не добавлены</td></tr>
          )}
        </tbody>
      </table>

      {showForm && (
        <div style={s.modal} onClick={() => setShowForm(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={s.h2}>Добавить аккаунт</h3>
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Платформа</label>
              <select style={s.select} value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </select>
            </div>
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Проект</label>
              <ProjectSelector value={form.projectId} onChange={v => setForm(f => ({ ...f, projectId: v }))} />
            </div>
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Название</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="@username или название" value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} />
            </div>
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>URL</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="https://..." value={form.accountUrl} onChange={e => setForm(f => ({ ...f, accountUrl: e.target.value }))} />
            </div>
            {(needsApiToken.includes(form.platform)) && (
              <div style={s.formRow}>
                <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>API Token</label>
                <input style={{ ...s.input, flex: 1 }} type="password" placeholder="Token / API Key" value={form.apiToken} onChange={e => setForm(f => ({ ...f, apiToken: e.target.value }))} />
              </div>
            )}
            {(needsLoginPassword.includes(form.platform)) && (<>
              <div style={s.formRow}>
                <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Логин</label>
                <input style={{ ...s.input, flex: 1 }} placeholder="login / email" value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} />
              </div>
              <div style={s.formRow}>
                <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Пароль</label>
                <input style={{ ...s.input, flex: 1 }} type="password" placeholder="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </>)}
            {(needsOAuth.includes(form.platform)) && (
              <div style={s.formRow}>
                <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>OAuth Token</label>
                <input style={{ ...s.input, flex: 1 }} type="password" placeholder="OAuth access token" value={form.oauthToken} onChange={e => setForm(f => ({ ...f, oauthToken: e.target.value }))} />
              </div>
            )}
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Заметка</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="опционально" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button style={s.btn()} onClick={() => setShowForm(false)}>Отмена</button>
              <button style={s.btn("primary")} onClick={handleCreate}>Добавить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Content Plan Tab ──
function ContentPlanTab({ projectId }: { projectId?: string }) {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ posts: any[] }>("smm-content-plan", { projectId: projectId || PROJECTS[0].id });
  const createPost = usePluginAction("smm-post-draft-create");
  const updatePost = usePluginAction("smm-post-draft-update");
  const deletePost = usePluginAction("smm-post-delete");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    text: "", platforms: [] as string[], hashtags: "", scheduleAt: "", utmUrl: "", note: "", status: "draft",
  });

  const posts: any[] = data?.posts || [];

  function openEdit(post: any) {
    setEditId(post.id);
    setForm({ text: post.text, platforms: post.platforms || [], hashtags: post.hashtags || "", scheduleAt: post.scheduleAt || "", utmUrl: post.utmUrl || "", note: post.note || "", status: post.status });
    setShowForm(true);
  }

  async function handleSave() {
    if (editId) {
      await updatePost({ projectId, id: editId, ...form });
    } else {
      await createPost({ companyId, projectId, ...form });
    }
    setShowForm(false);
    setEditId(null);
    setForm({ text: "", platforms: [], hashtags: "", scheduleAt: "", utmUrl: "", note: "", status: "draft" });
    refresh();
  }

  function togglePlatform(p: string) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));
  }

  const postStatusColor = (st: string) =>
    st === "published" ? "green" : st === "scheduled" ? "blue" : st === "draft" ? "yellow" : "blue";

  return (
    <div>
      <div style={s.formRow}>
        <button style={s.btn("primary")} onClick={() => { setEditId(null); setForm({ text: "", platforms: [], hashtags: "", scheduleAt: "", utmUrl: "", note: "", status: "draft" }); setShowForm(true); }}>+ Новый пост</button>
        <button style={s.btn()} onClick={refresh}>Обновить</button>
        <span style={{ color: "#666", fontSize: "0.8rem" }}>{posts.length} пост(ов)</span>
      </div>

      {loading && <div style={{ color: "#666" }}>Загрузка...</div>}

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Дата</th>
            <th style={s.th}>Платформы</th>
            <th style={s.th}>Текст</th>
            <th style={s.th}>Статус</th>
            <th style={s.th}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {posts.sort((a, b) => (a.scheduleAt || "").localeCompare(b.scheduleAt || "")).map((p: any) => (
            <tr key={p.id}>
              <td style={s.td}>
                <span style={{ fontSize: "0.8rem" }}>{p.scheduleAt ? new Date(p.scheduleAt).toLocaleString("ru", { dateStyle: "short", timeStyle: "short" }) : "—"}</span>
              </td>
              <td style={s.td}>
                <div style={{ display: "flex", gap: "0.2rem", flexWrap: "wrap" }}>
                  {(p.platforms || []).map((pl: string) => (
                    <span key={pl} style={{ ...s.badge("blue"), fontSize: "0.7rem" }}>{pl}</span>
                  ))}
                </div>
              </td>
              <td style={s.td}>
                <div style={{ maxWidth: 400, fontSize: "0.83rem" }}>{p.text?.slice(0, 100)}{(p.text?.length || 0) > 100 ? "…" : ""}</div>
                {p.hashtags && <div style={{ fontSize: "0.75rem", color: "#7dd3fc" }}>{p.hashtags.slice(0, 60)}</div>}
              </td>
              <td style={s.td}><span style={s.badge(postStatusColor(p.status))}>{p.status}</span></td>
              <td style={s.td}>
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  <button style={s.btn("small")} onClick={() => openEdit(p)}>Изменить</button>
                  <button style={{ ...s.btn("small"), color: "#fca5a5", borderColor: "#7f1d1d" }}
                    onClick={async () => { await deletePost({ projectId, id: p.id }); refresh(); }}>
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!loading && !posts.length && (
            <tr><td colSpan={5} style={{ ...s.td, color: "#555", textAlign: "center", padding: "2rem" }}>Посты не запланированы</td></tr>
          )}
        </tbody>
      </table>

      {showForm && (
        <div style={s.modal} onClick={() => setShowForm(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={s.h2}>{editId ? "Редактировать пост" : "Новый пост"}</h3>
            <div style={{ marginBottom: "0.5rem" }}>
              <label style={{ color: "#999", fontSize: "0.8rem" }}>Текст поста</label>
              <textarea style={s.textarea} value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Текст поста..." rows={5} />
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <label style={{ color: "#999", fontSize: "0.8rem", display: "block", marginBottom: "0.3rem" }}>Платформы</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => togglePlatform(p)} style={{
                    padding: "0.2rem 0.5rem", borderRadius: "0.375rem", fontSize: "0.75rem", cursor: "pointer", border: "1px solid",
                    background: form.platforms.includes(p) ? "#1e3a5f" : "transparent",
                    borderColor: form.platforms.includes(p) ? "#3b82f6" : "#444",
                    color: form.platforms.includes(p) ? "#93c5fd" : "#888",
                  }}>{PLATFORM_LABELS[p]}</button>
                ))}
              </div>
            </div>
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Хэштеги</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="#152ФЗ #ПДПД ..." value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} />
            </div>
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Дата/время</label>
              <input style={{ ...s.input, flex: 1 }} type="datetime-local" value={form.scheduleAt} onChange={e => setForm(f => ({ ...f, scheduleAt: e.target.value }))} />
            </div>
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>UTM URL</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="https://..." value={form.utmUrl} onChange={e => setForm(f => ({ ...f, utmUrl: e.target.value }))} />
            </div>
            {editId && (
              <div style={s.formRow}>
                <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Статус</label>
                <select style={s.select} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="draft">Черновик</option>
                  <option value="scheduled">Запланирован</option>
                  <option value="published">Опубликован</option>
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button style={s.btn()} onClick={() => setShowForm(false)}>Отмена</button>
              <button style={s.btn("primary")} onClick={handleSave}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── UTM Tab ──
function UtmTab({ projectId }: { projectId?: string }) {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ links: any[] }>("smm-utm-links", { companyId });
  const generateUtm = usePluginAction("smm-utm-generate");

  const [form, setForm] = useState({ projectId: PROJECTS[0].id, url: "", platform: "vk", campaign: "", content: "" });
  const [result, setResult] = useState<{ shortUrl: string; fullUrl: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const links: any[] = data?.links || [];

  async function handleGenerate() {
    setGenerating(true);
    const r = await generateUtm({ companyId, ...form }) as any;
    if (r?.ok) setResult({ shortUrl: r.shortUrl, fullUrl: r.fullUrl });
    setGenerating(false);
    refresh();
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div>
      <div style={s.card}>
        <h3 style={s.h2}>Генератор UTM-ссылок</h3>
        <div style={s.formRow}>
          <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 70 }}>Проект</label>
          <ProjectSelector value={form.projectId} onChange={v => setForm(f => ({ ...f, projectId: v }))} />
        </div>
        <div style={s.formRow}>
          <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 70 }}>URL</label>
          <input style={{ ...s.input, flex: 1 }} placeholder="https://sitechist.ru/check" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
        </div>
        <div style={s.formRow}>
          <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 70 }}>Платформа</label>
          <select style={s.select} value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
            {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
          </select>
        </div>
        <div style={s.formRow}>
          <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 70 }}>Campaign</label>
          <input style={{ ...s.input, flex: 1 }} placeholder="авто (= projectId)" value={form.campaign} onChange={e => setForm(f => ({ ...f, campaign: e.target.value }))} />
          <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 70 }}>Content</label>
          <input style={{ ...s.input, flex: 1 }} placeholder="опционально" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        </div>
        <button style={s.btn("primary")} onClick={handleGenerate} disabled={generating || !form.url}>
          {generating ? "Генерирую..." : "Сгенерировать"}
        </button>

        {result && (
          <div style={{ ...s.card, marginTop: "1rem", background: "#0d1f0d", borderColor: "#1a5c1a" }}>
            <div style={{ marginBottom: "0.5rem" }}>
              <span style={{ color: "#6ee7b7", fontWeight: 600, fontSize: "0.85rem" }}>Короткая ссылка:</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                <span style={s.mono}>{result.shortUrl}</span>
                <button style={s.btn("small")} onClick={() => copyToClipboard(result.shortUrl, "short")}>
                  {copied === "short" ? "✓ Скопировано" : "Копировать"}
                </button>
              </div>
            </div>
            <div>
              <span style={{ color: "#999", fontSize: "0.8rem" }}>Полная:</span>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.25rem" }}>
                <span style={{ ...s.mono, wordBreak: "break-all", color: "#888", fontSize: "0.75rem" }}>{result.fullUrl}</span>
                <button style={s.btn("small")} onClick={() => copyToClipboard(result.fullUrl, "full")}>
                  {copied === "full" ? "✓" : "Копировать"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <h3 style={s.h2}>История ссылок</h3>
      {loading && <div style={{ color: "#666" }}>Загрузка...</div>}
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Короткая</th>
            <th style={s.th}>Платформа</th>
            <th style={s.th}>Проект</th>
            <th style={s.th}>Исходный URL</th>
            <th style={s.th}>Создана</th>
          </tr>
        </thead>
        <tbody>
          {[...links].reverse().slice(0, 50).map((l: any) => (
            <tr key={l.id}>
              <td style={s.td}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ ...s.mono, color: "#7dd3fc" }}>{l.shortUrl}</span>
                  <button style={s.btn("small")} onClick={() => copyToClipboard(l.shortUrl, l.id)}>
                    {copied === l.id ? "✓" : "↗"}
                  </button>
                </div>
              </td>
              <td style={s.td}><span style={s.badge("blue")}>{l.platform}</span></td>
              <td style={s.td}>{l.projectId}</td>
              <td style={s.td}><span style={{ ...s.mono, fontSize: "0.75rem", color: "#666" }}>{l.originalUrl?.slice(0, 50)}</span></td>
              <td style={s.td}><span style={{ color: "#666", fontSize: "0.75rem" }}>{l.createdAt ? new Date(l.createdAt).toLocaleDateString("ru") : "—"}</span></td>
            </tr>
          ))}
          {!loading && !links.length && (
            <tr><td colSpan={5} style={{ ...s.td, color: "#555", textAlign: "center", padding: "2rem" }}>Ссылки ещё не генерировались</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Hashtags Tab ──
function HashtagsTab({ projectId }: { projectId?: string }) {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ sets: any[] }>("smm-hashtags", { projectId });
  const saveSet = usePluginAction("smm-hashtag-set-save");
  const deleteSet = usePluginAction("smm-hashtag-set-delete");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", tags: "", category: "general" });
  const [copied, setCopied] = useState<string | null>(null);

  const sets: any[] = data?.sets || [];

  async function handleSave() {
    await saveSet({ companyId, projectId, id: editId || undefined, ...form });
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", tags: "", category: "general" });
    refresh();
  }

  function openEdit(set: any) {
    setEditId(set.id);
    setForm({ name: set.name, tags: set.tags, category: set.category || "general" });
    setShowForm(true);
  }

  function copyTags(tags: string, id: string) {
    navigator.clipboard.writeText(tags).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const CATEGORIES = ["general", "152фз", "38фз", "продажи", "кейс", "news", "tips"];

  return (
    <div>
      <div style={s.formRow}>
        <button style={s.btn("primary")} onClick={() => { setEditId(null); setForm({ name: "", tags: "", category: "general" }); setShowForm(true); }}>+ Новый набор</button>
        <button style={s.btn()} onClick={refresh}>Обновить</button>
      </div>

      {loading && <div style={{ color: "#666" }}>Загрузка...</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
        {sets.map((set: any) => (
          <div key={set.id} style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{set.name}</span>
                <span style={{ ...s.badge("blue"), marginLeft: "0.5rem" }}>{set.category}</span>
              </div>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                <button style={s.btn("small")} onClick={() => openEdit(set)}>Изменить</button>
                <button style={{ ...s.btn("small"), color: "#fca5a5", borderColor: "#7f1d1d" }}
                  onClick={async () => { await deleteSet({ projectId, id: set.id }); refresh(); }}>
                  Удалить
                </button>
              </div>
            </div>
            <div style={{ background: "#111120", borderRadius: "0.375rem", padding: "0.5rem", marginBottom: "0.5rem", fontSize: "0.8rem", color: "#7dd3fc", lineHeight: 1.6, minHeight: 40 }}>
              {set.tags || <span style={{ color: "#444" }}>пусто</span>}
            </div>
            <button style={s.btn("small")} onClick={() => copyTags(set.tags, set.id)}>
              {copied === set.id ? "✓ Скопировано" : "Копировать хэштеги"}
            </button>
          </div>
        ))}
        {!loading && !sets.length && (
          <div style={{ ...s.card, color: "#555", textAlign: "center", gridColumn: "1 / -1" }}>Наборы хэштегов не созданы</div>
        )}
      </div>

      {showForm && (
        <div style={s.modal} onClick={() => setShowForm(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={s.h2}>{editId ? "Редактировать набор" : "Новый набор хэштегов"}</h3>
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Название</label>
              <input style={{ ...s.input, flex: 1 }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Напр: Основные #152ФЗ" />
            </div>
            <div style={s.formRow}>
              <label style={{ color: "#999", fontSize: "0.8rem", minWidth: 80 }}>Категория</label>
              <select style={s.select} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <label style={{ color: "#999", fontSize: "0.8rem", display: "block", marginBottom: "0.3rem" }}>Хэштеги (через пробел)</label>
              <textarea style={s.textarea} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="#152ФЗ #персональныеданные #ФЗ152 #ПДПД #ЗащитаПД" rows={4} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button style={s.btn()} onClick={() => setShowForm(false)}>Отмена</button>
              <button style={s.btn("primary")} onClick={handleSave}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ──
function SettingsTab({ projectId }: { projectId?: string }) {
  const { companyId } = useHostContext();
  const pid = projectId || PROJECTS[0].id;
  const { data, loading, refresh } = usePluginData<{ projects: Record<string, any> }>("smm-settings", { companyId });
  const saveSettings = usePluginAction("smm-settings-save");
  const [guidelinesJson, setGuidelinesJson] = useState("");
  const [scheduleJson, setScheduleJson] = useState("");
  const [lastProjectId, setLastProjectId] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const defaultGuidelines = { tone: "", brandVoice: "", emojiStyle: "", forbiddenWords: [], signatureTemplate: "", ctaTemplates: [], platformRules: {} };
  const defaultSchedule = { timezone: "Europe/Moscow", bestTimes: {}, frequency: {} };

  // Re-init when project changes
  if (!loading && data?.projects && lastProjectId !== pid) {
    const pd = data.projects[pid] || {};
    setGuidelinesJson(JSON.stringify(pd.guidelines || defaultGuidelines, null, 2));
    setScheduleJson(JSON.stringify(pd.schedule || defaultSchedule, null, 2));
    setLastProjectId(pid);
  }

  async function handleSave() {
    setError("");
    let guidelines: any, schedule: any;
    try { guidelines = JSON.parse(guidelinesJson); } catch { setError("Ошибка JSON в Guidelines"); return; }
    try { schedule = JSON.parse(scheduleJson); } catch { setError("Ошибка JSON в Schedule"); return; }
    await saveSettings({ companyId, projectId, guidelines, schedule });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refresh();
  }

  return (
    <div>
      

      {loading && <div style={{ color: "#666" }}>Загрузка...</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <h3 style={{ ...s.h2, marginBottom: "0.5rem" }}>
            Guidelines (tone, brand voice, CTA, platformRules)
          </h3>
          <textarea
            style={{ ...s.textarea, minHeight: 350, background: "#0d0d1a" }}
            value={guidelinesJson}
            onChange={e => setGuidelinesJson(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div>
          <h3 style={{ ...s.h2, marginBottom: "0.5rem" }}>
            Schedule (timezone, bestTimes, frequency)
          </h3>
          <textarea
            style={{ ...s.textarea, minHeight: 350, background: "#0d0d1a" }}
            value={scheduleJson}
            onChange={e => setScheduleJson(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      {error && <div style={{ color: "#fca5a5", marginTop: "0.5rem", fontSize: "0.85rem" }}>{error}</div>}
      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button style={s.btn("primary")} onClick={handleSave}>Сохранить настройки</button>
        {saved && <span style={{ color: "#6ee7b7", fontSize: "0.85rem" }}>✓ Сохранено</span>}
      </div>

      <div style={{ ...s.card, marginTop: "1.5rem", background: "#111120" }}>
        <h4 style={{ margin: "0 0 0.5rem", color: "#7dd3fc", fontSize: "0.85rem" }}>Shortener: go.sitechist.ru</h4>
        <p style={{ color: "#666", fontSize: "0.8rem", margin: 0 }}>
          Короткие ссылки генерируются автоматически при использовании вкладки UTM.
          Для редиректа настройте Caddy на VPS: <code style={s.mono}>go.sitechist.ru/{"{"}code{"}"} → полный URL из состояния плагина</code>.
        </p>
      </div>
    </div>
  );
}

// ── URL State ──
function getSmmHash(): { tab: string; project: string } {
  if (typeof window === "undefined") return { tab: "accounts", project: "" };
  const h = window.location.hash.replace("#", "");
  const parts = h.split("/");
  return {
    project: parts[0] && PROJECTS.some(p => p.id === parts[0]) ? parts[0] : "",
    tab: parts[1] && ["accounts", "plan", "utm", "hashtags", "settings", "branding"].includes(parts[1]) ? parts[1] : "accounts",
  };
}

// ── Branding Tab ──
function BrandingTab({ projectId }: { projectId?: string }) {
  const { companyId } = useHostContext();
  const pid = projectId || PROJECTS[0].id;
  const { data, loading, refetch: refresh } = usePluginData<{ projects: Record<string, any> }>("smm-settings", { companyId });
  const saveSettings = usePluginAction("smm-settings-save");
  const [saved, setSaved] = useState(false);

  const branding = data?.projects?.[pid]?.branding || {};
  const [logoDark, setLogoDark] = useState(branding.logoDark || "");
  const [logoLight, setLogoLight] = useState(branding.logoLight || "");
  const [titleFont, setTitleFont] = useState(branding.titleFont || "system-ui, sans-serif");
  const [titleSize, setTitleSize] = useState(branding.titleSize || "48");
  const [titleColor, setTitleColor] = useState(branding.titleColor || "#FFFFFF");
  const [titleColor2, setTitleColor2] = useState(branding.titleColor2 || "");
  const [titleGradient, setTitleGradient] = useState(branding.titleGradient ?? false);
  const [titleColorDark, setTitleColorDark] = useState(branding.titleColorDark || "#FFFFFF");
  const [titleColorLight, setTitleColorLight] = useState(branding.titleColorLight || "#111111");
  const [titlePosition, setTitlePosition] = useState(branding.titlePosition || "bottom-left");
  const [titleShadow, setTitleShadow] = useState(branding.titleShadow ?? true);
  const [logoPosition, setLogoPosition] = useState(branding.logoPosition || "top-left");
  const [logoSize, setLogoSize] = useState(branding.logoSize || "60");
  const [linkText, setLinkText] = useState(branding.linkText || "");
  const [linkPosition, setLinkPosition] = useState(branding.linkPosition || "bottom-right");
  const [linkColor, setLinkColor] = useState(branding.linkColor || "#93c5fd");
  const [openaiApiKey, setOpenaiApiKey] = useState(branding.openaiApiKey || "");
  const [ctaVk, setCtaVk] = useState(branding.subscribeCta?.vk || "");
  const [ctaTelegram, setCtaTelegram] = useState(branding.subscribeCta?.telegram || "");
  const [ctaTelegraph, setCtaTelegraph] = useState(branding.subscribeCta?.telegraph || "");
  const [vkRepostUrl, setVkRepostUrl] = useState(branding.vkRepostUrl || "");

  // Sync from loaded data when project changes
  const [lastPid, setLastPid] = useState("");
  if (!loading && data?.projects && lastPid !== pid) {
    const b = data.projects[pid]?.branding || {};
    setLogoDark(b.logoDark || ""); setLogoLight(b.logoLight || "");
    setTitleFont(b.titleFont || "system-ui, sans-serif");
    setTitleSize(b.titleSize || "48"); setTitleColor(b.titleColor || "#FFFFFF");
    setTitleColor2(b.titleColor2 || ""); setTitleGradient(b.titleGradient ?? false);
    setTitleColorDark(b.titleColorDark || "#FFFFFF"); setTitleColorLight(b.titleColorLight || "#111111");
    setTitlePosition(b.titlePosition || "bottom-left"); setTitleShadow(b.titleShadow ?? true);
    setLogoPosition(b.logoPosition || "top-left"); setLogoSize(b.logoSize || "60");
    setLinkText(b.linkText || ""); setLinkPosition(b.linkPosition || "bottom-right");
    setLinkColor(b.linkColor || "#93c5fd");
    setOpenaiApiKey(b.openaiApiKey || "");
    setCtaVk(b.subscribeCta?.vk || ""); setCtaTelegram(b.subscribeCta?.telegram || ""); setCtaTelegraph(b.subscribeCta?.telegraph || "");
    setVkRepostUrl(b.vkRepostUrl || "");
    setLastPid(pid);
  }

  const positions = [
    { value: "top-left", label: "Верх-лево" }, { value: "top-center", label: "Верх-центр" }, { value: "top-right", label: "Верх-право" },
    { value: "center", label: "Центр" },
    { value: "bottom-left", label: "Низ-лево" }, { value: "bottom-center", label: "Низ-центр" }, { value: "bottom-right", label: "Низ-право" },
  ];

  async function handleSave() {
    const subscribeCta: Record<string, string> = {};
    if (ctaVk) subscribeCta.vk = ctaVk;
    if (ctaTelegram) subscribeCta.telegram = ctaTelegram;
    if (ctaTelegraph) subscribeCta.telegraph = ctaTelegraph;
    const brandingData = { logoDark, logoLight, titleFont, titleSize, titleColor, titleColor2, titleGradient, titleColorDark, titleColorLight, titlePosition, titleShadow, logoPosition, logoSize, linkText, linkPosition, linkColor, openaiApiKey, subscribeCta, vkRepostUrl };
    await saveSettings({ companyId, projectId, branding: brandingData });
    setSaved(true); setTimeout(() => setSaved(false), 2000); refresh();
  }

  const previewStyle: Record<string, any> = {
    position: "relative", width: "100%", maxWidth: 600, aspectRatio: "16/9",
    background: "linear-gradient(135deg, #0a0a2e 0%, #1a1a4e 50%, #0d0d3a 100%)",
    borderRadius: "0.5rem", overflow: "hidden", border: "1px solid #333",
  };

  const posToStyle = (pos: string, extra: any = {}) => {
    const base: any = { position: "absolute", ...extra };
    if (pos.includes("top")) base.top = "1rem";
    if (pos.includes("bottom")) base.bottom = "1rem";
    if (pos.includes("left")) base.left = "1rem";
    if (pos.includes("right")) base.right = "1rem";
    if (pos === "center") { base.top = "50%"; base.left = "50%"; base.transform = "translate(-50%, -50%)"; }
    if (pos.includes("center") && pos !== "center") { base.left = "50%"; base.transform = "translateX(-50%)"; }
    return base;
  };

  return (
    <div>
      <div style={s.formRow}>
      </div>

      {loading && <div style={{ color: "#666" }}>Загрузка...</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Left: Settings */}
        <div>
          <h3 style={{ ...s.h2, marginBottom: "0.75rem" }}>Логотип</h3>
          <div style={{ ...s.card, padding: "0.75rem" }}>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Тёмный фон:</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="URL логотипа (PNG/SVG)" value={logoDark} onChange={e => setLogoDark(e.target.value)} />
            </div>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Светлый фон:</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="URL логотипа для светлого фона" value={logoLight} onChange={e => setLogoLight(e.target.value)} />
            </div>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Позиция:</label>
              <select style={s.select} value={logoPosition} onChange={e => setLogoPosition(e.target.value)}>
                {positions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <label style={{ fontSize: "0.8rem", color: "#999" }}>Размер:</label>
              <input style={{ ...s.input, width: 60 }} type="number" value={logoSize} onChange={e => setLogoSize(e.target.value)} />
              <span style={{ fontSize: "0.7rem", color: "#666" }}>px</span>
            </div>
          </div>

          <h3 style={{ ...s.h2, marginBottom: "0.75rem", marginTop: "1rem" }}>Заголовок</h3>
          <div style={{ ...s.card, padding: "0.75rem" }}>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Шрифт:</label>
              <select style={{ ...s.select, flex: 1 }} value={titleFont} onChange={e => setTitleFont(e.target.value)}>
                <option value="system-ui, sans-serif">System UI</option>
                <option value="'Inter', sans-serif">Inter</option>
                <option value="'Roboto', sans-serif">Roboto</option>
                <option value="'Montserrat', sans-serif">Montserrat</option>
                <option value="'Playfair Display', serif">Playfair Display</option>
                <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
              </select>
            </div>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Размер:</label>
              <input style={{ ...s.input, width: 60 }} type="number" value={titleSize} onChange={e => setTitleSize(e.target.value)} />
              <span style={{ fontSize: "0.7rem", color: "#666" }}>px</span>
            </div>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Заливка:</label>
              <label style={{ fontSize: "0.8rem", color: "#ccc", display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
                <input type="checkbox" checked={titleGradient} onChange={e => setTitleGradient(e.target.checked)} /> Градиент
              </label>
            </div>
            {titleGradient ? (
              <div style={s.formRow}>
                <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Цвет 1→2:</label>
                <input type="color" value={titleColor} onChange={e => setTitleColor(e.target.value)} style={{ width: 32, height: 24, border: "1px solid #444", borderRadius: 4, cursor: "pointer" }} />
                <span style={{ ...s.mono, fontSize: "0.65rem" }}>{titleColor}</span>
                <span style={{ color: "#555" }}>→</span>
                <input type="color" value={titleColor2 || "#7dd3fc"} onChange={e => setTitleColor2(e.target.value)} style={{ width: 32, height: 24, border: "1px solid #444", borderRadius: 4, cursor: "pointer" }} />
                <span style={{ ...s.mono, fontSize: "0.65rem" }}>{titleColor2 || "#7dd3fc"}</span>
              </div>
            ) : (
              <div style={s.formRow}>
                <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Цвет:</label>
                <input type="color" value={titleColor} onChange={e => setTitleColor(e.target.value)} style={{ width: 32, height: 24, border: "1px solid #444", borderRadius: 4, cursor: "pointer" }} />
                <span style={{ ...s.mono, fontSize: "0.65rem" }}>{titleColor}</span>
              </div>
            )}
            <div style={{ ...s.formRow, borderTop: "1px solid #333", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
              <label style={{ fontSize: "0.75rem", color: "#888", minWidth: 100 }}>Тёмный фон:</label>
              <input type="color" value={titleColorDark} onChange={e => setTitleColorDark(e.target.value)} style={{ width: 28, height: 20, border: "1px solid #444", borderRadius: 4, cursor: "pointer" }} />
              <span style={{ ...s.mono, fontSize: "0.6rem" }}>{titleColorDark}</span>
              <label style={{ fontSize: "0.75rem", color: "#888", marginLeft: "0.75rem" }}>Светлый фон:</label>
              <input type="color" value={titleColorLight} onChange={e => setTitleColorLight(e.target.value)} style={{ width: 28, height: 20, border: "1px solid #444", borderRadius: 4, cursor: "pointer" }} />
              <span style={{ ...s.mono, fontSize: "0.6rem" }}>{titleColorLight}</span>
            </div>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Позиция:</label>
              <select style={s.select} value={titlePosition} onChange={e => setTitlePosition(e.target.value)}>
                {positions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <label style={{ fontSize: "0.8rem", color: "#999", display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
                <input type="checkbox" checked={titleShadow} onChange={e => setTitleShadow(e.target.checked)} /> Тень
              </label>
            </div>
          </div>

          <h3 style={{ ...s.h2, marginBottom: "0.75rem", marginTop: "1rem" }}>Ссылка на обложке</h3>
          <div style={{ ...s.card, padding: "0.75rem" }}>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Текст:</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="sitechist.ru | @uspeshgpt" value={linkText} onChange={e => setLinkText(e.target.value)} />
            </div>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Позиция:</label>
              <select style={s.select} value={linkPosition} onChange={e => setLinkPosition(e.target.value)}>
                {positions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <label style={{ fontSize: "0.8rem", color: "#999", marginLeft: "0.5rem" }}>Цвет:</label>
              <input type="color" value={linkColor} onChange={e => setLinkColor(e.target.value)} style={{ width: 32, height: 24, border: "1px solid #444", borderRadius: 4, cursor: "pointer" }} />
            </div>
          </div>

          <h3 style={{ ...s.h2, marginBottom: "0.75rem", marginTop: "1rem" }}>API ключ (генерация обложек)</h3>
          <div style={{ ...s.card, padding: "0.75rem" }}>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>OpenAI:</label>
              <input style={{ ...s.input, flex: 1 }} type="password" placeholder="sk-proj-..." value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)} />
            </div>
            <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "0.25rem" }}>GPT Image 1 для generate-cover. Ключ хранится в настройках проекта.</div>
          </div>

          <h3 style={{ ...s.h2, marginBottom: "0.75rem", marginTop: "1rem" }}>CTA подписки (auto-append к постам)</h3>
          <div style={{ ...s.card, padding: "0.75rem" }}>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>VK:</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="Подписывайтесь: https://vk.com/UspeshGPT" value={ctaVk} onChange={e => setCtaVk(e.target.value)} />
            </div>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Telegram:</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="Подписывайтесь: https://t.me/UspeshGPT" value={ctaTelegram} onChange={e => setCtaTelegram(e.target.value)} />
            </div>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Telegraph:</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="Читайте больше: https://telegra.ph/..." value={ctaTelegraph} onChange={e => setCtaTelegraph(e.target.value)} />
            </div>
          </div>

          <h3 style={{ ...s.h2, marginBottom: "0.75rem", marginTop: "1rem" }}>VK авто-репост</h3>
          <div style={{ ...s.card, padding: "0.75rem" }}>
            <div style={s.formRow}>
              <label style={{ fontSize: "0.8rem", color: "#999", minWidth: 100 }}>Личная стена:</label>
              <input style={{ ...s.input, flex: 1 }} placeholder="https://vk.com/uspeshnyy" value={vkRepostUrl} onChange={e => setVkRepostUrl(e.target.value)} />
            </div>
            <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "0.25rem" }}>Если заполнено — после публикации в сообщество пост автоматически репостится на личную стену.</div>
          </div>

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button style={s.btn("primary")} onClick={handleSave}>Сохранить</button>
            {saved && <span style={{ color: "#6ee7b7", fontSize: "0.85rem" }}>Сохранено</span>}
          </div>
        </div>

        {/* Right: Preview */}
        <div>
          <h3 style={{ ...s.h2, marginBottom: "0.75rem" }}>Превью обложки</h3>
          <div style={previewStyle}>
            {/* Logo */}
            {logoDark && (
              <img src={logoDark} alt="logo" style={posToStyle(logoPosition, { width: Number(logoSize), height: "auto", objectFit: "contain" })} />
            )}
            {/* Title */}
            <div style={posToStyle(titlePosition, {
              fontFamily: titleFont, fontSize: `${Math.round(Number(titleSize) * 0.4)}px`, fontWeight: 700,
              maxWidth: "70%", lineHeight: 1.2,
              textShadow: titleShadow ? "0 2px 8px rgba(0,0,0,0.8)" : "none",
              ...(titleGradient ? {
                background: `linear-gradient(135deg, ${titleColor}, ${titleColor2 || "#7dd3fc"})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              } : { color: titleColor }),
            })}>
              Пример заголовка поста
            </div>
            {/* Link */}
            {linkText && (
              <div style={posToStyle(linkPosition, { fontSize: "0.55rem", color: linkColor, opacity: 0.8 })}>
                {linkText}
              </div>
            )}
          </div>
          {/* Light bg preview */}
          <h3 style={{ ...s.h2, marginBottom: "0.5rem", marginTop: "1rem", fontSize: "0.85rem" }}>Светлый фон</h3>
          <div style={{ ...previewStyle, background: "linear-gradient(135deg, #f0f0f5 0%, #e8e8f0 50%, #f5f5fa 100%)" }}>
            {logoLight && <img src={logoLight} alt="logo" style={posToStyle(logoPosition, { width: Number(logoSize), height: "auto", objectFit: "contain" as const })} />}
            <div style={posToStyle(titlePosition, {
              fontFamily: titleFont, fontSize: `${Math.round(Number(titleSize) * 0.4)}px`, fontWeight: 700,
              color: titleColorLight, maxWidth: "70%", lineHeight: 1.2,
              textShadow: titleShadow ? "0 1px 4px rgba(255,255,255,0.5)" : "none",
            })}>
              Пример заголовка
            </div>
            {linkText && <div style={posToStyle(linkPosition, { fontSize: "0.55rem", color: "#555", opacity: 0.8 })}>{linkText}</div>}
          </div>
          <p style={{ color: "#555", fontSize: "0.7rem", marginTop: "0.5rem" }}>
            Реальная обложка генерируется через Imagen 4.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
export function SmmPage(_props: PluginPageProps) {
  const hashState = getSmmHash();
  const [tab, setTab] = useState<string>(hashState.tab);
  const [projectId, setProjectId] = useState<string>(hashState.project || PROJECTS[0].id);

  const switchTab = (t: string) => {
    setTab(t);
    if (typeof window !== "undefined") window.location.hash = `${projectId}/${t}`;
  };

  const switchProject = (pid: string) => {
    setProjectId(pid);
    if (typeof window !== "undefined") window.location.hash = `${pid}/${tab}`;
  };

  const TABS = [
    { id: "accounts", label: "Аккаунты" },
    { id: "plan", label: "Контент-план" },
    { id: "utm", label: "UTM-ссылки" },
    { id: "hashtags", label: "Хэштеги" },
    { id: "branding", label: "Брендинг" },
    { id: "settings", label: "Настройки" },
  ];

  const projectColor = (pid: string) => pid === "sitechist" ? "#3b82f6" : pid === "itc34" ? "#8b5cf6" : "#10b981";

  return (
    <div style={s.page}>
      {/* Header with project switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#e0e0e0", margin: "0 0 0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <IconSmm size={22} /> SMM
          </h1>
          <p style={{ color: "#666", fontSize: "0.8rem", margin: 0 }}>
            Управление соцсетями · Контент-план · Брендинг
          </p>
        </div>
        {/* Project pills */}
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {PROJECTS.map(p => (
            <button key={p.id} onClick={() => switchProject(p.id)} style={{
              padding: "0.35rem 0.75rem", borderRadius: "9999px", border: "2px solid",
              borderColor: projectId === p.id ? projectColor(p.id) : "#333",
              background: projectId === p.id ? projectColor(p.id) + "20" : "transparent",
              color: projectId === p.id ? "#fff" : "#888",
              fontSize: "0.8rem", fontWeight: projectId === p.id ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s",
            }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: projectColor(p.id), marginRight: "0.4rem", verticalAlign: "middle" }} />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={s.tab(tab === t.id)} onClick={() => switchTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Content — pass projectId to all tabs */}
      {tab === "accounts" && <AccountsTab projectId={projectId} />}
      {tab === "plan" && <ContentPlanTab projectId={projectId} />}
      {tab === "utm" && <UtmTab projectId={projectId} />}
      {tab === "hashtags" && <HashtagsTab projectId={projectId} />}
      {tab === "branding" && <BrandingTab projectId={projectId} />}
      {tab === "settings" && <SettingsTab key={projectId} projectId={projectId} />}
    </div>
  );
}

// ── Sidebar Link ──
export function SmmSidebarLink() {
  const { companyPrefix } = useHostContext();
  const href = companyPrefix ? `/${companyPrefix}/smm` : "/smm";
  return <a href={href} style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "0.5rem" }}>
    <IconSmm size={16} /> SMM
  </a>;
}

// ── Dashboard Widget ──
export function SmmWidget(_props: PluginWidgetProps) {
  const { companyId } = useHostContext();
  const { data } = usePluginData<{ accounts: any[] }>("smm-accounts", { companyId });
  const accounts: any[] = data?.accounts || [];
  const active = accounts.filter((a: any) => a.status === "active").length;
  const errors = accounts.filter((a: any) => a.status === "error").length;
  const unknown = accounts.filter((a: any) => !a.status || a.status === "unknown").length;

  return (
    <div style={{ padding: "1rem", fontFamily: "system-ui, sans-serif", color: "#e0e0e0" }}>
      <div style={{ fontWeight: 600, marginBottom: "0.75rem", fontSize: "0.9rem" }}>SMM: Соцсети</div>
      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#6ee7b7" }}>{active}</div>
          <div style={{ fontSize: "0.7rem", color: "#666" }}>активных</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fca5a5" }}>{errors}</div>
          <div style={{ fontSize: "0.7rem", color: "#666" }}>ошибок</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#666" }}>{unknown}</div>
          <div style={{ fontSize: "0.7rem", color: "#666" }}>не проверено</div>
        </div>
      </div>
      {accounts.length === 0 && <div style={{ color: "#555", fontSize: "0.8rem", marginTop: "0.5rem" }}>Аккаунты не добавлены</div>}
    </div>
  );
}
