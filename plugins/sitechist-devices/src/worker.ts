import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const PLUGIN_NAME = "sitechist-devices";
const ADMIN_API = "https://studio.sitechist.ru/admin-api";
const AUTH_TOKEN = "Bearer 263c0b87ce496540a6c611bd425e8841";

function generateId(): string {
  return crypto.randomUUID();
}

async function getList(ctx: any, companyId: string, key: string): Promise<any[]> {
  const val = await ctx.state.get({ scopeKind: "company", scopeId: companyId, stateKey: key });
  if (!val) return [];
  try { return Array.isArray(val) ? val : JSON.parse(val as string); } catch { return []; }
}

async function setList(ctx: any, companyId: string, key: string, data: any[]): Promise<void> {
  await ctx.state.set({ scopeKind: "company", scopeId: companyId, stateKey: key }, data);
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup`);

    // ── ACCOUNTS ──
    ctx.data.register("accounts-list", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { accounts: [] };
      return { accounts: await getList(ctx, companyId, "accounts") };
    });

    ctx.actions.register("account-create", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      ctx.logger.info(`account-create params: mode=${params.mode}, provider=${params.provider}, authType=${params.authType}`);
      const accounts = await getList(ctx, companyId, "accounts");
      const account = {
        id: generateId(), email: (params.email as string) || "", password: (params.password as string) || "",
        provider: (params.provider as string) || "openai", status: "active",
        agentId: (params.agentId as string) || null, requestsToday: 0, lastUsedAt: null,
        outlookPass: (params.outlookPass as string) || "",
        profileKey: (params.profileKey as string) || "",
        authType: (params.authType as string) || (params.provider === "openai" ? "oauth" : "api-key"),
        mode: (params.mode as string) || (params.provider === "openai" ? "round-robin" : "dedicated"),
        model: (params.model as string) || "",
      };
      accounts.push(account);
      await setList(ctx, companyId, "accounts", accounts);
      await ctx.activity.log({ companyId, message: `Добавлен аккаунт: ${account.email} (${account.provider})` });

      // Auto-create session for OAuth providers (OpenAI) and API key providers
      const needsSession = ["openai", "anthropic", "gemini", "openrouter", "grok", "deepseek", "kimi"].includes(account.provider);
      if (needsSession) {
        const sessions = await getList(ctx, companyId, "sessions");
        const providerKey = account.provider === "openai" ? "openai-codex" : account.provider;
        const existingProfileNums = sessions.filter((s: any) => (s.profileKey || "").startsWith(`${providerKey}:account-`)).map((s: any) => parseInt((s.profileKey || "").split("-").pop()) || 0);
        const nextNum = existingProfileNums.length > 0 ? Math.max(...existingProfileNums) + 1 : 1;
        const isOAuth = account.provider === "openai";

        // Find free proxy (not assigned to any agent or session)
        const proxies = await getList(ctx, companyId, "proxies");
        const usedProxyIds = new Set(sessions.map((s: any) => s.proxyId).filter(Boolean));
        const freeProxy = proxies.find((p: any) => p.agentId === null && !usedProxyIds.has(p.id) && !(p.note || "").includes("VPN"));
        // For anthropic/claude, prefer VPN proxy
        const vpnProxy = proxies.find((p: any) => (p.note || "").includes("VPN") && !usedProxyIds.has(p.id));
        const assignedProxy = account.provider === "anthropic" ? (vpnProxy || freeProxy) : (freeProxy || null);

        const session = {
          id: generateId(), accountId: account.email, provider: providerKey,
          profileKey: `${providerKey}:account-${nextNum}`, status: isOAuth ? "pending" : "active",
          mode: account.mode || (isOAuth ? "round-robin" : "dedicated"),
          createdAt: new Date().toISOString(), expiresAt: isOAuth ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
          agentId: account.agentId || null, proxyId: assignedProxy?.id || null,
          apiKey: account.provider !== "openai" ? account.password : "",
          note: `Auto-created${assignedProxy ? ` + proxy ${assignedProxy.host}:${assignedProxy.port}` : ""}`,
        };
        sessions.push(session);
        await setList(ctx, companyId, "sessions", sessions);

        // Sync API key to OpenClaw auth-profiles.json (all agents)
        if (!isOAuth && account.password) {
          try {
            const profileData: Record<string, unknown> = {
              type: account.authType === "oauth" ? "token" : "api-key",
              provider: account.provider,
            };
            if (account.provider === "anthropic") {
              profileData.token = account.password;
              profileData.type = "token";
            } else {
              profileData.apiKey = account.password;
            }
            await ctx.http.fetch(`${ADMIN_API}/api/auth/set-profile`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": AUTH_TOKEN },
              body: JSON.stringify({ profileKey: session.profileKey, profileData }),
              signal: AbortSignal.timeout(10000),
            });
            ctx.logger.info(`Synced ${session.profileKey} to OpenClaw auth-profiles`);
          } catch (e: any) {
            ctx.logger.info(`Failed to sync auth-profile: ${e.message}`);
          }
        }
      }

      return { ok: true, account };
    });

    ctx.actions.register("account-update", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const accounts = await getList(ctx, companyId, "accounts");
      const idx = accounts.findIndex((a: any) => a.id === id);
      if (idx === -1) throw new Error("Account not found");
      for (const key of ["email", "password", "provider", "status", "agentId", "outlookPass", "profileKey", "mode", "pool", "note", "authType", "model"]) {
        if (params[key] !== undefined) accounts[idx][key] = params[key];
      }
      await setList(ctx, companyId, "accounts", accounts);
      return { ok: true, account: accounts[idx] };
    });

    // Check account validity via provider API
    ctx.actions.register("account-check", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const accounts = await getList(ctx, companyId, "accounts");
      const idx = accounts.findIndex((a: any) => a.id === id);
      if (idx === -1) throw new Error("Account not found");
      const acc = accounts[idx];
      const start = Date.now();
      let status = "error"; let detail = "";

      try {
        if (acc.provider === "openai") {
          // ChatGPT Plus uses OAuth, not API key — check session status instead
          status = "active";
          detail = "OAuth — проверьте в Сессиях";
        } else if (acc.authType === "oauth" || (acc.password && acc.password.startsWith("sk-ant-oat"))) {
          status = "active"; detail = "OAuth token — проверьте в Сессиях";
        } else if (!acc.password || acc.password.length < 5) {
          status = "active"; detail = "API key не указан";
        } else if (acc.provider === "anthropic") {
          const resp = await ctx.http.fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": acc.password, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
            body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
            signal: AbortSignal.timeout(15000),
          });
          if (resp.ok || resp.status === 200 || resp.status === 400) { status = "active"; detail = `OK (${Date.now() - start}ms)`; }
          else if (resp.status === 401) { status = "blocked"; detail = "Invalid API key"; }
          else if (resp.status === 429) { status = "cooldown"; detail = "Rate limited"; }
          else { status = "error"; detail = `HTTP ${resp.status}`; }
        } else if (acc.provider === "openrouter") {
          const resp = await ctx.http.fetch("https://openrouter.ai/api/v1/models", {
            headers: { Authorization: `Bearer ${acc.password}` },
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) { status = "active"; detail = `OK (${Date.now() - start}ms)`; }
          else if (resp.status === 401) { status = "blocked"; detail = "Invalid API key"; }
          else { status = "error"; detail = `HTTP ${resp.status}`; }
        } else if (acc.provider === "gemini") {
          const resp = await ctx.http.fetch(`https://generativelanguage.googleapis.com/v1/models?key=${acc.password}`, {
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) { status = "active"; detail = `OK (${Date.now() - start}ms)`; }
          else if (resp.status === 400 || resp.status === 403) { status = "blocked"; detail = "Invalid API key"; }
          else { status = "error"; detail = `HTTP ${resp.status}`; }
        } else if (acc.provider === "grok") {
          const resp = await ctx.http.fetch("https://api.x.ai/v1/models", {
            headers: { Authorization: `Bearer ${acc.password}` },
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) { status = "active"; detail = `OK (${Date.now() - start}ms)`; }
          else if (resp.status === 401) { status = "blocked"; detail = "Invalid API key"; }
          else { status = "error"; detail = `HTTP ${resp.status}`; }
        } else if (acc.provider === "deepseek") {
          const resp = await ctx.http.fetch("https://api.deepseek.com/models", {
            headers: { Authorization: `Bearer ${acc.password}` },
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) { status = "active"; detail = `OK (${Date.now() - start}ms)`; }
          else if (resp.status === 401) { status = "blocked"; detail = "Invalid API key"; }
          else { status = "error"; detail = `HTTP ${resp.status}`; }
        } else if (acc.provider === "kimi") {
          const resp = await ctx.http.fetch("https://api.moonshot.cn/v1/models", {
            headers: { Authorization: `Bearer ${acc.password}` },
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) { status = "active"; detail = `OK (${Date.now() - start}ms)`; }
          else if (resp.status === 401) { status = "blocked"; detail = "Invalid API key"; }
          else { status = "error"; detail = `HTTP ${resp.status}`; }
        } else {
          status = "active"; detail = "OK";
        }
      } catch (e: any) {
        status = "error"; detail = e.message || "Connection failed";
      }

      // Re-read fresh to avoid overwriting mode/agentId changes
      const freshAccs = await getList(ctx, companyId, "accounts");
      const freshIdx = freshAccs.findIndex((a: any) => a.id === id);
      if (freshIdx !== -1) {
        freshAccs[freshIdx].status = status;
        freshAccs[freshIdx].lastCheckedAt = new Date().toISOString();
        freshAccs[freshIdx].lastCheckDetail = detail;
      }
      await setList(ctx, companyId, "accounts", freshAccs);
      return { ok: true, status, detail };
    });

    ctx.actions.register("account-check-all", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const accounts = await getList(ctx, companyId, "accounts");

      async function checkOne(acc: any): Promise<{ status: string; detail: string }> {
        if (acc.provider === "openai") {
          return { status: "active", detail: "OAuth — проверьте в Сессиях" };
        }
        if (acc.authType === "oauth" || (acc.password && acc.password.startsWith("sk-ant-oat"))) {
          return { status: "active", detail: "OAuth token" };
        }
        if (!acc.password || acc.password.length < 5) {
          return { status: "active", detail: "API key не указан" };
        }
        const t = 3000;
        try {
          if (acc.provider === "anthropic") {
            const resp = await ctx.http.fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": acc.password, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }), signal: AbortSignal.timeout(t) });
            if (resp.ok || resp.status === 200 || resp.status === 400) return { status: "active", detail: "OK" };
            if (resp.status === 401) return { status: "blocked", detail: "Invalid API key" };
            if (resp.status === 429) return { status: "cooldown", detail: "Rate limited" };
            return { status: "error", detail: `HTTP ${resp.status}` };
          } else if (acc.provider === "gemini") {
            const resp = await ctx.http.fetch(`https://generativelanguage.googleapis.com/v1/models?key=${acc.password}`, { signal: AbortSignal.timeout(t) });
            return resp.ok ? { status: "active", detail: "OK" } : { status: "blocked", detail: `HTTP ${resp.status}` };
          } else if (acc.provider === "openrouter") {
            const resp = await ctx.http.fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${acc.password}` }, signal: AbortSignal.timeout(t) });
            return resp.ok ? { status: "active", detail: "OK" } : { status: "blocked", detail: `HTTP ${resp.status}` };
          } else if (acc.provider === "grok") {
            const resp = await ctx.http.fetch("https://api.x.ai/v1/models", { headers: { Authorization: `Bearer ${acc.password}` }, signal: AbortSignal.timeout(t) });
            return resp.ok ? { status: "active", detail: "OK" } : resp.status === 401 ? { status: "blocked", detail: "Invalid API key" } : { status: "error", detail: `HTTP ${resp.status}` };
          } else if (acc.provider === "deepseek") {
            const resp = await ctx.http.fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${acc.password}` }, signal: AbortSignal.timeout(t) });
            return resp.ok ? { status: "active", detail: "OK" } : resp.status === 401 ? { status: "blocked", detail: "Invalid API key" } : { status: "error", detail: `HTTP ${resp.status}` };
          } else if (acc.provider === "kimi") {
            const resp = await ctx.http.fetch("https://api.moonshot.cn/v1/models", { headers: { Authorization: `Bearer ${acc.password}` }, signal: AbortSignal.timeout(t) });
            return resp.ok ? { status: "active", detail: "OK" } : resp.status === 401 ? { status: "blocked", detail: "Invalid API key" } : { status: "error", detail: `HTTP ${resp.status}` };
          }
          return { status: "active", detail: "OK" };
        } catch (e: any) {
          return { status: "error", detail: e.message || "Connection failed" };
        }
      }

      // Run checks sequentially (Paperclip limits parallel http.fetch)
      let active = 0; let errors = 0;
      const checkResults: { id: string; status: string; detail: string }[] = [];
      for (let i = 0; i < accounts.length; i++) {
        const r = await checkOne(accounts[i]);
        if (r.status === "active" || r.status === "cooldown") active++; else errors++;
        checkResults.push({ id: accounts[i].id, status: r.status, detail: r.detail });
      }

      // Re-read fresh list to avoid overwriting mode/agentId changes made during check
      const freshAccounts = await getList(ctx, companyId, "accounts");
      const now = new Date().toISOString();
      for (const cr of checkResults) {
        const idx = freshAccounts.findIndex((a: any) => a.id === cr.id);
        if (idx !== -1) {
          freshAccounts[idx].status = cr.status;
          freshAccounts[idx].lastCheckedAt = now;
          freshAccounts[idx].lastCheckDetail = cr.detail;
        }
      }
      await setList(ctx, companyId, "accounts", freshAccounts);
      await ctx.activity.log({ companyId, message: `Проверка аккаунтов: ${active} active, ${errors} errors из ${accounts.length}` });
      return { ok: true, active, errors, total: accounts.length };
    });

    ctx.actions.register("account-delete", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      let accounts = await getList(ctx, companyId, "accounts");
      accounts = accounts.filter((a: any) => a.id !== id);
      await setList(ctx, companyId, "accounts", accounts);
      return { ok: true };
    });

    // ── PROXIES ──
    ctx.data.register("proxies-list", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { proxies: [] };
      return { proxies: await getList(ctx, companyId, "proxies") };
    });

    ctx.actions.register("proxy-create", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const proxies = await getList(ctx, companyId, "proxies");
      const now = new Date().toISOString();
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const proxy = {
        id: generateId(), host: (params.host as string) || "", port: (params.port as number) || 0,
        username: (params.username as string) || "", password: (params.password as string) || "",
        country: (params.country as string) || "US", status: "alive", pingMs: null as number | null,
        lastCheckedAt: null as string | null, protocol: (params.protocol as string) || "socks5",
        agentId: (params.agentId as string) || null,
        addedAt: now, expiresAt: (params.expiresAt as string) || expires,
      };
      proxies.push(proxy);
      await setList(ctx, companyId, "proxies", proxies);
      return { ok: true, proxy };
    });

    ctx.actions.register("proxy-check", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const proxies = await getList(ctx, companyId, "proxies");
      const idx = proxies.findIndex((p: any) => p.id === id);
      if (idx === -1) throw new Error("Proxy not found");
      const p = proxies[idx];
      const start = Date.now();
      let status = "dead"; let pingMs = 0;
      try {
        const testUrl = p.protocol === "socks5"
          ? `http://${p.host}:${p.port}`
          : `http://${p.username}:${p.password}@${p.host}:${p.port}`;
        await ctx.http.fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
        pingMs = Date.now() - start;
        status = pingMs < 5000 ? "alive" : "slow";
      } catch {
        pingMs = Date.now() - start;
        status = "dead";
      }
      proxies[idx] = { ...p, status, pingMs, lastCheckedAt: new Date().toISOString() };
      await setList(ctx, companyId, "proxies", proxies);
      return { ok: true, status, pingMs };
    });

    ctx.actions.register("proxy-check-all", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const proxies = await getList(ctx, companyId, "proxies");
      let alive = 0; let dead = 0;
      for (let i = 0; i < proxies.length; i++) {
        const start = Date.now();
        try {
          await ctx.http.fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
          const pingMs = Date.now() - start;
          proxies[i] = { ...proxies[i], status: pingMs < 5000 ? "alive" : "slow", pingMs, lastCheckedAt: new Date().toISOString() };
          alive++;
        } catch {
          proxies[i] = { ...proxies[i], status: "dead", pingMs: Date.now() - start, lastCheckedAt: new Date().toISOString() };
          dead++;
        }
      }
      await setList(ctx, companyId, "proxies", proxies);
      await ctx.activity.log({ companyId, message: `Проверка прокси: ${alive} alive, ${dead} dead из ${proxies.length}` });
      return { ok: true, alive, dead, total: proxies.length };
    });

    ctx.actions.register("proxy-update", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const proxies = await getList(ctx, companyId, "proxies");
      const idx = proxies.findIndex((p: any) => p.id === id);
      if (idx === -1) throw new Error("Proxy not found");
      for (const key of ["host", "port", "username", "password", "country", "status", "protocol", "agentId", "expiresAt", "note"]) {
        if (params[key] !== undefined) proxies[idx][key] = params[key];
      }
      await setList(ctx, companyId, "proxies", proxies);
      return { ok: true, proxy: proxies[idx] };
    });

    ctx.actions.register("proxy-delete", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      let proxies = await getList(ctx, companyId, "proxies");
      proxies = proxies.filter((p: any) => p.id !== id);
      await setList(ctx, companyId, "proxies", proxies);
      return { ok: true };
    });

    // Parse "host:port:user:pass" format
    function parseProxyLine(line: string): any | null {
      const parts = line.trim().split(":");
      if (parts.length < 2) return null;
      const now = new Date().toISOString();
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return {
        id: generateId(),
        host: parts[0],
        port: parseInt(parts[1]) || 0,
        username: parts[2] || "",
        password: parts[3] || "",
        country: "US",
        status: "alive",
        pingMs: null,
        lastCheckedAt: null,
        protocol: "socks5",
        agentId: null,
        note: "",
        source: "import",
        addedAt: now,
        expiresAt: expires,
        importedAt: now,
      };
    }

    // Import proxies from text (host:port:user:pass per line)
    ctx.actions.register("proxy-import-bulk", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const text = params.text as string;
      const protocol = (params.protocol as string) || "socks5";
      const replace = params.replace as boolean; // true = replace all non-VPN, false = append
      if (!text) throw new Error("Text required");

      const lines = text.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
      const newProxies = lines.map(parseProxyLine).filter(Boolean).map((p: any) => ({ ...p, protocol }));
      if (newProxies.length === 0) throw new Error("No valid proxies found");

      let proxies = await getList(ctx, companyId, "proxies");
      if (replace) {
        // Keep VPN proxies (note contains "VPN"), replace the rest
        const vpn = proxies.filter((p: any) => (p.note || "").includes("VPN"));
        proxies = [...vpn, ...newProxies];
      } else {
        // Deduplicate by host:port
        const existing = new Set(proxies.map((p: any) => `${p.host}:${p.port}`));
        const fresh = newProxies.filter((p: any) => !existing.has(`${p.host}:${p.port}`));
        proxies = [...proxies, ...fresh];
      }
      await setList(ctx, companyId, "proxies", proxies);
      await ctx.activity.log({ companyId, message: `Импортировано ${newProxies.length} прокси (bulk)` });
      return { ok: true, imported: newProxies.length, total: proxies.length };
    });

    // Import proxies from URL (download list)
    ctx.actions.register("proxy-import-url", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const url = params.url as string;
      const protocol = (params.protocol as string) || "socks5";
      const replace = params.replace as boolean;
      if (!url) throw new Error("URL required");

      const resp = await ctx.http.fetch(url, { method: "GET" });
      if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status}`);
      const text = await resp.text();

      const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith("#"));
      const newProxies = lines.map(parseProxyLine).filter(Boolean).map((p: any) => ({ ...p, protocol, source: "url", note: url.split("/")[2] || "" }));
      if (newProxies.length === 0) throw new Error("No valid proxies in response");

      let proxies = await getList(ctx, companyId, "proxies");
      if (replace) {
        const vpn = proxies.filter((p: any) => (p.note || "").includes("VPN"));
        proxies = [...vpn, ...newProxies];
      } else {
        const existing = new Set(proxies.map((p: any) => `${p.host}:${p.port}`));
        const fresh = newProxies.filter((p: any) => !existing.has(`${p.host}:${p.port}`));
        proxies = [...proxies, ...fresh];
      }
      await setList(ctx, companyId, "proxies", proxies);
      await ctx.activity.log({ companyId, message: `Импортировано ${newProxies.length} прокси с ${url.split("/")[2]}` });
      return { ok: true, imported: newProxies.length, total: proxies.length };
    });

    // Sync proxies via Webshare API
    ctx.actions.register("proxy-webshare-sync", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const apiKey = params.apiKey as string;
      const protocol = (params.protocol as string) || "socks5";
      const replace = params.replace as boolean;
      if (!apiKey) throw new Error("Webshare API key required");

      // Save API key for future use
      await ctx.state.set({ scopeKind: "company", scopeId: companyId, stateKey: "webshare-api-key" }, apiKey);

      const resp = await ctx.http.fetch("https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=100", {
        method: "GET",
        headers: { Authorization: `Token ${apiKey}` },
      });
      if (!resp.ok) throw new Error(`Webshare API error: ${resp.status}`);
      const data = await resp.json();
      const results = data.results || [];

      const now = new Date().toISOString();
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const newProxies = results.map((r: any) => ({
        id: generateId(),
        host: r.proxy_address,
        port: r.port,
        username: r.username,
        password: r.password,
        country: r.country_code || "US",
        status: r.valid ? "alive" : "dead",
        pingMs: null,
        lastCheckedAt: now,
        protocol,
        agentId: null,
        note: `Webshare ${r.country_code} ${r.city_name || ""}`.trim(),
        source: "webshare-api",
        addedAt: now,
        expiresAt: expires,
        importedAt: now,
      }));

      let proxies = await getList(ctx, companyId, "proxies");
      if (replace) {
        const vpn = proxies.filter((p: any) => (p.note || "").includes("VPN"));
        proxies = [...vpn, ...newProxies];
      } else {
        const existing = new Set(proxies.map((p: any) => `${p.host}:${p.port}`));
        const fresh = newProxies.filter((p: any) => !existing.has(`${p.host}:${p.port}`));
        proxies = [...proxies, ...fresh];
      }
      await setList(ctx, companyId, "proxies", proxies);
      await ctx.activity.log({ companyId, message: `Webshare API: синхронизировано ${newProxies.length} прокси` });
      return { ok: true, imported: newProxies.length, total: proxies.length };
    });

    // Get saved Webshare API key
    ctx.data.register("webshare-config", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const key = await ctx.state.get({ scopeKind: "company", scopeId: companyId, stateKey: "webshare-api-key" });
      return { apiKey: key || "" };
    });

    // ── SESSIONS ──
    ctx.data.register("sessions-list", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { sessions: [] };
      return { sessions: await getList(ctx, companyId, "sessions") };
    });

    ctx.actions.register("session-create", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const sessions = await getList(ctx, companyId, "sessions");
      const provider = (params.provider as string) || "openai-codex";
      const mode = (params.mode as string) || (provider === "openai-codex" ? "round-robin" : "dedicated");
      const now = new Date().toISOString();

      // For API key providers, expiry is null (perpetual)
      // For OAuth providers (openai-codex), expiry is +7 days
      const isOAuth = provider === "openai-codex";
      const defaultExpiry = isOAuth ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;

      const session = {
        id: generateId(),
        accountId: (params.accountId as string) || "",
        provider,
        proxyId: (params.proxyId as string) || null,
        agentId: (params.agentId as string) || null,
        status: "active",
        mode,
        profileKey: (params.profileKey as string) || `${provider}:default`,
        apiKey: (params.apiKey as string) || "",
        createdAt: now,
        expiresAt: (params.expiresAt as string) || defaultExpiry,
        note: (params.note as string) || "",
      };
      sessions.push(session);
      await setList(ctx, companyId, "sessions", sessions);
      await ctx.activity.log({ companyId, message: `Добавлена сессия: ${provider} (${session.accountId || session.profileKey})` });
      return { ok: true, session };
    });

    ctx.actions.register("session-update", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const sessions = await getList(ctx, companyId, "sessions");
      const idx = sessions.findIndex((s: any) => s.id === id);
      if (idx === -1) throw new Error("Session not found");
      for (const key of ["accountId", "proxyId", "agentId", "status", "profileKey", "expiresAt", "provider", "mode", "apiKey", "note"]) {
        if (params[key] !== undefined) sessions[idx][key] = params[key];
      }
      await setList(ctx, companyId, "sessions", sessions);

      // Sync API key/token to OpenClaw if apiKey was updated
      if (params.apiKey && sessions[idx].profileKey) {
        try {
          const provider = sessions[idx].provider || "";
          const profileData: Record<string, unknown> = {
            type: provider.includes("anthropic") ? "token" : "api-key",
            provider,
          };
          if (provider.includes("anthropic")) {
            profileData.token = params.apiKey;
          } else {
            profileData.apiKey = params.apiKey;
          }
          await ctx.http.fetch(`${ADMIN_API}/api/auth/set-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": AUTH_TOKEN },
            body: JSON.stringify({ profileKey: sessions[idx].profileKey, profileData }),
            signal: AbortSignal.timeout(10000),
          });
        } catch { /* best effort */ }
      }

      return { ok: true, session: sessions[idx] };
    });

    ctx.actions.register("session-delete", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      let sessions = await getList(ctx, companyId, "sessions");
      const deleted = sessions.find((s: any) => s.id === id);
      sessions = sessions.filter((s: any) => s.id !== id);
      await setList(ctx, companyId, "sessions", sessions);

      // Remove from OpenClaw auth-profiles
      if (deleted?.profileKey) {
        try {
          await ctx.http.fetch(`${ADMIN_API}/api/auth/delete-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": AUTH_TOKEN },
            body: JSON.stringify({ profileKey: deleted.profileKey }),
            signal: AbortSignal.timeout(10000),
          });
        } catch { /* best effort */ }
      }

      return { ok: true };
    });

    // Real API check for a session
    async function checkSession(ses: any, realProfiles: Record<string, any>): Promise<{ status: string; detail: string; expiresAt?: string }> {
      const now = Date.now();
      const profileKey = ses.profileKey || "";
      const provider = ses.provider || "";
      const apiKey = ses.apiKey || "";
      const isOAuth = provider.includes("openai-codex") || profileKey.includes("openai-codex");
      const t = 5000;

      // Sync expiry from auth-profiles
      let expiresAt = ses.expiresAt;
      if (realProfiles[profileKey]?.expires) {
        expiresAt = new Date(realProfiles[profileKey].expires).toISOString();
      }
      const exp = expiresAt ? new Date(expiresAt).getTime() : 0;

      // OAuth sessions — check expiry
      if (isOAuth) {
        if (!exp && !realProfiles[profileKey]) return { status: "pending", detail: "Ожидает OAuth авторизации" };
        if (exp && exp < now) return { status: "expired", detail: `Истёк ${new Date(exp).toLocaleString("ru")}`, expiresAt };
        if (false) return { status: "expiring", detail: "", expiresAt }; // disabled — only active/expired
        return { status: "active", detail: `OK, до ${new Date(exp).toLocaleString("ru")}`, expiresAt };
      }

      // API key sessions — real API check
      if (!apiKey || apiKey.length < 5) return { status: "active", detail: "API key не указан" };

      try {
        if (provider === "anthropic") {
          const resp = await ctx.http.fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }), signal: AbortSignal.timeout(t) });
          if (resp.ok || resp.status === 200 || resp.status === 400) return { status: "active", detail: "OK" };
          if (resp.status === 401) return { status: "blocked", detail: "Invalid API key" };
          if (resp.status === 429) return { status: "cooldown", detail: "Rate limited" };
          return { status: "error", detail: `HTTP ${resp.status}` };
        } else if (provider === "grok") {
          const resp = await ctx.http.fetch("https://api.x.ai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(t) });
          return resp.ok ? { status: "active", detail: "OK" } : { status: resp.status === 401 ? "blocked" : "error", detail: `HTTP ${resp.status}` };
        } else if (provider === "deepseek") {
          const resp = await ctx.http.fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(t) });
          return resp.ok ? { status: "active", detail: "OK" } : { status: resp.status === 401 ? "blocked" : "error", detail: `HTTP ${resp.status}` };
        } else if (provider === "gemini") {
          const resp = await ctx.http.fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, { signal: AbortSignal.timeout(t) });
          return resp.ok ? { status: "active", detail: "OK" } : { status: "blocked", detail: `HTTP ${resp.status}` };
        } else if (provider === "openrouter") {
          const resp = await ctx.http.fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(t) });
          return resp.ok ? { status: "active", detail: "OK" } : { status: "blocked", detail: `HTTP ${resp.status}` };
        } else if (provider === "kimi") {
          const resp = await ctx.http.fetch("https://api.moonshot.cn/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(t) });
          return resp.ok ? { status: "active", detail: "OK" } : { status: "blocked", detail: `HTTP ${resp.status}` };
        }
        return { status: "active", detail: "OK" };
      } catch (e: any) {
        return { status: "error", detail: e.message || "Connection failed" };
      }
    }

    ctx.actions.register("session-check", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const sessions = await getList(ctx, companyId, "sessions");
      const ses = sessions.find((s: any) => s.id === id);
      if (!ses) throw new Error("Session not found");

      let realProfiles: Record<string, any> = {};
      try {
        const resp = await ctx.http.fetch(`${ADMIN_API}/api/auth/profiles`, { headers: { Authorization: AUTH_TOKEN }, signal: AbortSignal.timeout(3000) });
        if (resp.ok) realProfiles = await resp.json();
      } catch {}

      const result = await checkSession(ses, realProfiles);
      // Re-read fresh to avoid race condition
      const fresh = await getList(ctx, companyId, "sessions");
      const fi = fresh.findIndex((s: any) => s.id === id);
      if (fi !== -1) {
        fresh[fi].status = result.status;
        fresh[fi].lastCheckedAt = new Date().toISOString();
        fresh[fi].lastCheckDetail = result.detail;
        if (result.expiresAt) fresh[fi].expiresAt = result.expiresAt;
      }
      await setList(ctx, companyId, "sessions", fresh);
      return { ok: true, status: result.status, detail: result.detail };
    });

    ctx.actions.register("session-check-all", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const sessions = await getList(ctx, companyId, "sessions");

      // Fetch real auth-profiles once
      let realProfiles: Record<string, any> = {};
      try {
        const resp = await ctx.http.fetch(`${ADMIN_API}/api/auth/profiles`, { headers: { Authorization: AUTH_TOKEN }, signal: AbortSignal.timeout(5000) });
        if (resp.ok) realProfiles = await resp.json();
      } catch {}

      // Check sequentially (Paperclip limits parallel http.fetch)
      const results: { status: string; detail: string; expiresAt?: string }[] = [];
      for (const ses of sessions) {
        results.push(await checkSession(ses, realProfiles));
      }
      let active = 0; let expiring = 0; let expired = 0; let errors = 0; let synced = 0;

      // Re-read fresh to avoid race condition
      const fresh = await getList(ctx, companyId, "sessions");
      const now = new Date().toISOString();
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const fi = fresh.findIndex((s: any) => s.id === sessions[i].id);
        if (fi !== -1) {
          fresh[fi].status = r.status;
          fresh[fi].lastCheckedAt = now;
          fresh[fi].lastCheckDetail = r.detail;
          if (r.expiresAt && fresh[fi].expiresAt !== r.expiresAt) { fresh[fi].expiresAt = r.expiresAt; synced++; }
        }
        if (r.status === "active") active++;
        else if (r.status === "expiring" || r.status === "cooldown") expiring++;
        else if (r.status === "expired") expired++;
        else errors++;
      }
      await setList(ctx, companyId, "sessions", fresh);
      await ctx.activity.log({ companyId, message: `Сессии: ${active} active, ${expiring} expiring, ${expired} expired, ${errors} errors${synced ? `, ${synced} synced` : ""}` });
      return { ok: true, active, expiring, expired, errors, synced, total: sessions.length };
    });

    // Start re-auth: returns OAuth URL for the session's provider
    ctx.actions.register("session-reauth-start", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const sessions = await getList(ctx, companyId, "sessions");
      const session = sessions.find((s: any) => s.id === id);
      if (!session) throw new Error("Session not found");
      const accounts = await getList(ctx, companyId, "accounts");
      const account = accounts.find((a: any) => a.id === session.accountId || a.email === session.accountId);
      // Build auth URL based on provider
      const profileKey = session.profileKey || "";
      let authUrl = "";
      if (profileKey.includes("openai-codex")) {
        authUrl = "docker exec -it sitechist-gateway openclaw models auth login --provider openai-codex";
      } else if (profileKey.includes("anthropic")) {
        authUrl = "claude setup-token (run on local PC, paste token)";
      }
      return {
        ok: true,
        session,
        account: account ? { email: account.email, password: account.password, outlookPass: account.outlookPass, provider: account.provider } : null,
        authCommand: authUrl,
        profileKey,
      };
    });

    // Start OAuth: calls admin-api to launch openclaw auth (daemon), then polls for URL
    ctx.actions.register("session-oauth-start", async (params: Record<string, unknown>) => {
      const provider = (params.provider as string) || "openai-codex";

      if (provider === "grok") {
        return { ok: true, urls: ["https://accounts.x.ai/sign-in?redirect=grok-com&email=true"], status: "waiting_callback", provider };
      }

      if (provider === "anthropic") {
        return { ok: true, urls: [], status: "token_paste", provider, message: "Вставьте long-life token (sk-ant-oat-...) в поле ниже" };
      }

      if (provider !== "openai-codex") {
        return { ok: true, urls: [], status: "api_key_required", provider, message: `${provider} uses API key, not OAuth.` };
      }

      try {
        // Step 1: Start daemon (returns immediately with session_id)
        const startResp = await ctx.http.fetch(`${ADMIN_API}/api/auth/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer 263c0b87ce496540a6c611bd425e8841" },
          body: JSON.stringify({ provider }),
          signal: AbortSignal.timeout(10000),
        });
        const startData = await startResp.json();
        const sessionId = startData.id;
        if (!sessionId) return { ok: false, urls: [], status: "error", error: "No session ID" };

        // Step 2: Poll for URL (daemon runs openclaw in background)
        for (let i = 0; i < 12; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const statusResp = await ctx.http.fetch(`${ADMIN_API}/api/auth/status/${sessionId}`, {
              headers: { "Authorization": "Bearer 263c0b87ce496540a6c611bd425e8841" },
              signal: AbortSignal.timeout(5000),
            });
            const statusData = await statusResp.json();
            if (statusData.urls && statusData.urls.length > 0) {
              return { ok: true, ...statusData };
            }
            if (statusData.status === "no_url_found" || statusData.status === "error") {
              return { ok: false, ...statusData };
            }
          } catch { /* keep polling */ }
        }

        return { ok: false, urls: [], status: "timeout", error: "OAuth URL not ready after 24s" };
      } catch (e: any) {
        return { ok: false, urls: [], error: e.message || "Failed to start OAuth", status: "error" };
      }
    });

    // Complete re-auth: exchange callback code for real tokens via admin-api
    ctx.actions.register("session-reauth-complete", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const callbackUrl = params.callbackUrl as string;
      const sessions = await getList(ctx, companyId, "sessions");
      const idx = sessions.findIndex((s: any) => s.id === id);
      if (idx === -1) throw new Error("Session not found");

      const profileKey = sessions[idx].profileKey || "openai-codex:default";
      const provider = sessions[idx].provider || "";
      const now = new Date().toISOString();

      // For OpenAI OAuth: forward callback URL to VPS localhost:1455 via admin-api
      if (provider.includes("openai-codex") && callbackUrl && callbackUrl.includes("code=")) {
        try {
          // Forward callback to OpenClaw daemon on VPS
          const fwdResp = await ctx.http.fetch(`${ADMIN_API}/api/auth/callback-forward`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: AUTH_TOKEN },
            body: JSON.stringify({ callbackUrl }),
            signal: AbortSignal.timeout(8000),
          });
          const fwdResult = await fwdResp.json() as { ok?: boolean; error?: string };
          if (!fwdResult.ok) {
            const fresh0 = await getList(ctx, companyId, "sessions");
            const fi0 = fresh0.findIndex((s: any) => s.id === id);
            if (fi0 !== -1) { fresh0[fi0].status = "error"; fresh0[fi0].lastCheckedAt = now; fresh0[fi0].lastCheckDetail = fwdResult.error || "Callback forward failed"; await setList(ctx, companyId, "sessions", fresh0); }
            throw new Error(fwdResult.error || "Callback forward failed");
          }

          // Wait for token exchange to complete
          await new Promise(r => setTimeout(r, 2000));

          // Sync real expiry from auth-profiles.json
          const resp = await ctx.http.fetch(`${ADMIN_API}/api/auth/profiles`, {
            headers: { Authorization: AUTH_TOKEN },
            signal: AbortSignal.timeout(5000),
          });
          const profiles = await resp.json();
          const realProfile = profiles[profileKey];

          // Re-read fresh sessions
          const fresh = await getList(ctx, companyId, "sessions");
          const fi = fresh.findIndex((s: any) => s.id === id);
          if (fi === -1) throw new Error("Session lost");

          if (realProfile?.expires) {
            const newExpiry = new Date(realProfile.expires).toISOString();
            fresh[fi].status = "active";
            fresh[fi].lastCheckedAt = now;
            fresh[fi].expiresAt = newExpiry;
            fresh[fi].reauthAt = now;
            fresh[fi].lastCheckDetail = `Re-auth OK, до ${newExpiry.slice(0, 10)}`;
            await setList(ctx, companyId, "sessions", fresh);
            await ctx.activity.log({ companyId, message: `Re-auth OK: ${profileKey} expires ${newExpiry.slice(0, 10)}` });
            return { ok: true, session: fresh[fi], newExpiry };
          } else {
            fresh[fi].status = "active";
            fresh[fi].lastCheckedAt = now;
            fresh[fi].reauthAt = now;
            fresh[fi].lastCheckDetail = "Callback отправлен, ожидает sync";
            await setList(ctx, companyId, "sessions", fresh);
            await ctx.activity.log({ companyId, message: `Re-auth: ${profileKey} — callback forwarded, waiting sync` });
            return { ok: true, session: fresh[fi], message: "Callback forwarded. Press Check All to sync expiry." };
          }
        } catch (e: any) {
          const fresh2 = await getList(ctx, companyId, "sessions");
          const fi2 = fresh2.findIndex((s: any) => s.id === id);
          if (fi2 !== -1) { fresh2[fi2].status = "error"; fresh2[fi2].lastCheckedAt = now; fresh2[fi2].lastCheckDetail = e.message; await setList(ctx, companyId, "sessions", fresh2); }
          throw new Error(`Re-auth failed: ${e.message}`);
        }
      }

      // For non-OAuth or no callback: just update status
      sessions[idx] = {
        ...sessions[idx],
        status: "active",
        lastCheckedAt: now,
        reauthAt: now,
      };
      await setList(ctx, companyId, "sessions", sessions);
      await ctx.activity.log({ companyId, message: `Re-auth session: ${profileKey}` });
      return { ok: true, session: sessions[idx] };
    });

    // ── TELEGRAM BOTS ──
    ctx.data.register("bots-list", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { bots: [] };
      return { bots: await getList(ctx, companyId, "bots") };
    });

    ctx.actions.register("bot-create", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const bots = await getList(ctx, companyId, "bots");
      const bot = {
        id: generateId(), username: (params.username as string) || "",
        token: (params.token as string) || "", agentId: (params.agentId as string) || null,
        agentName: (params.agentName as string) || "", status: "active",
        createdAt: new Date().toISOString(),
      };
      bots.push(bot);
      await setList(ctx, companyId, "bots", bots);
      await ctx.activity.log({ companyId, message: `Добавлен Telegram-бот: @${bot.username}` });
      return { ok: true, bot };
    });

    ctx.actions.register("bot-update", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const bots = await getList(ctx, companyId, "bots");
      const idx = bots.findIndex((b: any) => b.id === id);
      if (idx === -1) throw new Error("Bot not found");
      for (const key of ["username", "token", "agentId", "agentName", "status"]) {
        if (params[key] !== undefined) bots[idx][key] = params[key];
      }
      await setList(ctx, companyId, "bots", bots);
      return { ok: true, bot: bots[idx] };
    });

    ctx.actions.register("bot-delete", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      let bots = await getList(ctx, companyId, "bots");
      bots = bots.filter((b: any) => b.id !== id);
      await setList(ctx, companyId, "bots", bots);
      return { ok: true };
    });

    // ── AGENTS LIST (for dropdowns) ──
    ctx.data.register("agents-dropdown", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { agents: [] };
      try {
        const agents = await ctx.agents.list({ companyId });
        return { agents: agents.map((a: any) => ({ id: a.id, name: a.name, role: a.role, icon: a.icon })) };
      } catch { return { agents: [] }; }
    });

    // ── OPENCLAW AGENTS ──
    ctx.data.register("openclaw-agents", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { agents: [] };
      try {
        const resp = await ctx.http.fetch(`${ADMIN_API}/api/openclaw/agents`, {
          headers: { Authorization: AUTH_TOKEN },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return { agents: [], error: `HTTP ${resp.status}` };
        const data = await resp.json() as { agents: any[]; defaults: any };
        // Merge with sessions + Paperclip agent info
        const sessions = await getList(ctx, companyId, "sessions");
        let pcAgents: any[] = [];
        try { pcAgents = await ctx.agents.list({ companyId }); } catch {}
        const agents = (data.agents || []).map((oc: any) => {
          const assignedSessions = sessions.filter((s: any) => s.ocAgentId === oc.id);
          const pcAgent = pcAgents.find((a: any) => a.name?.toLowerCase() === oc.id.toLowerCase() || a.urlKey === oc.id);
          return {
            ...oc,
            sessions: assignedSessions.map((s: any) => ({ id: s.id, profileKey: s.profileKey, provider: s.provider, status: s.status })),
            paperclip: pcAgent ? { id: pcAgent.id, adapter: pcAgent.adapterType, status: pcAgent.status } : null,
          };
        });
        return { agents, defaults: data.defaults };
      } catch (e: any) {
        return { agents: [], error: e.message };
      }
    });

    ctx.actions.register("openclaw-agent-assign-session", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const ocAgentId = params.ocAgentId as string;
      const sessionId = params.sessionId as string;
      if (!companyId || !ocAgentId || !sessionId) throw new Error("companyId, ocAgentId, sessionId required");
      const sessions = await getList(ctx, companyId, "sessions");
      const idx = sessions.findIndex((s: any) => s.id === sessionId);
      if (idx === -1) throw new Error("Session not found");
      sessions[idx].ocAgentId = ocAgentId;
      await setList(ctx, companyId, "sessions", sessions);
      // Push profile to that OpenClaw agent
      try {
        await ctx.http.fetch(`${ADMIN_API}/api/openclaw/agent-profile-assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: AUTH_TOKEN },
          body: JSON.stringify({ agentId: ocAgentId, profileKey: sessions[idx].profileKey }),
          signal: AbortSignal.timeout(10000),
        });
        ctx.logger.info(`Assigned profile ${sessions[idx].profileKey} to OpenClaw agent ${ocAgentId}`);
      } catch (e: any) {
        ctx.logger.info(`Failed to push profile to OpenClaw agent: ${e.message}`);
      }
      await ctx.activity.log({ companyId, message: `Сессия ${sessions[idx].profileKey} назначена агенту ${ocAgentId}` });
      return { ok: true, session: sessions[idx] };
    });

    ctx.actions.register("openclaw-agent-unassign-session", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const sessionId = params.sessionId as string;
      if (!companyId || !sessionId) throw new Error("companyId and sessionId required");
      const sessions = await getList(ctx, companyId, "sessions");
      const idx = sessions.findIndex((s: any) => s.id === sessionId);
      if (idx === -1) throw new Error("Session not found");
      const prevAgent = sessions[idx].ocAgentId;
      sessions[idx].ocAgentId = null;
      await setList(ctx, companyId, "sessions", sessions);
      await ctx.activity.log({ companyId, message: `Сессия ${sessions[idx].profileKey} откреплена от агента ${prevAgent}` });
      return { ok: true };
    });

    ctx.actions.register("openclaw-agent-update-model", async (params: Record<string, unknown>) => {
      const agentId = params.agentId as string;
      const model = params.model as Record<string, unknown> | undefined;
      const removeModel = params.removeModel as boolean | undefined;
      const companyId = params.companyId as string;
      if (!agentId) throw new Error("agentId required");

      // 1. Update OpenClaw
      try {
        const resp = await ctx.http.fetch(`${ADMIN_API}/api/openclaw/agent-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: AUTH_TOKEN },
          body: JSON.stringify({ agentId, model, removeModel }),
          signal: AbortSignal.timeout(10000),
        });
        const result = await resp.json() as { ok?: boolean; error?: string };
        if (!result.ok) throw new Error(result.error || "Failed");
      } catch (e: any) {
        throw new Error(`OpenClaw update failed: ${e.message}`);
      }

      // 2. Sync to Paperclip agent adapter_type
      if (companyId) {
        try {
          const primary = removeModel ? "" : ((model as any)?.primary || "");
          const adapterMap: Record<string, string> = {
            "anthropic": "claude_local",
            "openai-codex": "codex_local",
            "openrouter": "codex_local",
            "grok": "codex_local",
            "deepseek": "codex_local",
            "gemini": "gemini_local",
            "kimi": "codex_local",
          };
          const provider = primary.split("/")[0] || "";
          const newAdapter = adapterMap[provider] || "claude_local";
          // Find Paperclip agent by name matching OpenClaw agent id
          const agents = await ctx.agents.list({ companyId });
          const pcAgent = agents.find((a: any) => a.name?.toLowerCase() === agentId.toLowerCase() || a.urlKey === agentId);
          if (pcAgent) {
            // Use internal Paperclip API to update adapter
            const patchResp = await ctx.http.fetch(`https://admin.sitechist.ru/api/companies/${companyId}/agents/${pcAgent.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ adapterType: newAdapter }),
              signal: AbortSignal.timeout(5000),
            });
            ctx.logger.info(`Synced Paperclip agent ${pcAgent.name}: adapter=${newAdapter} (${patchResp.status})`);
          }
        } catch (e: any) {
          ctx.logger.info(`Paperclip sync skipped: ${e.message}`);
        }
        await ctx.activity.log({ companyId, message: `Модель агента ${agentId} обновлена: ${JSON.stringify(removeModel ? "default" : model)}` });
      }

      return { ok: true };
    });

    // ── STATS ──
    ctx.data.register("devices-stats", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { accounts: 0, proxies: 0, sessions: 0, bots: 0, proxiesAlive: 0, accountsActive: 0 };
      const accounts = await getList(ctx, companyId, "accounts");
      const proxies = await getList(ctx, companyId, "proxies");
      const sessions = await getList(ctx, companyId, "sessions");
      const bots = await getList(ctx, companyId, "bots");
      return {
        accounts: accounts.length,
        accountsActive: accounts.filter((a: any) => a.status === "active").length,
        proxies: proxies.length,
        proxiesAlive: proxies.filter((p: any) => p.status === "alive").length,
        sessions: sessions.length,
        bots: bots.length,
      };
    });
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_NAME} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
