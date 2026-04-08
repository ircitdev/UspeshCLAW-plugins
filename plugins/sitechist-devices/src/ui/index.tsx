import {
  usePluginData,
  usePluginAction,
  useHostContext,
  type PluginPageProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import { useState } from "react";

// ── Icon ──
const IconAccounts = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M31 4C20.523438 4 12 12.523438 12 23C12 27.972656 14.78125 31.6875 17.472656 35.28125C19.621094 38.152344 21.644531 40.886719 22 44L22 51C22 54.519531 24.613281 57.433594 28 57.921875L28 59C28 60.101563 28.898438 61 30 61L32 61C33.101563 61 34 60.101563 34 59L34 57.921875C37.386719 57.433594 40 54.519531 40 51L40 44.898438C40.015625 41.402344 42.222656 38.429688 44.5625 35.28125C47.238281 31.6875 50 27.972656 50 23C50 12.523438 41.476563 4 31 4Z M27 26C26.746 26 26.488 26.098 26.293 26.293C25.902 26.684 25.902 27.316 26.293 27.707L28.293 29.707C28.488 29.902 28.742 30 29 30C29.258 30 29.512 29.902 29.707 29.707C30.098 29.316 30.098 28.684 29.707 28.293L27.707 26.293C27.512 26.098 27.254 26 27 26ZM35 26C34.746 26 34.488 26.098 34.293 26.293L30.293 30.293C30.105 30.48 30 30.734 30 31L30 37C30 37.551 30.449 38 31 38C31.551 38 32 37.551 32 37L32 31.414L35.707 27.707C36.098 27.316 36.098 26.684 35.707 26.293C35.512 26.098 35.254 26 35 26Z"/>
  </svg>
);

// ── Styles ──
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
  hidden: { fontFamily: "monospace", fontSize: "0.8rem", letterSpacing: "0.15em" } as const,
  modal: { position: "fixed" as const, top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modalBox: { background: "#1a1a2e", border: "1px solid #444", borderRadius: "0.75rem", padding: "1.5rem", minWidth: 350, maxWidth: 500 } as const,
  agentChip: (hasAgent: boolean) => ({
    display: "inline-block", padding: "0.15rem 0.6rem", borderRadius: "0.375rem", fontSize: "0.75rem",
    cursor: "pointer", background: hasAgent ? "#1e3a5f" : "#2a2a2a", color: hasAgent ? "#93c5fd" : "#666",
    border: "1px solid " + (hasAgent ? "#3b82f6" : "#444"),
  } as const),
};

const statusColor = (st: string) =>
  st === "active" || st === "alive" ? "green" : st === "blocked" || st === "dead" || st === "error" || st === "expired" ? "red" : "yellow";

// ── Agent Selector Modal ──
function AgentModal({ agents, currentAgentId, onSelect, onClose }: {
  agents: any[]; currentAgentId: string | null; onSelect: (id: string | null) => void; onClose: () => void;
}) {
  return (
    <div style={s.modal} onClick={onClose}>
      <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ ...s.h2, marginBottom: "0.75rem" }}>Выбрать агента</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <button style={{ ...s.btn(), padding: "0.5rem", textAlign: "left" }} onClick={() => onSelect(null)}>
            — Нет агента
          </button>
          {agents.map((a: any) => (
            <button key={a.id} style={{
              ...s.btn(), padding: "0.5rem", textAlign: "left",
              background: a.id === currentAgentId ? "#2563eb33" : "transparent",
              borderColor: a.id === currentAgentId ? "#2563eb" : "#444",
            }} onClick={() => onSelect(a.id)}>
              {a.name} <span style={{ color: "#666", fontSize: "0.75rem" }}>({a.role})</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: "0.75rem", textAlign: "right" }}>
          <button style={s.btn()} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

function AgentChip({ agentId, agents, onChangeRequest }: { agentId: string | null; agents: any[]; onChangeRequest: () => void }) {
  const agent = agents.find((a: any) => a.id === agentId);
  return (
    <span style={s.agentChip(!!agent)} onClick={onChangeRequest} title="Изменить агента">
      {agent ? agent.name : "Не назначен"}
    </span>
  );
}

// ── Accounts Tab ──
function AccountsTab({ agents }: { agents: any[] }) {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ accounts: any[] }>("accounts-list", { companyId });
  const createAccount = usePluginAction("account-create");
  const deleteAccount = usePluginAction("account-delete");
  const updateAccount = usePluginAction("account-update");
  const checkAccount = usePluginAction("account-check");
  const checkAllAccounts = usePluginAction("account-check-all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", provider: "openai", agentId: "", outlookPass: "", authType: "oauth", mode: "round-robin", model: "" });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [agentModal, setAgentModal] = useState<{ id: string; field: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState<string | null>(null);

  const accounts = data?.accounts || [];

  return (
    <div>
      {agentModal && (
        <AgentModal agents={agents} currentAgentId={accounts.find((a: any) => a.id === agentModal.id)?.agentId}
          onSelect={async (agId) => { await updateAccount({ companyId, id: agentModal.id, agentId: agId }); setAgentModal(null); refresh(); }}
          onClose={() => setAgentModal(null)} />
      )}
      {msg && <div style={{ color: msg.includes("error") ? "#fca5a5" : "#6ee7b7", marginBottom: "0.5rem", fontSize: "0.85rem" }}>{msg}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={s.h2}>GPT / Claude / OpenRouter аккаунты ({accounts.length})</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button style={s.btn()} onClick={async () => {
            setChecking("all"); setMsg("");
            try { const r = await checkAllAccounts({ companyId }); setMsg(`Проверено: ${r.active} active, ${r.errors} errors`); refresh(); }
            catch (e: any) { setMsg(`error: ${e.message}`); }
            setChecking(null);
          }}>{checking === "all" ? "..." : "Проверить все"}</button>
          <button style={s.btn("primary")} onClick={() => setShowForm(!showForm)}>+ Добавить</button>
        </div>
      </div>
      {showForm && (
        <div style={s.card}>
          <div style={s.formRow}>
            <select style={s.select} value={form.provider} onChange={(e) => {
              const p = e.target.value;
              const isOAuth = p === "openai" || p === "anthropic";
              setForm({ ...form, provider: p, authType: isOAuth ? "oauth" : "api-key", mode: p === "openai" ? "round-robin" : "dedicated", model: "" });
            }}>
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
              <option value="grok">Grok (xAI)</option>
              <option value="deepseek">DeepSeek</option>
              <option value="kimi">Kimi (Moonshot)</option>
            </select>
            <select style={s.select} value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value })}>
              <option value="oauth">OAuth (логин/пароль)</option>
              <option value="api-key">API Key</option>
            </select>
            <select style={s.select} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="round-robin">Round-robin (все агенты)</option>
              <option value="dedicated">Dedicated (один агент)</option>
            </select>
          </div>
          <div style={s.formRow}>
            <input style={s.input} placeholder={form.authType === "oauth" ? "Email / Имя аккаунта" : "Email / Название"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input style={s.input} placeholder={form.authType === "oauth" ? "Пароль аккаунта" : "API Key"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {form.authType === "oauth" && (
              <input style={s.input} placeholder="Пароль почты" type="password" value={form.outlookPass} onChange={(e) => setForm({ ...form, outlookPass: e.target.value })} />
            )}
          </div>
          <div style={s.formRow}>
            <select style={s.select} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
              <option value="">Модель (авто)</option>
              {form.provider === "openai" && <><option value="gpt-4o">GPT-4o</option><option value="gpt-5.4">GPT-5.4</option><option value="o3">o3</option><option value="o4-mini">o4-mini</option><option value="gpt-image-1">GPT Image 1</option></>}
              {form.provider === "anthropic" && <><option value="claude-sonnet-4-6">Sonnet 4.6</option><option value="claude-opus-4-6">Opus 4.6</option><option value="claude-haiku-4-5">Haiku 4.5</option></>}
              {form.provider === "gemini" && <><option value="gemini-2.5-pro">Gemini 2.5 Pro</option><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="imagen-4.0-ultra-generate-001">Imagen 4.0 Ultra</option><option value="imagen-4.0-generate-001">Imagen 4.0</option><option value="imagen-4.0-fast-generate-001">Imagen 4.0 Fast</option><option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image</option><option value="gemini-3-pro-image-preview">Gemini 3 Pro Image</option></>}
              {form.provider === "grok" && <><option value="grok-4.2">Grok 4.2</option><option value="grok-3">Grok 3</option><option value="grok-3-mini">Grok 3 Mini</option></>}
              {form.provider === "deepseek" && <><option value="deepseek-r1">DeepSeek R1</option><option value="deepseek-v3">DeepSeek V3</option></>}
              {form.provider === "kimi" && <><option value="moonshot-v1-128k">Moonshot 128K</option></>}
              {form.provider === "openrouter" && <><option value="auto">Auto</option></>}
            </select>
            <button style={s.btn("primary")} onClick={async () => {
              await createAccount({ companyId, ...form });
              setForm({ email: "", password: "", provider: "openai", agentId: "", outlookPass: "", authType: "oauth", mode: "round-robin", model: "" });
              setShowForm(false); refresh();
            }}>Сохранить</button>
          </div>
          {form.authType === "oauth" && form.provider === "openai" && (
            <div style={{ fontSize: "0.75rem", color: "#888" }}>OAuth — после сохранения перейдите в Сессии и нажмите Re-auth</div>
          )}
        </div>
      )}
      {loading ? <div>Загрузка...</div> : (
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>Email / Имя</th><th style={s.th}>Пароль / API Key</th>
            <th style={s.th}>Провайдер</th><th style={s.th}>Модель</th><th style={s.th}>Статус</th>
            <th style={s.th}>Режим / Агент</th><th style={s.th}>Действия</th>
          </tr></thead>
          <tbody>
            {accounts.map((a: any) => (
              <tr key={a.id}>
                <td style={{ ...s.td, ...s.mono }}>{a.email}</td>
                <td style={{ ...s.td, ...s.hidden }}>
                  {showPasswords[a.id] ? a.password : "••••••"}
                  <button style={{ ...s.btn("small"), marginLeft: 4 }} onClick={() => setShowPasswords((p) => ({ ...p, [a.id]: !p[a.id] }))}>
                    {showPasswords[a.id] ? "🙈" : "👁"}
                  </button>
                </td>
                <td style={s.td}>
                  <span style={s.badge("blue")}>{a.provider}</span>
                  {a.authType && <div style={{ fontSize: "0.65rem", color: "#666", marginTop: "0.15rem" }}>{a.authType}</div>}
                </td>
                <td style={{ ...s.td, ...s.mono, fontSize: "0.75rem" }}>{a.model || "—"}</td>
                <td style={s.td}>
                  <span style={s.badge(statusColor(a.status))}>{a.status}</span>
                  {a.lastCheckDetail && <div style={{ fontSize: "0.65rem", color: a.status === "active" ? "#6ee7b7" : "#fca5a5", marginTop: "0.15rem" }}>{a.lastCheckDetail}</div>}
                </td>
                <td style={s.td}>
                  {a.mode === "round-robin" ? (
                    <div>
                      <span style={{ ...s.badge("green"), cursor: "pointer" }} onClick={async () => {
                        await updateAccount({ companyId, id: a.id, mode: "dedicated", agentId: null });
                        refresh();
                      }}>round-robin</span>
                      <div style={{ fontSize: "0.7rem", color: "#888", marginTop: "0.2rem" }}>{a.pool || "shared"}</div>
                    </div>
                  ) : (
                    <div>
                      <AgentChip agentId={a.agentId} agents={agents} onChangeRequest={() => setAgentModal({ id: a.id, field: "agentId" })} />
                      <div style={{ marginTop: "0.2rem" }}>
                        <span style={{ fontSize: "0.65rem", color: "#666", cursor: "pointer", textDecoration: "underline" }} onClick={async () => {
                          await updateAccount({ companyId, id: a.id, mode: "round-robin", agentId: null, pool: a.provider === "anthropic" ? "claude-vpn" : "gpt-shared" });
                          refresh();
                        }}>round-robin</span>
                      </div>
                    </div>
                  )}
                </td>
                <td style={s.td}>
                  <button style={s.btn("small")} onClick={async () => {
                    setChecking(a.id);
                    try { const r = await checkAccount({ companyId, id: a.id }); setMsg(`${a.email}: ${r.status} — ${r.detail}`); refresh(); }
                    catch (e: any) { setMsg(`error: ${e.message}`); }
                    setChecking(null);
                  }}>{checking === a.id ? "..." : "Проверить"}</button>
                  <button style={{ ...s.btn(), marginLeft: 4 }} onClick={async () => {
                    await updateAccount({ companyId, id: a.id, status: a.status === "active" ? "cooldown" : "active" }); refresh();
                  }}>{a.status === "active" ? "⏸" : "▶"}</button>
                  <button style={{ ...s.btn("danger"), marginLeft: 4 }} onClick={async () => { await deleteAccount({ companyId, id: a.id }); refresh(); }}>✕</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={8} style={{ ...s.td, textAlign: "center", color: "#666" }}>Нет аккаунтов</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Proxies Tab ──
function ProxiesTab({ agents }: { agents: any[] }) {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ proxies: any[] }>("proxies-list", { companyId });
  const { data: wsConfig } = usePluginData<{ apiKey: string }>("webshare-config", { companyId });
  const createProxy = usePluginAction("proxy-create");
  const deleteProxy = usePluginAction("proxy-delete");
  const updateProxy = usePluginAction("proxy-update");
  const importBulk = usePluginAction("proxy-import-bulk");
  const importUrl = usePluginAction("proxy-import-url");
  const webshareSync = usePluginAction("proxy-webshare-sync");
  const checkOne = usePluginAction("proxy-check");
  const checkAll = usePluginAction("proxy-check-all");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ host: "", port: "", username: "", password: "", country: "US", protocol: "socks5" });
  const [agentModal, setAgentModal] = useState<{ id: string } | null>(null);
  const [importMode, setImportMode] = useState<"bulk" | "url" | "api">("bulk");
  const [bulkText, setBulkText] = useState("");
  const [importUrl2, setImportUrl2] = useState("");
  const [wsApiKey, setWsApiKey] = useState(wsConfig?.apiKey || "");
  const [importProtocol, setImportProtocol] = useState("socks5");
  const [importReplace, setImportReplace] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");

  const proxies = data?.proxies || [];

  const handleImport = async () => {
    setImportMsg(""); setImportErr("");
    try {
      let result: any;
      if (importMode === "bulk") {
        result = await importBulk({ companyId, text: bulkText, protocol: importProtocol, replace: importReplace });
      } else if (importMode === "url") {
        result = await importUrl({ companyId, url: importUrl2, protocol: importProtocol, replace: importReplace });
      } else {
        result = await webshareSync({ companyId, apiKey: wsApiKey || wsConfig?.apiKey, protocol: importProtocol, replace: importReplace });
      }
      setImportMsg(`Импортировано: ${result.imported}, всего: ${result.total}`);
      setBulkText(""); setImportUrl2("");
      refresh();
    } catch (e: any) { setImportErr(e.message || "Ошибка импорта"); }
  };

  return (
    <div>
      {agentModal && (
        <AgentModal agents={agents} currentAgentId={proxies.find((p: any) => p.id === agentModal.id)?.agentId}
          onSelect={async (agId) => { await updateProxy({ companyId, id: agentModal.id, agentId: agId }); setAgentModal(null); refresh(); }}
          onClose={() => setAgentModal(null)} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={s.h2}>Прокси ({proxies.length})</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button style={s.btn()} onClick={() => { setShowImport(!showImport); setShowForm(false); }}>Импорт</button>
          <button style={s.btn("primary")} onClick={() => { setShowForm(!showForm); setShowImport(false); }}>+ Добавить</button>
        </div>
      </div>

      {/* Import Panel */}
      {showImport && (
        <div style={s.card}>
          <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem", borderBottom: "1px solid #333" }}>
            <button style={s.tab(importMode === "bulk")} onClick={() => setImportMode("bulk")}>Списком</button>
            <button style={s.tab(importMode === "url")} onClick={() => setImportMode("url")}>По ссылке</button>
            <button style={s.tab(importMode === "api")} onClick={() => setImportMode("api")}>Webshare API</button>
          </div>

          {importMode === "bulk" && (
            <div>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>Формат: host:port:username:password (по одному на строку)</div>
              <textarea style={{ padding: "0.5rem", background: "#111", border: "1px solid #444", borderRadius: "0.375rem", color: "#e0e0e0", fontSize: "0.8rem", width: "100%", minHeight: 120, fontFamily: "monospace", resize: "vertical" as const, boxSizing: "border-box" as const, marginBottom: "0.5rem" }}
                placeholder={"62.164.246.107:7832:anvlptxu:lpjjjtvd0pqi\n62.164.246.170:7895:anvlptxu:lpjjjtvd0pqi"}
                value={bulkText} onChange={e => setBulkText(e.target.value)} />
            </div>
          )}

          {importMode === "url" && (
            <div>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>Ссылка на файл со списком прокси (host:port:user:pass)</div>
              <input style={{ ...s.input, marginBottom: "0.5rem" }} placeholder="https://proxy.webshare.io/api/v2/proxy/list/download/..." value={importUrl2} onChange={e => setImportUrl2(e.target.value)} />
            </div>
          )}

          {importMode === "api" && (
            <div>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>
                Webshare.io API — автоматическая синхронизация прокси.
                <a href="https://apidocs.webshare.io" target="_blank" rel="noopener" style={{ color: "#7dd3fc", marginLeft: "0.5rem" }}>Документация</a>
              </div>
              <input style={{ ...s.input, marginBottom: "0.5rem" }} placeholder="API Key: q5qklufeb73q0czy5eel5srcmqoda2p5qxy90prk"
                value={wsApiKey || wsConfig?.apiKey || ""} onChange={e => setWsApiKey(e.target.value)} />
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <select style={s.select} value={importProtocol} onChange={e => setImportProtocol(e.target.value)}>
              <option value="socks5">SOCKS5</option><option value="http">HTTP</option><option value="https">HTTPS</option>
            </select>
            <label style={{ fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <input type="checkbox" checked={importReplace} onChange={e => setImportReplace(e.target.checked)} />
              Заменить все (кроме VPN)
            </label>
            <button style={s.btn("primary")} onClick={handleImport}>
              {importMode === "api" ? "Синхронизировать" : "Импортировать"}
            </button>
          </div>

          {importMsg && <div style={{ color: "#6ee7b7", marginTop: "0.5rem", fontSize: "0.85rem" }}>{importMsg}</div>}
          {importErr && <div style={{ color: "#fca5a5", marginTop: "0.5rem", fontSize: "0.85rem" }}>{importErr}</div>}
        </div>
      )}

      {/* Single Add Form */}
      {showForm && (
        <div style={s.card}>
          <div style={s.formRow}>
            <input style={s.input} placeholder="Host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
            <input style={{ ...s.input, width: 80 }} placeholder="Port" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
            <input style={s.input} placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input style={s.input} placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select style={s.select} value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
              <option value="socks5">SOCKS5</option><option value="http">HTTP</option><option value="https">HTTPS</option>
            </select>
            <input style={{ ...s.input, width: 60 }} placeholder="US" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <button style={s.btn("primary")} onClick={async () => {
              await createProxy({ companyId, ...form, port: parseInt(form.port) || 0 });
              setForm({ host: "", port: "", username: "", password: "", country: "US", protocol: "socks5" });
              setShowForm(false); refresh();
            }}>Сохранить</button>
          </div>
        </div>
      )}

      {loading ? <div>Загрузка...</div> : (
        <div>
          <div style={{ marginBottom: "0.5rem", textAlign: "right" }}>
            <button style={s.btn()} onClick={async () => {
              try { const r = await checkAll({ companyId }); setImportMsg(`Проверено: ${r.alive} alive, ${r.dead} dead`); refresh(); }
              catch (e: any) { setImportErr(e.message); }
            }}>Проверить все</button>
          </div>
          <table style={s.table}>
            <thead><tr>
              <th style={s.th}>Протокол</th><th style={s.th}>Хост</th><th style={s.th}>Логин</th>
              <th style={s.th}>Страна</th><th style={s.th}>Статус</th><th style={s.th}>Пинг</th>
              <th style={s.th}>Добавлен</th><th style={s.th}>Истекает</th>
              <th style={s.th}>Агент</th><th style={s.th}>Действия</th>
            </tr></thead>
            <tbody>
              {proxies.map((p: any) => {
                const expired = p.expiresAt && new Date(p.expiresAt) < new Date();
                const expSoon = p.expiresAt && !expired && new Date(p.expiresAt) < new Date(Date.now() + 7*24*60*60*1000);
                return (
                  <tr key={p.id} style={expired ? { opacity: 0.5 } : undefined}>
                    <td style={s.td}><span style={s.badge("blue")}>{p.protocol || "socks5"}</span></td>
                    <td style={{ ...s.td, ...s.mono }}>{p.host}:{p.port}</td>
                    <td style={{ ...s.td, ...s.mono }}>{p.username}</td>
                    <td style={s.td}>{p.country}</td>
                    <td style={s.td}><span style={s.badge(statusColor(p.status))}>{p.status}</span></td>
                    <td style={{ ...s.td, ...s.mono }}>{p.pingMs != null ? `${p.pingMs}ms` : "—"}</td>
                    <td style={{ ...s.td, fontSize: "0.75rem" }}>{p.addedAt ? new Date(p.addedAt).toLocaleDateString("ru") : "—"}</td>
                    <td style={{ ...s.td, fontSize: "0.75rem", color: expired ? "#fca5a5" : expSoon ? "#fde047" : "#888" }}>
                      {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString("ru") : "—"}
                      {expired && " ⚠️"}
                    </td>
                    <td style={s.td}><AgentChip agentId={p.agentId} agents={agents} onChangeRequest={() => setAgentModal({ id: p.id })} /></td>
                    <td style={s.td}>
                      <button style={s.btn("small")} onClick={async () => {
                        try { const r = await checkOne({ companyId, id: p.id }); setImportMsg(`${p.host}: ${r.status} (${r.pingMs}ms)`); refresh(); }
                        catch (e: any) { setImportErr(e.message); }
                      }}>Проверить</button>
                      <button style={{ ...s.btn("danger"), marginLeft: 4 }} onClick={async () => { await deleteProxy({ companyId, id: p.id }); refresh(); }}>✕</button>
                    </td>
                  </tr>
                );
              })}
              {proxies.length === 0 && <tr><td colSpan={10} style={{ ...s.td, textAlign: "center", color: "#666" }}>Нет прокси</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sessions Tab ──
function SessionsTab({ agents }: { agents: any[] }) {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ sessions: any[] }>("sessions-list", { companyId });
  const { data: accountsData } = usePluginData<{ accounts: any[] }>("accounts-list", { companyId });
  const { data: proxiesData } = usePluginData<{ proxies: any[] }>("proxies-list", { companyId });
  const deleteSession = usePluginAction("session-delete");
  const updateSession = usePluginAction("session-update");
  const checkAll = usePluginAction("session-check-all");
  const reauthStart = usePluginAction("session-reauth-start");
  const reauthComplete = usePluginAction("session-reauth-complete");
  const oauthStart = usePluginAction("session-oauth-start");
  const [agentModal, setAgentModal] = useState<{ id: string } | null>(null);
  const [reauthModal, setReauthModal] = useState<any>(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [oauthUrl, setOauthUrl] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ provider: "anthropic", accountId: "", apiKey: "", agentId: "", mode: "dedicated", note: "" });
  const createSession = usePluginAction("session-create");
  const [checking, setChecking] = useState(false);

  const sessions = data?.sessions || [];
  const accounts = accountsData?.accounts || [];
  const proxies = proxiesData?.proxies || [];
  const accountMap = Object.fromEntries(accounts.map((a: any) => [a.id, a]));
  const proxyByAgent = Object.fromEntries(proxies.map((p: any) => [p.agentId, p]));

  const isExpired = (exp: string | null) => exp ? new Date(exp) < new Date() : false;
  const isExpiring = (exp: string | null) => {
    if (!exp) return false;
    const d = new Date(exp).getTime() - Date.now();
    return d > 0 && d < 48 * 60 * 60 * 1000;
  };

  const openReauth = async (sesId: string) => {
    setMsg("");
    try {
      const r = await reauthStart({ companyId, id: sesId });
      setReauthModal(r);
      setCallbackUrl("");
      setShowPass(false);
      setOauthUrl("");
      setOauthLoading(false);
    } catch (e: any) { setMsg(`error: ${e.message}`); }
  };

  const completeReauth = async () => {
    if (!reauthModal?.session?.id) return;
    try {
      await reauthComplete({ companyId, id: reauthModal.session.id, callbackUrl });
      setReauthModal(null);
      setCallbackUrl("");
      setMsg("Re-auth OK!");
      refresh();
    } catch (e: any) { setMsg(`error: ${e.message}`); }
  };

  return (
    <div>
      {/* Re-auth Modal */}
      {reauthModal && (
        <div style={s.modal} onClick={() => setReauthModal(null)}>
          <div style={{ ...s.modalBox, minWidth: 500, maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ ...s.h2, marginBottom: "1rem" }}>Re-auth сессии</h3>

            <div style={{ ...s.card, padding: "0.75rem" }}>
              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.25rem" }}>Profile Key</div>
                  <div style={{ ...s.mono, marginBottom: "0.5rem" }}>{reauthModal.profileKey}</div>
                </div>
                {(() => {
                  const sesProxy = proxyByAgent[reauthModal.session?.agentId];
                  if (!sesProxy) return null;
                  return (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.25rem" }}>Прокси</div>
                      <div style={{ ...s.mono, marginBottom: "0.25rem" }}>
                        <span style={s.badge(sesProxy.status === "alive" ? "green" : "red")}>{sesProxy.protocol}</span>
                        {" "}{sesProxy.host}:{sesProxy.port}
                      </div>
                      <div style={{ ...s.mono, fontSize: "0.7rem", color: "#ccc", marginBottom: "0.25rem" }}>
                        {sesProxy.username}:{sesProxy.password}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.7rem", color: "#888" }}>{sesProxy.country} {sesProxy.note ? `(${sesProxy.note})` : ""}</span>
                        <button style={{ ...s.btn("small"), fontSize: "0.65rem" }} onClick={() => {
                          const proxyStr = `${sesProxy.username}:${sesProxy.password}@${sesProxy.host}:${sesProxy.port}`;
                          navigator.clipboard.writeText(proxyStr);
                          setMsg("Скопировано: " + proxyStr);
                        }}>Скопировать прокси</button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {reauthModal.account && (
                <>
                  <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.25rem" }}>Email</div>
                  <div style={{ ...s.mono, marginBottom: "0.5rem", userSelect: "all" as const }}>{reauthModal.account.email}</div>

                  <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.25rem" }}>
                    {(reauthModal.account?.authType === "oauth" || reauthModal.account?.provider === "openai" || reauthModal.account?.provider === "grok") ? "Пароль аккаунта" : "API Key"}
                  </div>
                  <div style={{ ...s.mono, marginBottom: "0.5rem" }}>
                    {showPass ? <span style={{ userSelect: "all" as const }}>{reauthModal.account.password}</span> : "••••••"}
                    <button style={{ ...s.btn("small"), marginLeft: 8 }} onClick={() => setShowPass(!showPass)}>{showPass ? "🙈" : "👁"}</button>
                  </div>

                  {reauthModal.account.outlookPass && (
                    <>
                      <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.25rem" }}>Пароль почты</div>
                      <div style={{ ...s.mono, marginBottom: "0.5rem" }}>
                        {showPass ? <span style={{ userSelect: "all" as const }}>{reauthModal.account.outlookPass}</span> : "••••••"}
                        <button style={{ ...s.btn("small"), marginLeft: 8 }} onClick={() => setShowPass(!showPass)}>{showPass ? "🙈" : "👁"}</button>
                      </div>
                    </>
                  )}
                </>
              )}

            </div>

            <div style={{ marginTop: "1rem" }}>
              {(() => {
                const pk = reauthModal.profileKey || reauthModal.session?.provider || "";
                const isApiKeyOnly = pk.includes("gemini") || pk.includes("openrouter") || pk.includes("deepseek") || pk.includes("kimi") || pk.includes("anthropic");
                if (isApiKeyOnly) return (
                  <div>
                    {pk.includes("anthropic") && (
                      <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: "0.375rem", padding: "0.5rem", marginBottom: "0.5rem", fontSize: "0.75rem", color: "#9ca3af" }}>
                        <div style={{ color: "#6ee7b7", marginBottom: "0.25rem" }}>Как получить token:</div>
                        <div>1. На локальном ПК: <code style={{ background: "#111", padding: "0 4px", borderRadius: 3 }}>claude setup-token</code></div>
                        <div>2. Скопируйте полученный token</div>
                        <div>3. Вставьте в поле ниже</div>
                      </div>
                    )}
                    <div style={{ fontSize: "0.8rem", color: "#ccc", marginBottom: "0.3rem" }}>
                      {pk.includes("anthropic") ? "Вставьте token (claude setup-token):" : "Обновить API Key:"}
                    </div>
                    <input style={{ ...s.input, width: "100%", marginBottom: "0.5rem" }}
                      placeholder={pk.includes("anthropic") ? "sk-ant-oat-..." : "Новый API key"}
                      value={callbackUrl} onChange={e => setCallbackUrl(e.target.value)} />
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      <button style={s.btn()} onClick={() => setReauthModal(null)}>Отмена</button>
                      <button style={s.btn("primary")} onClick={async () => {
                        if (!callbackUrl.trim()) { setMsg("error: введите ключ"); return; }
                        try {
                          await updateSession({ companyId, id: reauthModal.session?.id, apiKey: callbackUrl.trim(), status: "active" });
                          setMsg("Ключ обновлён");
                          setReauthModal(null); setCallbackUrl(""); refresh();
                        } catch (e: any) { setMsg("error: " + e.message); }
                      }}>{pk.includes("anthropic") ? "Сохранить Token" : "Сохранить API Key"}</button>
                    </div>
                  </div>
                );
                return null;
              })()}
              {!oauthUrl ? (
                <div>
                  {(() => {
                    const pk = reauthModal.profileKey || reauthModal.session?.provider || "";
                    const isApiKeyOnly = pk.includes("gemini") || pk.includes("openrouter") || pk.includes("deepseek") || pk.includes("kimi") || pk.includes("anthropic");
                    if (isApiKeyOnly) return null;
                    return (
                      <>
                        <button style={{ ...s.btn("primary"), width: "100%", padding: "0.6rem", fontSize: "0.9rem" }} onClick={async () => {
                          setOauthLoading(true); setMsg("");
                          try {
                            const pk2 = reauthModal.profileKey || reauthModal.session?.provider || "";
                            const provider = pk2.includes("anthropic") ? "anthropic" : pk2.includes("grok") ? "grok" : "openai-codex";
                            const r = await oauthStart({ provider });
                            if (r.urls && r.urls.length > 0) { setOauthUrl(r.urls[0]); }
                            else if (r.allUrls && r.allUrls.length > 0) { setOauthUrl(r.allUrls[0]); }
                            else { setMsg("error: URL not found in output"); }
                          } catch (e: any) { setMsg("error: " + e.message); }
                          setOauthLoading(false);
                        }}>{oauthLoading ? "Запуск OAuth..." : "1. Запустить OAuth"}</button>
                        <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.3rem", textAlign: "center" }}>
                          Запустит авторизацию на сервере и покажет ссылку
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "0.8rem", color: "#6ee7b7", marginBottom: "0.3rem" }}>OAuth URL получен:</div>
                  <div style={{ background: "#111", padding: "0.5rem", borderRadius: "0.375rem", ...s.mono, fontSize: "0.65rem", wordBreak: "break-all" as const, marginBottom: "0.5rem", maxHeight: 60, overflow: "auto" }}>
                    {oauthUrl}
                  </div>
                  <a href={oauthUrl} target="_blank" rel="noopener" style={{ ...s.btn("primary"), display: "inline-block", textDecoration: "none", textAlign: "center", width: "100%", padding: "0.5rem", marginBottom: "0.75rem" }}>
                    2. Открыть и авторизоваться
                  </a>
                  <div style={{ fontSize: "0.8rem", color: "#ccc", marginBottom: "0.3rem" }}>
                    3. После авторизации скопируйте URL из адресной строки и вставьте:
                  </div>
                </div>
              )}

              {(() => {
                const pk = reauthModal.profileKey || reauthModal.session?.provider || "";
                const isApiKeyOnly = pk.includes("gemini") || pk.includes("openrouter") || pk.includes("deepseek") || pk.includes("kimi") || pk.includes("anthropic");
                if (isApiKeyOnly) return null;
                return (
                  <>
                    <input style={{ ...s.input, width: "100%", marginBottom: "0.5rem" }}
                      placeholder={(() => {
                        const pk2 = reauthModal?.session?.provider || reauthModal?.profileKey || "";
                        if (pk2.includes("anthropic")) return "sk-ant-oat-... (long-life token)";
                        if (pk2.includes("grok")) return "URL из адресной строки после входа в xAI...";
                        return "http://localhost:XXXXX/callback?code=...";
                      })()}
                      value={callbackUrl} onChange={e => setCallbackUrl(e.target.value)} />
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      <button style={s.btn()} onClick={() => setReauthModal(null)}>Отмена</button>
                      <button style={s.btn("primary")} onClick={completeReauth}>Обновить сессию</button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {agentModal && (
        <AgentModal agents={agents} currentAgentId={sessions.find((ses: any) => ses.id === agentModal.id)?.agentId}
          onSelect={async (agId) => { await updateSession({ companyId, id: agentModal.id, agentId: agId }); setAgentModal(null); refresh(); }}
          onClose={() => setAgentModal(null)} />
      )}
      {msg && <div style={{ color: msg.includes("error") ? "#fca5a5" : "#6ee7b7", marginBottom: "0.5rem", fontSize: "0.85rem" }}>{msg}</div>}
      {/* Add Session Form */}
      {showAddForm && (
        <div style={s.card}>
          <h3 style={{ ...s.h2, fontSize: "0.95rem" }}>Добавить сессию</h3>
          <div style={s.formRow}>
            <select style={s.select} value={addForm.provider} onChange={e => setAddForm({ ...addForm, provider: e.target.value })}>
              <optgroup label="OAuth (логин/пароль)">
                <option value="openai-codex">ChatGPT (OpenAI)</option>
              </optgroup>
              <optgroup label="API Key">
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="gemini">Gemini (Google)</option>
                <option value="grok">Grok (xAI)</option>
                <option value="deepseek">DeepSeek</option>
                <option value="kimi">Kimi (Moonshot)</option>
                <option value="openrouter">OpenRouter</option>
              </optgroup>
            </select>
            <input style={s.input} placeholder="Email / Имя аккаунта" value={addForm.accountId} onChange={e => setAddForm({ ...addForm, accountId: e.target.value })} />
          </div>
          {addForm.provider !== "openai-codex" && (
            <div style={s.formRow}>
              <input style={s.input} placeholder="API Key" type="password" value={addForm.apiKey} onChange={e => setAddForm({ ...addForm, apiKey: e.target.value })} />
            </div>
          )}
          <div style={s.formRow}>
            <select style={s.select} value={addForm.mode} onChange={e => setAddForm({ ...addForm, mode: e.target.value })}>
              <option value="dedicated">Dedicated (один агент)</option>
              <option value="round-robin">Round-robin (все агенты)</option>
            </select>
            <input style={s.input} placeholder="Заметка" value={addForm.note} onChange={e => setAddForm({ ...addForm, note: e.target.value })} />
            <button style={s.btn("primary")} onClick={async () => {
              try {
                await createSession({ companyId, ...addForm, profileKey: `${addForm.provider}:${addForm.accountId || "default"}` });
                setAddForm({ provider: "anthropic", accountId: "", apiKey: "", agentId: "", mode: "dedicated", note: "" });
                setShowAddForm(false); setMsg("Сессия добавлена"); refresh();
              } catch (e: any) { setMsg("error: " + e.message); }
            }}>Добавить</button>
          </div>
          {addForm.provider === "openai-codex" && (
            <div style={{ fontSize: "0.75rem", color: "#888" }}>
              ChatGPT требует OAuth — после добавления нажмите Re-auth для авторизации
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={s.h2}>Сессии ({sessions.length})</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
        <button style={s.btn()} disabled={checking} onClick={async () => {
          setChecking(true); setMsg("");
          try { const r = await checkAll({ companyId }); setMsg(`Проверено: ${r.active} active, ${r.expiring} expiring, ${r.expired} expired, ${r.errors} errors`); refresh(); }
          catch (e: any) { setMsg(`error: ${e.message}`); }
          finally { setChecking(false); }
        }}>{checking ? "Проверяю..." : "Проверить все"}</button>
        <button style={s.btn("primary")} onClick={() => setShowAddForm(!showAddForm)}>+ Добавить</button>
        </div>
      </div>
      {loading ? <div>Загрузка...</div> : (
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>Провайдер</th><th style={s.th}>Аккаунт</th><th style={s.th}>Profile Key</th>
            <th style={s.th}>Статус</th><th style={s.th}>Создана</th><th style={s.th}>Истекает</th>
            <th style={s.th}>Режим / Агент</th><th style={s.th}>Действия</th>
          </tr></thead>
          <tbody>
            {sessions.map((ses: any) => {
              const expired = isExpired(ses.expiresAt);
              const expiring = isExpiring(ses.expiresAt);
              const acc = accountMap[ses.accountId] || accounts.find((a: any) => a.email === ses.accountId);
              return (
                <tr key={ses.id} style={expired ? { opacity: 0.5 } : {}}>
                  <td style={s.td}><span style={s.badge("blue")}>{ses.provider || ses.profileKey?.split(":")[0] || "?"}</span></td>
                  <td style={{ ...s.td, ...s.mono, fontSize: "0.8rem" }}>{acc?.email || ses.accountId || "—"}</td>
                  <td style={{ ...s.td, ...s.mono, fontSize: "0.7rem" }}>{ses.profileKey || "—"}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge(expired ? "red" : expiring ? "yellow" : "green"), cursor: (expired || expiring) ? "pointer" : "default" }}
                      onClick={() => (expired || expiring) && openReauth(ses.id)}>
                      {expired ? "expired" : expiring ? "expiring" : ses.status}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontSize: "0.8rem" }}>{ses.createdAt ? new Date(ses.createdAt).toLocaleDateString("ru") : "—"}</td>
                  <td style={{ ...s.td, fontSize: "0.8rem", color: expired ? "#fca5a5" : expiring ? "#fde047" : "#e0e0e0" }}>
                    {ses.expiresAt ? new Date(ses.expiresAt).toLocaleDateString("ru") : "—"}
                  </td>
                  <td style={s.td}>
                    {ses.mode === "round-robin" ? (
                      <span style={s.badge("green")}>round-robin</span>
                    ) : (
                      <AgentChip agentId={ses.agentId} agents={agents} onChangeRequest={() => setAgentModal({ id: ses.id })} />
                    )}
                  </td>
                  <td style={s.td}>
                    <button style={s.btn("small")} onClick={() => openReauth(ses.id)}>Re-auth</button>
                    <button style={{ ...s.btn("danger"), marginLeft: 4 }} onClick={async () => { await deleteSession({ companyId, id: ses.id }); refresh(); }}>✕</button>
                  </td>
                </tr>
              );
            })}
            {sessions.length === 0 && <tr><td colSpan={8} style={{ ...s.td, textAlign: "center", color: "#666" }}>Нет сессий</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Telegram Bots Tab ──
function BotsTab({ agents }: { agents: any[] }) {
  const { companyId } = useHostContext();
  const { data, loading, refresh } = usePluginData<{ bots: any[] }>("bots-list", { companyId });
  const createBot = usePluginAction("bot-create");
  const deleteBot = usePluginAction("bot-delete");
  const updateBot = usePluginAction("bot-update");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", token: "", agentId: "", agentName: "" });
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [agentModal, setAgentModal] = useState<{ id: string } | null>(null);

  const bots = data?.bots || [];

  return (
    <div>
      {agentModal && (
        <AgentModal agents={agents} currentAgentId={bots.find((b: any) => b.id === agentModal.id)?.agentId}
          onSelect={async (agId) => {
            const ag = agents.find((a: any) => a.id === agId);
            await updateBot({ companyId, id: agentModal.id, agentId: agId, agentName: ag?.name || "" });
            setAgentModal(null); refresh();
          }}
          onClose={() => setAgentModal(null)} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={s.h2}>Telegram-боты ({bots.length})</h2>
        <button style={s.btn("primary")} onClick={() => setShowForm(!showForm)}>+ Добавить</button>
      </div>
      {showForm && (
        <div style={s.card}>
          <div style={s.formRow}>
            <input style={s.input} placeholder="@username (без @)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input style={{ ...s.input, minWidth: 300 }} placeholder="Bot Token" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />
            <button style={s.btn("primary")} onClick={async () => {
              await createBot({ companyId, ...form });
              setForm({ username: "", token: "", agentId: "", agentName: "" });
              setShowForm(false); refresh();
            }}>Сохранить</button>
          </div>
        </div>
      )}
      {loading ? <div>Загрузка...</div> : (
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>Бот</th><th style={s.th}>Username</th><th style={s.th}>Token</th>
            <th style={s.th}>Агент</th><th style={s.th}>Статус</th><th style={s.th}>Действия</th>
          </tr></thead>
          <tbody>
            {bots.map((b: any) => (
              <tr key={b.id}>
                <td style={s.td}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {b.photoUrl ? (
                      <img src={b.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2a2a3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "#666" }}>🤖</div>
                    )}
                    <span style={{ fontWeight: 500 }}>{b.displayName || b.username}</span>
                  </div>
                </td>
                <td style={{ ...s.td, ...s.mono, fontSize: "0.8rem" }}>@{b.username}</td>
                <td style={{ ...s.td, ...s.hidden }}>
                  {showTokens[b.id] ? b.token : "••••••••:•••••••••••"}
                  <button style={{ ...s.btn("small"), marginLeft: 4 }} onClick={() => setShowTokens((t) => ({ ...t, [b.id]: !t[b.id] }))}>
                    {showTokens[b.id] ? "🙈" : "👁"}
                  </button>
                </td>
                <td style={s.td}><AgentChip agentId={b.agentId} agents={agents} onChangeRequest={() => setAgentModal({ id: b.id })} /></td>
                <td style={s.td}><span style={s.badge(statusColor(b.status))}>{b.status}</span></td>
                <td style={s.td}>
                  <button style={s.btn("danger")} onClick={async () => { await deleteBot({ companyId, id: b.id }); refresh(); }}>✕</button>
                </td>
              </tr>
            ))}
            {bots.length === 0 && <tr><td colSpan={6} style={{ ...s.td, textAlign: "center", color: "#666" }}>Нет ботов</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main Page ──
// ── Agents Tab (OpenClaw) ──
function AgentsTab({ sessions }: { sessions: any[] }) {
  const { companyId } = useHostContext();
  const { data: ocData, loading, refetch } = usePluginData<{ agents: any[]; defaults: any; error?: string }>("openclaw-agents", { companyId });
  const assignSession = usePluginAction("openclaw-agent-assign-session");
  const unassignSession = usePluginAction("openclaw-agent-unassign-session");
  const updateModel = usePluginAction("openclaw-agent-update-model");

  const [assignModal, setAssignModal] = useState<{ agentId: string; agentName: string } | null>(null);
  const [modelModal, setModelModal] = useState<{ agentId: string; agentName: string; currentModel: any } | null>(null);
  const [modelInput, setModelInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const ocAgents = ocData?.agents || [];
  const defaults = ocData?.defaults || {};

  const MODEL_OPTIONS = [
    { value: "", label: "↳ Дефолт (как у всех)" },
    { value: "openai-codex/gpt-5.4", label: "GPT 5.4" },
    { value: "openai-codex/gpt-4.1", label: "GPT 4.1" },
    { value: "openai-codex/o4-mini", label: "o4-mini" },
    { value: "openai-codex/o3", label: "o3" },
    { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { value: "openrouter/anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5 (OR)" },
    { value: "openrouter/google/gemini-2.5-pro", label: "Gemini 2.5 Pro (OR)" },
    { value: "openrouter/google/gemini-3-pro", label: "Gemini 3 Pro Image (OR)" },
    { value: "openrouter/google/imagen-4", label: "Imagen 4 (OR)" },
    { value: "openrouter/deepseek/deepseek-r1", label: "DeepSeek R1 (OR)" },
    { value: "grok/grok-3", label: "Grok 3" },
  ];

  async function handleAssignSession(sessionId: string) {
    if (!assignModal) return;
    setSaving(true);
    try {
      await assignSession({ companyId, ocAgentId: assignModal.agentId, sessionId });
      refetch?.();
      setAssignModal(null);
    } catch (e: any) { alert("Ошибка: " + (e?.message || e)); }
    finally { setSaving(false); }
  }

  async function handleUpdateModel() {
    if (!modelModal) return;
    setSaving(true);
    try {
      const isDefault = modelInput === "" || modelInput === "default";
      const body: Record<string, unknown> = { companyId, agentId: modelModal.agentId };
      if (isDefault) { body.removeModel = true; } else { body.model = { primary: modelInput, fallbacks: defaults?.model?.fallbacks || [] }; }
      await updateModel(body);
      refetch?.();
      setModelModal(null);
    } catch (e: any) {
      alert("Ошибка: " + (e?.message || e));
    } finally { setSaving(false); }
  }

  if (loading) return <div style={{ color: "#888", padding: "2rem" }}>Загрузка...</div>;
  if (ocData?.error) return <div style={{ color: "#f87171", padding: "2rem" }}>Ошибка: {ocData.error}</div>;

  // Summarize profiles across all agents (they're identical)
  const sampleProfiles = ocAgents[0]?.profiles || {};
  const profileSummary = Object.entries(sampleProfiles).reduce((acc: Record<string, number>, [, v]: [string, any]) => {
    acc[v.status] = (acc[v.status] || 0) + 1; return acc;
  }, {});

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ ...s.card, margin: 0, padding: "0.5rem 0.75rem", flex: "1 1 auto", background: "#111827", borderColor: "#1e3a5f" }}>
          <div style={{ fontSize: "0.75rem", color: "#93c5fd" }}>
            <strong>Default:</strong> {defaults?.model?.primary || "—"}
            {defaults?.model?.fallbacks?.length > 0 && (
              <span style={{ color: "#555", marginLeft: "0.5rem" }}>→ {defaults.model.fallbacks.map((f: string) => f.split("/").pop()).join(" → ")}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {Object.entries(profileSummary).map(([st, count]) => (
            <span key={st} style={s.badge(st === "active" ? "green" : st === "expired" ? "red" : st === "expiring" ? "yellow" : "blue")}>
              {count} {st}
            </span>
          ))}
        </div>
      </div>

      {/* Agents table */}
      <table style={s.table}>
        <thead><tr>
          <th style={s.th}>Агент</th>
          <th style={s.th}>Модель</th>
          <th style={s.th}>Профили</th>
          <th style={s.th}>Сессии</th>
          <th style={{ ...s.th, width: 80 }}>Действия</th>
        </tr></thead>
        <tbody>
          {ocAgents.map((agent: any) => {
            const modelPrimary = agent.model?.primary || "";
            const isDefault = !modelPrimary || agent.isDefault;
            const modelShort = isDefault ? "дефолт" : modelPrimary.split("/").pop();
            const profiles = agent.profiles || {};
            const pKeys = Object.keys(profiles);
            const pActive = pKeys.filter(k => profiles[k].status === "active").length;
            const pExpiring = pKeys.filter(k => profiles[k].status === "expiring").length;
            const pExpired = pKeys.filter(k => profiles[k].status === "expired").length;
            const assignedSessions = agent.sessions || [];
            const isExpanded = expanded === agent.id;

            return (
              <tr key={agent.id} style={{ borderBottom: "1px solid #2a2a2a" }}>
                {/* Agent name */}
                <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>{agent.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{agent.name}</div>
                      <div style={{ color: "#555", fontSize: "0.65rem" }}>{agent.id}</div>
                    </div>
                    {agent.telegram && <span style={{ ...s.badge("blue"), fontSize: "0.6rem", padding: "0.1rem 0.3rem" }}>TG</span>}
                  </div>
                </td>

                {/* Model */}
                <td style={s.td}>
                  <span style={{ ...s.mono, fontSize: "0.75rem", color: isDefault ? "#666" : "#a5f3fc", cursor: "pointer" }}
                    onClick={() => { setModelInput(isDefault ? "" : modelPrimary); setModelModal({ agentId: agent.id, agentName: agent.name, currentModel: agent.model }); }}>
                    {modelShort}
                  </span>
                  {agent.paperclip && (
                    <div style={{ fontSize: "0.6rem", color: "#555", marginTop: "0.15rem" }}>{agent.paperclip.adapter}</div>
                  )}
                </td>

                {/* Profiles summary */}
                <td style={s.td}>
                  <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", cursor: "pointer" }}
                    onClick={() => setExpanded(isExpanded ? null : agent.id)}>
                    {pActive > 0 && <span style={{ ...s.badge("green"), fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>{pActive}</span>}
                    {pExpiring > 0 && <span style={{ ...s.badge("yellow"), fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>{pExpiring}</span>}
                    {pExpired > 0 && <span style={{ ...s.badge("red"), fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>{pExpired}</span>}
                    <span style={{ color: "#555", fontSize: "0.65rem" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.2rem" }}>
                      {pKeys.map(pk => (
                        <span key={pk} style={{ ...s.badge(profiles[pk].status === "active" ? "green" : profiles[pk].status === "expired" ? "red" : profiles[pk].status === "expiring" ? "yellow" : "blue"), fontSize: "0.6rem", padding: "0.1rem 0.3rem" }}>
                          {pk.replace("openai-codex:", "oc:").replace("anthropic:", "ant:").replace("gemini:", "gem:")}
                        </span>
                      ))}
                    </div>
                  )}
                </td>

                {/* Sessions */}
                <td style={s.td}>
                  {assignedSessions.length === 0 ? (
                    <span style={{ color: "#555", fontSize: "0.7rem" }}>—</span>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem" }}>
                      {assignedSessions.map((sess: any) => (
                        <span key={sess.id} style={{ ...s.badge(statusColor(sess.status)), fontSize: "0.6rem", padding: "0.1rem 0.3rem", cursor: "pointer" }}
                          onClick={async () => { setSaving(true); try { await unassignSession({ companyId, sessionId: sess.id }); refetch?.(); } finally { setSaving(false); } }}>
                          {sess.profileKey.split(":").pop()} ✕
                        </span>
                      ))}
                    </div>
                  )}
                </td>

                {/* Actions */}
                <td style={s.td}>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <button style={{ ...s.btn("small"), fontSize: "0.65rem" }} onClick={() => { setModelInput(isDefault ? "" : modelPrimary); setModelModal({ agentId: agent.id, agentName: agent.name, currentModel: agent.model }); }}>✏️</button>
                    <button style={{ ...s.btn("small"), fontSize: "0.65rem" }} onClick={() => setAssignModal({ agentId: agent.id, agentName: agent.name })}>+</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Assign session modal */}
      {assignModal && (
        <div style={s.modal} onClick={() => setAssignModal(null)}>
          <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...s.h2, marginBottom: "0.75rem" }}>{assignModal.agentName} ← сессия</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", maxHeight: 350, overflowY: "auto" }}>
              {sessions.filter((ss: any) => ss.status !== "deleted").map((sess: any) => (
                <button key={sess.id} style={{
                  ...s.btn(), padding: "0.4rem 0.6rem", textAlign: "left", fontSize: "0.8rem",
                  background: sess.ocAgentId === assignModal.agentId ? "#2563eb22" : "transparent",
                  borderColor: sess.ocAgentId === assignModal.agentId ? "#2563eb" : "#333",
                }} onClick={() => handleAssignSession(sess.id)} disabled={saving}>
                  <span style={{ ...s.badge(statusColor(sess.status)), fontSize: "0.65rem", padding: "0.1rem 0.3rem" }}>{sess.provider}</span>
                  {" "}<span style={{ ...s.mono, fontSize: "0.75rem" }}>{sess.profileKey}</span>
                  {sess.ocAgentId && sess.ocAgentId !== assignModal.agentId && (
                    <span style={{ color: "#f59e0b", fontSize: "0.65rem" }}> → {sess.ocAgentId}</span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ marginTop: "0.75rem", textAlign: "right" }}>
              <button style={s.btn()} onClick={() => setAssignModal(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Model modal */}
      {modelModal && (
        <div style={s.modal} onClick={() => setModelModal(null)}>
          <div style={{ ...s.modalBox, minWidth: 300 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...s.h2, marginBottom: "0.5rem" }}>{modelModal.agentName}</h3>
            <select style={{ ...s.select, width: "100%", boxSizing: "border-box" as const, padding: "0.4rem" }}
              value={modelInput} onChange={(e) => setModelInput(e.target.value)}>
              {MODEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {modelModal.currentModel?.fallbacks?.length > 0 && (
              <div style={{ color: "#555", fontSize: "0.65rem", marginTop: "0.3rem" }}>
                Fallbacks: {modelModal.currentModel.fallbacks.map((f: string) => f.split("/").pop()).join(" → ")}
              </div>
            )}
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
              <button style={s.btn()} onClick={() => setModelModal(null)}>Отмена</button>
              <button style={s.btn("primary")} onClick={handleUpdateModel} disabled={saving}>{saving ? "..." : "OK"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getHashTab(): "accounts" | "proxies" | "sessions" | "bots" | "agents" {
  const h = (typeof window !== "undefined" ? window.location.hash : "").replace("#", "");
  if (h === "proxies" || h === "sessions" || h === "bots" || h === "agents") return h;
  return "accounts";
}

export function DevicesPage(_props: PluginPageProps) {
  const { companyId } = useHostContext();
  const { data: agentsData } = usePluginData<{ agents: any[] }>("agents-dropdown", { companyId });
  const { data: sessionsData } = usePluginData<{ sessions: any[] }>("sessions-list", { companyId });
  const [activeTab, setActiveTab] = useState<"accounts" | "proxies" | "sessions" | "bots" | "agents">(getHashTab());
  const agents = agentsData?.agents || [];
  const sessions = sessionsData?.sessions || [];

  const switchTab = (tab: "accounts" | "proxies" | "sessions" | "bots" | "agents") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") window.location.hash = tab;
  };

  return (
    <div style={s.page}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}><IconAccounts size={24} /> Аккаунты и ресурсы</h1>
      <p style={{ color: "#888", marginBottom: "1rem", fontSize: "0.85rem" }}>
        GPT-аккаунты, прокси, OAuth-сессии и Telegram-боты
      </p>
      <div style={s.tabs}>
        <button style={s.tab(activeTab === "accounts")} onClick={() => switchTab("accounts")}>🔑 Аккаунты</button>
        <button style={s.tab(activeTab === "proxies")} onClick={() => switchTab("proxies")}>🌐 Прокси</button>
        <button style={s.tab(activeTab === "sessions")} onClick={() => switchTab("sessions")}>🔒 Сессии</button>
        <button style={s.tab(activeTab === "bots")} onClick={() => switchTab("bots")}>🤖 Telegram-боты</button>
        <button style={s.tab(activeTab === "agents")} onClick={() => switchTab("agents")}>🧠 Агенты</button>
      </div>
      {activeTab === "accounts" && <AccountsTab agents={agents} />}
      {activeTab === "proxies" && <ProxiesTab agents={agents} />}
      {activeTab === "sessions" && <SessionsTab agents={agents} />}
      {activeTab === "bots" && <BotsTab agents={agents} />}
      {activeTab === "agents" && <AgentsTab sessions={sessions} />}
    </div>
  );
}

// ── Sidebar Link ──
export function DevicesSidebarLink() {
  const { companyPrefix } = useHostContext();
  const href = companyPrefix ? `/${companyPrefix}/devices` : "/devices";
  return <a href={href} style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "0.5rem" }}>
    <IconAccounts size={16} /> Аккаунты
  </a>;
}

// ── Dashboard Widget ──
export function DevicesWidget(_props: PluginWidgetProps) {
  const { companyId } = useHostContext();
  const { data, loading } = usePluginData<{
    accounts: number; accountsActive: number; proxies: number; proxiesAlive: number; sessions: number; bots: number;
  }>("devices-stats", { companyId });

  if (loading) return <div style={{ padding: "0.5rem" }}>Загрузка...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "0.25rem" }}>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{data?.accountsActive ?? 0}/{data?.accounts ?? 0}</div>
        <div style={{ fontSize: "0.75rem", color: "#888" }}>Аккаунтов</div>
      </div>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{data?.proxiesAlive ?? 0}/{data?.proxies ?? 0}</div>
        <div style={{ fontSize: "0.75rem", color: "#888" }}>Прокси</div>
      </div>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{data?.sessions ?? 0}</div>
        <div style={{ fontSize: "0.75rem", color: "#888" }}>Сессий</div>
      </div>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{data?.bots ?? 0}</div>
        <div style={{ fontSize: "0.75rem", color: "#888" }}>TG-ботов</div>
      </div>
    </div>
  );
}
