import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const PLUGIN_NAME = "sitechist-smm";

// ── Projects list (hardcoded, matches sitechist ecosystem) ──
const PROJECTS = [
  { id: "sitechist", name: "sitechist.ru" },
  { id: "itc34", name: "itc34.ru" },
  { id: "uspeshnyy", name: "uspeshnyy.ru" },
];

// ── Platform definitions ──
const PLATFORMS = ["vk", "instagram", "telegram", "x", "facebook", "youtube", "linkedin", "dzen", "wordpress", "telegraph"] as const;
type Platform = typeof PLATFORMS[number];

// ── Helpers ──
function generateId(): string { return crypto.randomUUID(); }
function generateShortCode(): string { return Math.random().toString(36).slice(2, 8); }

async function getList(ctx: any, companyId: string, key: string): Promise<any[]> {
  const val = await ctx.state.get({ scopeKind: "company", scopeId: companyId, stateKey: key });
  if (!val) return [];
  try { return Array.isArray(val) ? val : JSON.parse(val as string); } catch { return []; }
}

async function setList(ctx: any, companyId: string, key: string, data: any[]): Promise<void> {
  await ctx.state.set({ scopeKind: "company", scopeId: companyId, stateKey: key }, data);
}

async function getProjectList(ctx: any, projectId: string, key: string): Promise<any[]> {
  const val = await ctx.state.get({ scopeKind: "project", scopeId: projectId, stateKey: key });
  if (!val) return [];
  try { return Array.isArray(val) ? val : JSON.parse(val as string); } catch { return []; }
}

async function setProjectList(ctx: any, projectId: string, key: string, data: any[]): Promise<void> {
  await ctx.state.set({ scopeKind: "project", scopeId: projectId, stateKey: key }, data);
}

// ── Platform status check ──
async function checkPlatformStatus(ctx: any, account: any): Promise<{ ok: boolean; detail: string }> {
  const { platform, apiToken, login, password } = account;
  try {
    if (platform === "telegram" && apiToken) {
      const r = await ctx.http.fetch(`https://api.telegram.org/bot${apiToken}/getMe`, { method: "GET", signal: AbortSignal.timeout(5000) });
      const j = await r.json() as any;
      return j.ok ? { ok: true, detail: `@${j.result?.username || "bot"}` } : { ok: false, detail: j.description || "error" };
    }
    if (platform === "vk" && apiToken) {
      const r = await ctx.http.fetch(`https://api.vk.com/method/users.get?access_token=${apiToken}&v=5.199`, { method: "GET", signal: AbortSignal.timeout(5000) });
      const j = await r.json() as any;
      if (j.response?.[0]) return { ok: true, detail: `${j.response[0].first_name} ${j.response[0].last_name}` };
      if (j.error?.error_msg) return { ok: false, detail: j.error.error_msg };
      return { ok: false, detail: "invalid token" };
    }
    if (platform === "youtube" && apiToken) {
      const r = await ctx.http.fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=${apiToken}`, { method: "GET", signal: AbortSignal.timeout(5000) });
      const j = await r.json() as any;
      if (j.items?.[0]) return { ok: true, detail: j.items[0].snippet?.title || "channel" };
      return { ok: false, detail: "invalid api key" };
    }
    if (platform === "telegraph" && apiToken) {
      const r = await ctx.http.fetch(`https://api.telegra.ph/getAccountInfo?access_token=${apiToken}&fields=["short_name"]`, { method: "GET", signal: AbortSignal.timeout(5000) });
      const j = await r.json() as any;
      return j.ok ? { ok: true, detail: j.result?.short_name || "account" } : { ok: false, detail: j.error || "error" };
    }
    if (platform === "wordpress" && account.accountUrl && login && password) {
      const base = account.accountUrl.replace(/\/$/, "");
      const creds = btoa(`${login}:${password}`);
      const r = await ctx.http.fetch(`${base}/wp-json/wp/v2/users/me`, {
        method: "GET", headers: { Authorization: `Basic ${creds}` }, signal: AbortSignal.timeout(5000),
      });
      const j = await r.json() as any;
      return j.id ? { ok: true, detail: j.name || login } : { ok: false, detail: "auth failed" };
    }
    if (platform === "x" && apiToken) {
      const token = apiToken.replace(/%2F/gi, "/");
      const r = await ctx.http.fetch("https://api.x.com/2/openapi.json", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000),
      });
      if (r.status === 200) return { ok: true, detail: account.accountName || "token valid" };
      if (r.status === 401) return { ok: false, detail: "invalid token" };
      return { ok: false, detail: `HTTP ${r.status}` };
    }
    if (platform === "linkedin" && account.oauthToken) {
      const r = await ctx.http.fetch("https://api.linkedin.com/v2/userinfo", {
        method: "GET", headers: { Authorization: `Bearer ${account.oauthToken}` }, signal: AbortSignal.timeout(5000),
      });
      const j = await r.json() as any;
      return j.sub ? { ok: true, detail: j.name || "user" } : { ok: false, detail: "invalid token" };
    }
    if (platform === "facebook" && apiToken) {
      const r = await ctx.http.fetch(`https://graph.facebook.com/me?access_token=${apiToken}`, { method: "GET", signal: AbortSignal.timeout(5000) });
      const j = await r.json() as any;
      return j.id ? { ok: true, detail: j.name || "page" } : { ok: false, detail: j.error?.message || "invalid token" };
    }
    // Instagram and Дзен — login/password, no public API check
    if ((platform === "instagram" || platform === "dzen") && login) {
      return { ok: true, detail: `${login} (не проверено)` };
    }
    return { ok: false, detail: "нет данных для проверки" };
  } catch (e: any) {
    return { ok: false, detail: e.message || "fetch error" };
  }
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup`);

    // ── ACCOUNTS ──

    ctx.data.register("smm-accounts", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const projectId = params.projectId as string | undefined;
      if (!companyId) return { accounts: [], projects: PROJECTS };
      const all = await getList(ctx, companyId, "smm-accounts");
      const accounts = projectId ? all.filter((a: any) => a.projectId === projectId) : all;
      return { accounts, projects: PROJECTS };
    });

    ctx.actions.register("smm-account-create", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const account = {
        id: generateId(),
        platform: params.platform as Platform,
        projectId: (params.projectId as string) || PROJECTS[0].id,
        accountName: (params.accountName as string) || "",
        accountUrl: (params.accountUrl as string) || "",
        apiToken: (params.apiToken as string) || "",
        login: (params.login as string) || "",
        password: (params.password as string) || "",
        oauthToken: (params.oauthToken as string) || "",
        proxyId: (params.proxyId as string) || "",
        status: "unknown",
        note: (params.note as string) || "",
        createdAt: new Date().toISOString(),
        lastCheckedAt: null as string | null,
        lastPostAt: null as string | null,
      };
      const accounts = await getList(ctx, companyId, "smm-accounts");
      accounts.push(account);
      await setList(ctx, companyId, "smm-accounts", accounts);
      await ctx.activity.log({ companyId, message: `SMM: добавлен аккаунт ${account.platform} для ${account.projectId}` });
      return { ok: true, id: account.id };
    });

    ctx.actions.register("smm-account-update", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const accounts = await getList(ctx, companyId, "smm-accounts");
      const idx = accounts.findIndex((a: any) => a.id === id);
      if (idx === -1) return { ok: false, error: "not found" };
      for (const key of ["platform", "projectId", "accountName", "accountUrl", "apiToken", "login", "password", "oauthToken", "proxyId", "status", "note"]) {
        if (params[key] !== undefined) accounts[idx][key] = params[key];
      }
      await setList(ctx, companyId, "smm-accounts", accounts);
      return { ok: true };
    });

    ctx.actions.register("smm-account-delete", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const accounts = await getList(ctx, companyId, "smm-accounts");
      await setList(ctx, companyId, "smm-accounts", accounts.filter((a: any) => a.id !== id));
      await ctx.activity.log({ companyId, message: `SMM: удалён аккаунт ${id}` });
      return { ok: true };
    });

    ctx.actions.register("smm-account-check", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const accounts = await getList(ctx, companyId, "smm-accounts");
      const idx = accounts.findIndex((a: any) => a.id === id);
      if (idx === -1) return { ok: false, error: "not found" };
      const result = await checkPlatformStatus(ctx, accounts[idx]);
      accounts[idx].status = result.ok ? "active" : "error";
      accounts[idx].lastCheckedAt = new Date().toISOString();
      accounts[idx].statusDetail = result.detail;
      await setList(ctx, companyId, "smm-accounts", accounts);
      return { ok: result.ok, detail: result.detail, status: accounts[idx].status };
    });

    ctx.actions.register("smm-account-check-all", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const accounts = await getList(ctx, companyId, "smm-accounts");
      const results: any[] = [];
      for (const acc of accounts) {
        const result = await checkPlatformStatus(ctx, acc);
        acc.status = result.ok ? "active" : "error";
        acc.lastCheckedAt = new Date().toISOString();
        acc.statusDetail = result.detail;
        results.push({ id: acc.id, platform: acc.platform, ok: result.ok, detail: result.detail });
      }
      await setList(ctx, companyId, "smm-accounts", accounts);
      return { ok: true, results };
    });

    // ── CONTENT PLAN ──

    ctx.data.register("smm-content-plan", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      if (!projectId) return { posts: [] };
      return { posts: await getProjectList(ctx, projectId, "smm-content-plan") };
    });

    ctx.actions.register("smm-post-draft-create", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const projectId = params.projectId as string;
      const post = {
        id: generateId(),
        projectId,
        text: (params.text as string) || "",
        platforms: (params.platforms as string[]) || [],
        hashtags: (params.hashtags as string) || "",
        scheduleAt: (params.scheduleAt as string) || null,
        utmUrl: (params.utmUrl as string) || "",
        status: "draft",
        createdAt: new Date().toISOString(),
        note: (params.note as string) || "",
      };
      const posts = await getProjectList(ctx, projectId, "smm-content-plan");
      posts.push(post);
      await setProjectList(ctx, projectId, "smm-content-plan", posts);
      await ctx.activity.log({ companyId, message: `SMM: черновик поста создан для ${projectId}` });
      return { ok: true, id: post.id };
    });

    ctx.actions.register("smm-post-draft-update", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      const id = params.id as string;
      const posts = await getProjectList(ctx, projectId, "smm-content-plan");
      const idx = posts.findIndex((p: any) => p.id === id);
      if (idx === -1) return { ok: false, error: "not found" };
      for (const key of ["text", "platforms", "hashtags", "scheduleAt", "utmUrl", "status", "note"]) {
        if (params[key] !== undefined) posts[idx][key] = params[key];
      }
      posts[idx].updatedAt = new Date().toISOString();
      await setProjectList(ctx, projectId, "smm-content-plan", posts);
      return { ok: true };
    });

    ctx.actions.register("smm-post-delete", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      const id = params.id as string;
      const posts = await getProjectList(ctx, projectId, "smm-content-plan");
      await setProjectList(ctx, projectId, "smm-content-plan", posts.filter((p: any) => p.id !== id));
      return { ok: true };
    });

    // ── UTM LINKS ──

    ctx.data.register("smm-utm-links", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { links: [] };
      return { links: await getList(ctx, companyId, "smm-utm-links") };
    });

    ctx.actions.register("smm-utm-generate", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const { projectId, url, platform, campaign, content } = params as Record<string, string>;
      if (!url || !platform) return { ok: false, error: "url and platform required" };

      const proj = PROJECTS.find(p => p.id === projectId) || PROJECTS[0];
      const utm = new URL(url);
      utm.searchParams.set("utm_source", platform);
      utm.searchParams.set("utm_medium", "social");
      utm.searchParams.set("utm_campaign", campaign || proj.id);
      if (content) utm.searchParams.set("utm_content", content);

      const shortCode = generateShortCode();
      const shortUrl = `https://go.sitechist.ru/${shortCode}`;
      const fullUrl = utm.toString();

      const link = {
        id: generateId(),
        shortCode,
        shortUrl,
        fullUrl,
        originalUrl: url,
        platform,
        projectId: proj.id,
        campaign: campaign || proj.id,
        createdAt: new Date().toISOString(),
        clicks: 0,
      };
      const links = await getList(ctx, companyId, "smm-utm-links");
      links.push(link);
      await setList(ctx, companyId, "smm-utm-links", links);
      return { ok: true, shortUrl, fullUrl };
    });

    // ── HASHTAGS ──

    ctx.data.register("smm-hashtags", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      if (!projectId) return { sets: [] };
      return { sets: await getProjectList(ctx, projectId, "smm-hashtags") };
    });

    ctx.actions.register("smm-hashtag-set-save", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      const companyId = params.companyId as string;
      const { id, name, tags, category } = params as Record<string, string>;
      const sets = await getProjectList(ctx, projectId, "smm-hashtags");

      if (id) {
        const idx = sets.findIndex((s: any) => s.id === id);
        if (idx !== -1) {
          sets[idx] = { ...sets[idx], name: name || sets[idx].name, tags: tags || sets[idx].tags, category: category || sets[idx].category };
          await setProjectList(ctx, projectId, "smm-hashtags", sets);
          return { ok: true };
        }
      }

      const set = {
        id: generateId(),
        name: name || "Новый набор",
        tags: tags || "",
        category: category || "general",
        projectId,
        createdAt: new Date().toISOString(),
      };
      sets.push(set);
      await setProjectList(ctx, projectId, "smm-hashtags", sets);
      await ctx.activity.log({ companyId, message: `SMM: сохранён набор хэштегов "${set.name}" для ${projectId}` });
      return { ok: true, id: set.id };
    });

    ctx.actions.register("smm-hashtag-set-delete", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      const id = params.id as string;
      const sets = await getProjectList(ctx, projectId, "smm-hashtags");
      await setProjectList(ctx, projectId, "smm-hashtags", sets.filter((s: any) => s.id !== id));
      return { ok: true };
    });

    // ── SETTINGS / GUIDELINES ──

    ctx.data.register("smm-settings", async (_params: Record<string, unknown>) => {
      const projectIds = ["sitechist", "itc34", "uspeshnyy"];
      const allSettings: Record<string, any> = {};
      for (const pid of projectIds) {
        const guidelines = await ctx.state.get({ scopeKind: "project", scopeId: pid, stateKey: "smm-guidelines" });
        const schedule = await ctx.state.get({ scopeKind: "project", scopeId: pid, stateKey: "smm-schedule" });
        const branding = await ctx.state.get({ scopeKind: "project", scopeId: pid, stateKey: "smm-branding" });
        allSettings[pid] = { guidelines: guidelines || null, schedule: schedule || null, branding: branding || null };
      }
      return { projects: allSettings };
    });

    ctx.actions.register("smm-settings-save", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      const companyId = params.companyId as string;
      if (params.guidelines !== undefined) {
        await ctx.state.set({ scopeKind: "project", scopeId: projectId, stateKey: "smm-guidelines" }, params.guidelines);
      }
      if (params.schedule !== undefined) {
        await ctx.state.set({ scopeKind: "project", scopeId: projectId, stateKey: "smm-schedule" }, params.schedule);
      }
      if (params.branding !== undefined) {
        await ctx.state.set({ scopeKind: "project", scopeId: projectId, stateKey: "smm-branding" }, params.branding);
      }
      await ctx.activity.log({ companyId, message: `SMM: настройки обновлены для ${projectId}` });
      return { ok: true };
    });

    // ── AGENT TOOLS ──

    ctx.tools.register("list-social-accounts", {
      name: "list-social-accounts", displayName: "Список соцсетей",
      description: "Список подключённых соцсетей по проекту",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "ID проекта: sitechist, itc34, uspeshnyy" },
        },
      },
    }, async (params: Record<string, unknown>, runCtx: any) => {
      const companyId = runCtx.companyId as string;
      const projectId = params.projectId as string | undefined;
      const all = await getList(ctx, companyId, "smm-accounts");
      const accounts = projectId ? all.filter((a: any) => a.projectId === projectId) : all;
      const rows = accounts.map((a: any) =>
        `${a.platform.padEnd(12)} | ${(a.accountName || a.login || "—").padEnd(25)} | ${a.status.padEnd(8)} | ${a.projectId}`
      );
      if (!rows.length) return { content: `Аккаунты не найдены${projectId ? ` для проекта ${projectId}` : ""}.` };
      return { content: `Соцсети${projectId ? ` (${projectId})` : ""}:\n\nПлатформа    | Аккаунт                   | Статус   | Проект\n${"-".repeat(70)}\n${rows.join("\n")}` };
    });

    ctx.tools.register("check-social-status", {
      name: "check-social-status", displayName: "Проверить статус соцсетей",
      description: "Проверить статус подключения аккаунтов соцсетей",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "ID проекта (опционально)" },
        },
      },
    }, async (params: Record<string, unknown>, runCtx: any) => {
      const companyId = runCtx.companyId as string;
      const projectId = params.projectId as string | undefined;
      const all = await getList(ctx, companyId, "smm-accounts");
      const accounts = projectId ? all.filter((a: any) => a.projectId === projectId) : all;
      if (!accounts.length) return { content: "Аккаунты не найдены." };
      const results: string[] = [];
      for (const acc of accounts) {
        const r = await checkPlatformStatus(ctx, acc);
        results.push(`${acc.platform.padEnd(12)} ${acc.projectId.padEnd(12)} — ${r.ok ? "✓" : "✗"} ${r.detail}`);
      }
      return { content: `Проверка статусов:\n\n${results.join("\n")}` };
    });

    ctx.tools.register("create-post-draft", {
      name: "create-post-draft", displayName: "Создать черновик поста",
      description: "Создать черновик поста для публикации в соцсетях",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "ID проекта" },
          text: { type: "string", description: "Текст поста" },
          platforms: { type: "array", items: { type: "string" }, description: "Платформы: vk, telegram, instagram, x, facebook, youtube, linkedin, dzen, wordpress, telegraph" },
          hashtags: { type: "string", description: "Хэштеги через пробел" },
          scheduleAt: { type: "string", description: "ISO дата публикации" },
          utmUrl: { type: "string", description: "URL для UTM-ссылки" },
        },
        required: ["projectId", "text", "platforms"],
      },
    }, async (params: Record<string, unknown>, runCtx: any) => {
      const companyId = runCtx.companyId as string;
      const projectId = params.projectId as string;
      const platforms = (params.platforms as string[]) || [];
      const post = {
        id: generateId(), projectId, text: params.text as string, platforms,
        hashtags: (params.hashtags as string) || "", scheduleAt: (params.scheduleAt as string) || null,
        utmUrl: (params.utmUrl as string) || "", status: "draft",
        createdAt: new Date().toISOString(), note: "создан агентом",
      };
      const posts = await getProjectList(ctx, projectId, "smm-content-plan");
      posts.push(post);
      await setProjectList(ctx, projectId, "smm-content-plan", posts);
      await ctx.activity.log({ companyId, message: `SMM: агент создал черновик для ${projectId} (${platforms.join(", ")})` });
      return { content: `Черновик создан (ID: ${post.id})\nПроект: ${projectId}\nПлатформы: ${platforms.join(", ")}\n${params.scheduleAt ? `Запланирован: ${params.scheduleAt}` : "Без расписания"}` };
    });

    ctx.tools.register("generate-utm-link", {
      name: "generate-utm-link", displayName: "UTM-ссылка",
      description: "Сгенерировать UTM-ссылку с коротким URL для публикации в соцсетях",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "ID проекта" },
          url: { type: "string", description: "Исходный URL" },
          platform: { type: "string", description: "Платформа: vk, telegram, instagram, x и т.д." },
          campaign: { type: "string", description: "UTM campaign (опционально)" },
          content: { type: "string", description: "UTM content (опционально)" },
        },
        required: ["projectId", "url", "platform"],
      },
    }, async (params: Record<string, unknown>, runCtx: any) => {
      const companyId = runCtx.companyId as string;
      const { projectId, url, platform, campaign, content } = params as Record<string, string>;
      const proj = PROJECTS.find(p => p.id === projectId) || PROJECTS[0];
      let utm: URL;
      try { utm = new URL(url); } catch { return { content: `Ошибка: невалидный URL: ${url}` }; }
      utm.searchParams.set("utm_source", platform);
      utm.searchParams.set("utm_medium", "social");
      utm.searchParams.set("utm_campaign", campaign || proj.id);
      if (content) utm.searchParams.set("utm_content", content);
      const shortCode = generateShortCode();
      const shortUrl = `https://go.sitechist.ru/${shortCode}`;
      const fullUrl = utm.toString();
      const links = await getList(ctx, companyId, "smm-utm-links");
      links.push({ id: generateId(), shortCode, shortUrl, fullUrl, originalUrl: url, platform, projectId: proj.id, campaign: campaign || proj.id, createdAt: new Date().toISOString(), clicks: 0 });
      await setList(ctx, companyId, "smm-utm-links", links);
      return { content: `UTM-ссылка готова:\n\nКороткая: ${shortUrl}\nПолная: ${fullUrl}` };
    });

    ctx.tools.register("list-content-plan", {
      name: "list-content-plan", displayName: "Контент-план",
      description: "Показать контент-план для проекта",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "ID проекта" },
          status: { type: "string", description: "Фильтр статуса: draft, scheduled, published" },
        },
        required: ["projectId"],
      },
    }, async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      let posts = await getProjectList(ctx, projectId, "smm-content-plan");
      if (params.status) posts = posts.filter((p: any) => p.status === params.status);
      if (!posts.length) return { content: `Контент-план для ${projectId} пуст.` };
      const rows = posts.map((p: any) =>
        `[${p.status.padEnd(10)}] ${(p.scheduleAt || "без даты").slice(0, 16).padEnd(16)} | ${p.platforms.join(",")} | ${p.text.slice(0, 60)}...`
      );
      return { content: `Контент-план (${projectId}):\n\n${rows.join("\n")}` };
    });

    ctx.tools.register("list-hashtag-sets", {
      name: "list-hashtag-sets", displayName: "Хэштеги",
      description: "Показать наборы хэштегов для проекта",
      parametersSchema: {
        type: "object",
        properties: { projectId: { type: "string", description: "ID проекта" } },
        required: ["projectId"],
      },
    }, async (params: Record<string, unknown>) => {
      const sets = await getProjectList(ctx, params.projectId as string, "smm-hashtags");
      if (!sets.length) return { content: `Наборы хэштегов для ${params.projectId} не найдены.` };
      return { content: sets.map((s: any) => `[${s.category}] ${s.name}:\n${s.tags}`).join("\n\n") };
    });

    ctx.tools.register("get-post-guidelines", {
      name: "get-post-guidelines", displayName: "Гайдлайны постов",
      description: "Получить инструкции по оформлению постов (тон, запрещённые слова, CTA, правила платформ)",
      parametersSchema: {
        type: "object",
        properties: { projectId: { type: "string", description: "ID проекта" } },
        required: ["projectId"],
      },
    }, async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      const guidelines = await ctx.state.get({ scopeKind: "project", scopeId: projectId, stateKey: "smm-guidelines" });
      if (!guidelines) return { content: `Инструкции для ${projectId} не настроены.` };
      const g = guidelines as any;
      const parts: string[] = [`Гайдлайны для ${projectId}:`, `Тон: ${g.tone || "—"}`, `Brand voice: ${g.brandVoice || "—"}`];
      if (g.forbiddenWords?.length) parts.push(`Запрещённые слова: ${g.forbiddenWords.join(", ")}`);
      if (g.signatureTemplate) parts.push(`Подпись: ${g.signatureTemplate}`);
      if (g.ctaTemplates?.length) parts.push(`CTA:\n${g.ctaTemplates.map((c: any) => `  - ${c.name}: ${c.text}`).join("\n")}`);
      if (g.platformRules) {
        parts.push("Правила платформ:");
        for (const [pl, r] of Object.entries(g.platformRules as Record<string, any>)) {
          parts.push(`  ${pl}: maxLength=${r.maxLength}, hashtags=${r.hashtagCount}`);
        }
      }
      return { content: parts.join("\n") };
    });

    // ── GENERATE IMAGE (Imagen 4 via Gemini API) ──
    const GEMINI_API_KEY = "AIzaSyA50jtr_PYCFt0tGiO6IWjR8bVjXpVsFnI";

    ctx.actions.register("smm-generate-image", async (params: Record<string, unknown>) => {
      const prompt = params.prompt as string;
      const aspectRatio = (params.aspectRatio as string) || "1:1";
      if (!prompt) throw new Error("prompt required");

      const resp = await ctx.http.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-4:predictImage?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );
      const data = await resp.json() as any;
      if (data.predictions?.[0]?.bytesBase64Encoded) {
        const b64 = data.predictions[0].bytesBase64Encoded;
        return { ok: true, base64: b64, mimeType: data.predictions[0].mimeType || "image/png" };
      }
      // Try alternative Gemini API format
      if (data.error) throw new Error(data.error.message || "Imagen API error");
      throw new Error("No image generated");
    });

    ctx.tools.register("generate-image",
      { name: "generate-image", displayName: "Сгенерировать картинку", description: "Imagen 4 — генерация картинки по описанию", parametersSchema: { type: "object", properties: { prompt: { type: "string", description: "Описание на английском" }, aspectRatio: { type: "string", description: "1:1, 16:9, 9:16" } }, required: ["prompt"] } },
      async (params: any) => {
        try {
          const result = await ctx.http.fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-4:predictImage?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ instances: [{ prompt: params.prompt }], parameters: { sampleCount: 1, aspectRatio: params.aspectRatio || "1:1" } }),
              signal: AbortSignal.timeout(30000),
            }
          );
          const data = await result.json() as any;
          if (data.predictions?.[0]?.bytesBase64Encoded) {
            return { content: `Image generated (${data.predictions[0].mimeType || "image/png"}, ${Math.round(data.predictions[0].bytesBase64Encoded.length / 1024)}KB base64). Use this in posts with image upload.` };
          }
          return { content: `Error: ${data.error?.message || "no image generated"}` };
        } catch (e: any) {
          return { content: `Error: ${e.message}` };
        }
      }
    );

    // ── GENERATE COVER (OpenAI gpt-image-1 bg + admin-api ImageMagick overlay) ──
    ctx.actions.register("smm-generate-cover", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      const title = params.title as string;
      const prompt = params.prompt as string;
      if (!title || !prompt) throw new Error("title and prompt required");

      const branding = (await ctx.state.get({ scopeKind: "project", scopeId: projectId, stateKey: "smm-branding" })) as any || {};
      const apiKey = branding.openaiApiKey;
      if (!apiKey) throw new Error("OpenAI API key не настроен в Брендинг настройках проекта");

      // 1. Generate background with GPT Image 1
      const genResp = await ctx.http.fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size: "1536x1024" }),
        signal: AbortSignal.timeout(60000),
      });
      const genData = await genResp.json() as any;
      if (!genData.data?.[0]?.b64_json) throw new Error(genData.error?.message || "Image generation failed");
      const bgBase64 = genData.data[0].b64_json;

      // 2. Send to admin-api for ImageMagick overlay + GCS upload
      const overlayResp = await ctx.http.fetch(`${ADMIN_API_SMM}/api/cover/overlay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH_TOKEN_SMM },
        body: JSON.stringify({
          imageBase64: bgBase64,
          title,
          projectId,
          branding: {
            logoDark: branding.logoDark || "",
            logoPosition: branding.logoPosition || "top-left",
            logoSize: branding.logoSize || "60",
            titlePosition: branding.titlePosition || "bottom-left",
            titleSize: branding.titleSize || "48",
            titleColor: branding.titleColor || "#FFFFFF",
            titleShadow: branding.titleShadow ?? true,
            linkText: branding.linkText || "",
            linkPosition: branding.linkPosition || "bottom-right",
            linkColor: branding.linkColor || "#93c5fd",
          },
        }),
        signal: AbortSignal.timeout(30000),
      });
      const overlayData = await overlayResp.json() as any;
      if (!overlayData.ok) throw new Error(overlayData.error || "Overlay failed");

      return { ok: true, url: overlayData.url, base64: overlayData.base64 };
    });

    ctx.tools.register("generate-cover",
      {
        name: "generate-cover", displayName: "Сгенерировать обложку",
        description: "Генерация обложки для поста: GPT Image 1 создаёт фон по описанию, затем ImageMagick накладывает заголовок, логотип и ссылку по branding настройкам проекта. Возвращает URL обложки в GCS.",
        parametersSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "ID проекта: sitechist, itc34, uspeshnyy" },
            title: { type: "string", description: "Заголовок на обложке (1-2 строки)" },
            prompt: { type: "string", description: "Описание фона на английском для GPT Image 1 (без текста, только визуал)" },
          },
          required: ["projectId", "title", "prompt"],
        },
      },
      async (params: any) => {
        try {
          const projectId = params.projectId as string;
          const title = params.title as string;
          const prompt = params.prompt as string;
          if (!title || !prompt) return { content: "Error: title и prompt обязательны" };

          const branding = (await ctx.state.get({ scopeKind: "project", scopeId: projectId, stateKey: "smm-branding" })) as any || {};
          const apiKey = branding.openaiApiKey;
          if (!apiKey) return { content: "Error: OpenAI API key не настроен. Зайди в SMM → Брендинг → API ключ и укажи ключ OpenAI." };

          // Generate background
          const genResp = await ctx.http.fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size: "1536x1024" }),
            signal: AbortSignal.timeout(60000),
          });
          const genData = await genResp.json() as any;
          if (!genData.data?.[0]?.b64_json) return { content: `Error: ${genData.error?.message || "no image generated"}` };

          // Overlay + upload
          const overlayResp = await ctx.http.fetch(`${ADMIN_API_SMM}/api/cover/overlay`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: AUTH_TOKEN_SMM },
            body: JSON.stringify({
              imageBase64: genData.data[0].b64_json,
              title,
              projectId,
              branding: {
                logoDark: branding.logoDark || "",
                logoPosition: branding.logoPosition || "top-left",
                logoSize: branding.logoSize || "60",
                titlePosition: branding.titlePosition || "bottom-left",
                titleSize: branding.titleSize || "48",
                titleColor: branding.titleColor || "#FFFFFF",
                titleShadow: branding.titleShadow ?? true,
                linkText: branding.linkText || "",
                linkPosition: branding.linkPosition || "bottom-right",
                linkColor: branding.linkColor || "#93c5fd",
              },
            }),
            signal: AbortSignal.timeout(30000),
          });
          const overlayData = await overlayResp.json() as any;
          if (!overlayData.ok) return { content: `Error overlay: ${overlayData.error || "failed"}` };

          return { content: `Обложка готова!\nURL: ${overlayData.url}\nИспользуй этот URL или base64 в publish-post с параметром imageUrl.` };
        } catch (e: any) {
          return { content: `Error: ${e.message}` };
        }
      }
    );

    // ── GENERATE REPORT (HTML → GCS → Telegram mini-app) ──
    const ADMIN_API_SMM = "https://studio.sitechist.ru/admin-api";
    const AUTH_TOKEN_SMM = "Bearer 263c0b87ce496540a6c611bd425e8841";

    function buildReportHtml(title: string, sections: { heading: string; content: string }[], projectId: string): string {
      const date = new Date().toLocaleDateString("ru-RU");
      const sectionsHtml = sections.map(s => `
        <div class="card">
          <h2>${s.heading}</h2>
          <div class="content">${s.content.replace(/\n/g, "<br>")}</div>
        </div>`).join("");

      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0f172a;--card:#1e293b;--text:#e2e8f0;--accent:#38bdf8;--border:#334155}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);padding:0;margin:0}
.wrap{max-width:600px;margin:0 auto;padding:16px}
.header{text-align:center;padding:24px 0;border-bottom:2px solid var(--accent)}
.header h1{font-size:1.3rem;font-weight:700;margin-bottom:4px}
.header .meta{font-size:0.8rem;color:#94a3b8}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin:16px 0}
.card h2{font-size:1rem;font-weight:600;color:var(--accent);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.card .content{font-size:0.9rem;line-height:1.6;color:#cbd5e1}
.card .content strong{color:var(--text)}
.card .content ul{padding-left:20px;margin:8px 0}
.card .content li{margin:4px 0}
.footer{text-align:center;padding:24px 0;font-size:0.75rem;color:#64748b}
.cta{display:block;background:var(--accent);color:#0f172a;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:0.95rem;text-decoration:none;margin:16px 0}
img.screenshot{width:100%;border-radius:8px;margin:12px 0}
@media(prefers-color-scheme:light){:root{--bg:#f8fafc;--card:#fff;--text:#1e293b;--border:#e2e8f0}}
</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>${title}</h1>
    <div class="meta">${projectId || "Sitechist"} · ${date}</div>
  </div>
  ${sectionsHtml}
  <div class="footer">Сгенерировано AI-агентом · ${date}</div>
</div>
<script>var t=window.Telegram&&Telegram.WebApp;if(t){t.expand();t.disableVerticalSwipes&&t.disableVerticalSwipes()}</script>
</body></html>`;
    }

    ctx.actions.register("smm-generate-report", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const title = params.title as string;
      const sections = params.sections as { heading: string; content: string }[];
      const projectId = (params.projectId as string) || "";
      const sendTelegram = params.sendTelegram !== false;
      if (!title || !sections?.length) throw new Error("title and sections required");

      const html = buildReportHtml(title, sections, projectId);
      const filename = `report-${Date.now()}.html`;

      // Upload to GCS via admin-api
      const uploadResp = await ctx.http.fetch(`${ADMIN_API_SMM}/api/publish-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH_TOKEN_SMM },
        body: JSON.stringify({ html, filename, prefix: `smm/reports/${projectId || "general"}` }),
        signal: AbortSignal.timeout(15000),
      });
      const uploadResult = await uploadResp.json() as { ok?: boolean; url?: string; error?: string };
      if (!uploadResult.ok || !uploadResult.url) throw new Error(uploadResult.error || "GCS upload failed");

      const reportUrl = uploadResult.url;

      // Send to Telegram if accounts exist
      let telegramResult = "";
      if (sendTelegram) {
        const accounts = await getList(ctx, companyId, "smm-accounts");
        const tgAccounts = accounts.filter((a: any) => a.platform === "telegram" && a.apiToken);
        for (const tg of tgAccounts) {
          if (projectId && tg.projectId !== projectId) continue;
          const chatId = tg.accountUrl?.replace("https://t.me/", "@") || "";
          if (!chatId) continue;
          try {
            const msgResp = await ctx.http.fetch(`https://api.telegram.org/bot${tg.apiToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `📋 *${title}*\n\nНовый отчёт готов. Откройте для просмотра:`,
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "📖 Открыть отчёт", web_app: { url: reportUrl } }]] },
              }),
              signal: AbortSignal.timeout(10000),
            });
            const msgJ = await msgResp.json() as any;
            telegramResult += msgJ.ok ? `✅ ${chatId} ` : `❌ ${chatId}: ${msgJ.description} `;
          } catch (e: any) { telegramResult += `❌ ${chatId}: ${e.message} `; }
        }
      }

      await ctx.activity.log({ companyId, message: `SMM: отчёт "${title}" → ${reportUrl}` });
      return { ok: true, url: reportUrl, telegram: telegramResult || "not sent" };
    });

    ctx.tools.register("generate-report",
      { name: "generate-report", displayName: "HTML-отчёт", description: "Создать HTML-отчёт, залить в GCS, отправить в Telegram mini-app", parametersSchema: { type: "object", properties: { title: { type: "string" }, sections: { type: "array", items: { type: "object" } }, projectId: { type: "string" }, sendTelegram: { type: "boolean" } }, required: ["title", "sections"] } },
      async (params: any) => {
        const companyId = "cc5dce5f-2073-40c2-b436-5f9026fe45c5";
        try {
          const result = await (async () => {
            const title = params.title as string;
            const sections = params.sections as { heading: string; content: string }[];
            const projectId = (params.projectId as string) || "";
            const sendTelegram = params.sendTelegram !== false;
            if (!title || !sections?.length) return { ok: false, error: "title and sections required" };

            const html = buildReportHtml(title, sections, projectId);
            const filename = `report-${Date.now()}.html`;
            const uploadResp = await ctx.http.fetch(`${ADMIN_API_SMM}/api/publish-html`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: AUTH_TOKEN_SMM },
              body: JSON.stringify({ html, filename, prefix: `smm/reports/${projectId || "general"}` }),
              signal: AbortSignal.timeout(15000),
            });
            const uploadResult = await uploadResp.json() as { ok?: boolean; url?: string; error?: string };
            if (!uploadResult.ok) return { ok: false, error: uploadResult.error };

            let tgMsg = "";
            if (sendTelegram) {
              const accounts = await getList(ctx, companyId, "smm-accounts");
              const tgAccs = accounts.filter((a: any) => a.platform === "telegram" && a.apiToken);
              for (const tg of tgAccs) {
                if (projectId && tg.projectId !== projectId) continue;
                const chatId = tg.accountUrl?.replace("https://t.me/", "@") || "";
                if (!chatId) continue;
                try {
                  await ctx.http.fetch(`https://api.telegram.org/bot${tg.apiToken}/sendMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: `📋 *${title}*\n\nОтчёт готов:`, parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "📖 Открыть отчёт", web_app: { url: uploadResult.url } }]] } }),
                    signal: AbortSignal.timeout(10000),
                  });
                  tgMsg += `sent to ${chatId} `;
                } catch (e: any) { tgMsg += `failed ${chatId}: ${e.message} `; }
              }
            }
            return { ok: true, url: uploadResult.url, telegram: tgMsg };
          })();
          return { content: `Report: ${(result as any).url || (result as any).error}\nTelegram: ${(result as any).telegram || "—"}` };
        } catch (e: any) { return { content: `Error: ${e.message}` }; }
      }
    );

    // ── Helpers: VK owner_id resolution ──
    async function resolveVkOwnerId(httpCtx: any, accountUrl: string, apiToken: string): Promise<string> {
      const idMatch = accountUrl?.match(/id(\d+)/);
      if (idMatch) return idMatch[1];
      if (!accountUrl) return "";
      const screenName = accountUrl.replace(/^https?:\/\/(www\.)?vk\.com\//, "").replace(/\/$/, "");
      if (!screenName) return "";
      try {
        const r = await httpCtx.fetch(`https://api.vk.com/method/utils.resolveScreenName?screen_name=${screenName}&v=5.199&access_token=${apiToken}`, { signal: AbortSignal.timeout(5000) });
        const rj = await r.json() as any;
        if (rj.response?.type === "group") return `-${rj.response.object_id}`;
        if (rj.response?.type === "user") return `${rj.response.object_id}`;
      } catch {}
      return "";
    }

    // ── Helper: VK photo upload (multipart → getWallUploadServer → upload → save) ──
    async function vkUploadPhoto(httpCtx: any, ownerId: string, apiToken: string, imageBase64: string): Promise<string> {
      // Step 1: Get upload server
      const groupId = ownerId.startsWith("-") ? ownerId.slice(1) : "";
      const uploadParams = groupId
        ? `group_id=${groupId}&v=5.199&access_token=${apiToken}`
        : `v=5.199&access_token=${apiToken}`;
      const serverResp = await httpCtx.fetch(`https://api.vk.com/method/photos.getWallUploadServer?${uploadParams}`, { signal: AbortSignal.timeout(10000) });
      const serverData = await serverResp.json() as any;
      if (!serverData.response?.upload_url) throw new Error(serverData.error?.error_msg || "getWallUploadServer failed");

      // Step 2: Upload photo via multipart
      const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      const fd = new FormData();
      fd.append("photo", new Blob([imageBytes], { type: "image/png" }), "cover.png");
      const uploadResp = await httpCtx.fetch(serverData.response.upload_url, { method: "POST", body: fd, signal: AbortSignal.timeout(30000) });
      const uploadData = await uploadResp.json() as any;
      if (!uploadData.photo || uploadData.photo === "[]") throw new Error("VK photo upload returned empty");

      // Step 3: Save photo
      const saveParams = `server=${uploadData.server}&photo=${encodeURIComponent(uploadData.photo)}&hash=${uploadData.hash}${groupId ? `&group_id=${groupId}` : ""}&v=5.199&access_token=${apiToken}`;
      const saveResp = await httpCtx.fetch("https://api.vk.com/method/photos.saveWallPhoto", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: saveParams, signal: AbortSignal.timeout(10000),
      });
      const saveData = await saveResp.json() as any;
      if (!saveData.response?.[0]) throw new Error(saveData.error?.error_msg || "saveWallPhoto failed");
      const photo = saveData.response[0];
      return `photo${photo.owner_id}_${photo.id}`;
    }

    // ── PUBLISH POST (real API calls, supports imageBase64, CTA, VK repost) ──
    interface PublishOptions {
      imageBase64?: string;
      imageUrl?: string;
      subscribeCta?: Record<string, string>; // platform → CTA text
      vkRepostUrl?: string; // personal VK page URL for auto-repost
    }

    async function publishToAccounts(
      httpCtx: any, accounts: any[], text: string, platforms: string[], opts: PublishOptions = {}
    ): Promise<{ platform: string; ok: boolean; detail: string }[]> {
      const results: { platform: string; ok: boolean; detail: string }[] = [];
      const { imageBase64, imageUrl, subscribeCta, vkRepostUrl } = opts;

      for (const platform of platforms) {
        const accs = accounts.filter((a: any) => a.platform === platform && a.status !== "error");
        if (accs.length === 0) { results.push({ platform, ok: false, detail: "нет активного аккаунта" }); continue; }

        // Append platform-specific CTA
        const cta = subscribeCta?.[platform] || "";
        const fullText = cta ? `${text}\n\n${cta}` : text;

        for (const acc of accs) {
          try {
            if (platform === "vk" && acc.apiToken) {
              const ownerId = await resolveVkOwnerId(httpCtx, acc.accountUrl, acc.apiToken);
              let attachment = "";
              if (imageBase64) {
                try { attachment = await vkUploadPhoto(httpCtx, ownerId, acc.apiToken, imageBase64); } catch (e: any) {
                  results.push({ platform: `vk (${acc.accountName})`, ok: false, detail: `photo upload: ${e.message}` }); continue;
                }
              }
              let body = `message=${encodeURIComponent(fullText)}&v=5.199&access_token=${acc.apiToken}`;
              if (ownerId) body = `owner_id=${ownerId}&${body}`;
              if (attachment) body += `&attachments=${attachment}`;
              const resp = await httpCtx.fetch("https://api.vk.com/method/wall.post", {
                method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(10000),
              });
              const j = await resp.json() as any;
              if (j.response?.post_id) {
                results.push({ platform: `vk (${acc.accountName})`, ok: true, detail: `post_id: ${j.response.post_id}` });

                // Auto-repost to personal feed
                if (vkRepostUrl && ownerId) {
                  try {
                    const repostObject = `wall${ownerId}_${j.response.post_id}`;
                    const repostResp = await httpCtx.fetch("https://api.vk.com/method/wall.repost", {
                      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
                      body: `object=${repostObject}&v=5.199&access_token=${acc.apiToken}`,
                      signal: AbortSignal.timeout(10000),
                    });
                    const rj = await repostResp.json() as any;
                    if (rj.response?.post_id) results.push({ platform: `vk repost (личная)`, ok: true, detail: `repost_id: ${rj.response.post_id}` });
                    else results.push({ platform: `vk repost (личная)`, ok: false, detail: rj.error?.error_msg || "repost failed" });
                  } catch (e: any) {
                    results.push({ platform: `vk repost (личная)`, ok: false, detail: e.message });
                  }
                }
              } else {
                results.push({ platform: `vk (${acc.accountName})`, ok: false, detail: j.error?.error_msg || "failed" });
              }

            } else if (platform === "telegram" && acc.apiToken) {
              const chatId = acc.accountUrl?.replace("https://t.me/", "@") || "";
              if (!chatId) { results.push({ platform: "telegram", ok: false, detail: "no channel URL" }); continue; }

              if (imageBase64) {
                const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
                const fd = new FormData();
                fd.append("chat_id", chatId);
                fd.append("caption", fullText);
                fd.append("parse_mode", "Markdown");
                fd.append("photo", new Blob([imageBytes], { type: "image/png" }), "cover.png");
                const resp = await httpCtx.fetch(`https://api.telegram.org/bot${acc.apiToken}/sendPhoto`, {
                  method: "POST", body: fd, signal: AbortSignal.timeout(30000),
                });
                const j = await resp.json() as any;
                if (j.ok) results.push({ platform: `telegram (${acc.accountName})`, ok: true, detail: `msg_id: ${j.result?.message_id}` });
                else results.push({ platform: `telegram (${acc.accountName})`, ok: false, detail: j.description || "failed" });
              } else {
                const resp = await httpCtx.fetch(`https://api.telegram.org/bot${acc.apiToken}/sendMessage`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: chatId, text: fullText, parse_mode: "Markdown" }), signal: AbortSignal.timeout(10000),
                });
                const j = await resp.json() as any;
                if (j.ok) results.push({ platform: `telegram (${acc.accountName})`, ok: true, detail: `msg_id: ${j.result?.message_id}` });
                else results.push({ platform: `telegram (${acc.accountName})`, ok: false, detail: j.description || "failed" });
              }

            } else if (platform === "telegraph" && acc.apiToken) {
              const content: any[] = [];
              if (imageUrl) {
                content.push({ tag: "figure", children: [{ tag: "img", attrs: { src: imageUrl } }] });
              }
              // Split text into paragraphs
              const paragraphs = fullText.split("\n\n").filter(Boolean);
              for (const p of paragraphs) {
                content.push({ tag: "p", children: [p.replace(/\n/g, " ")] });
              }
              const resp = await httpCtx.fetch("https://api.telegra.ph/createPage", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  access_token: acc.apiToken,
                  title: text.split("\n")[0]?.slice(0, 80) || "Пост",
                  content,
                  author_name: acc.accountName || "Uspeshnyy",
                  return_content: false,
                }), signal: AbortSignal.timeout(10000),
              });
              const j = await resp.json() as any;
              if (j.ok) results.push({ platform: `telegraph (${acc.accountName})`, ok: true, detail: j.result?.url || "published" });
              else results.push({ platform: `telegraph (${acc.accountName})`, ok: false, detail: j.error || "failed" });

            } else {
              results.push({ platform: `${platform} (${acc.accountName})`, ok: false, detail: "публикация не реализована" });
            }
          } catch (e: any) {
            results.push({ platform: `${platform} (${acc.accountName})`, ok: false, detail: e.message || "error" });
          }
        }
      }
      return results;
    }

    ctx.actions.register("smm-post-publish", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const projectId = (params.projectId as string) || "";
      const text = params.text as string;
      const platforms = (params.platforms as string[]) || [];
      const imageBase64 = (params.imageBase64 as string) || "";
      if (!text) throw new Error("text required");

      // Load branding for CTA + repost settings
      const branding = projectId ? (await ctx.state.get({ scopeKind: "project", scopeId: projectId, stateKey: "smm-branding" })) as any || {} : {};

      const allAccounts = await getList(ctx, companyId, "smm-accounts");
      const accounts = projectId ? allAccounts.filter((a: any) => a.projectId === projectId) : allAccounts;
      const results = await publishToAccounts(ctx.http, accounts, text, platforms, {
        imageBase64: imageBase64 || undefined,
        subscribeCta: branding.subscribeCta,
        vkRepostUrl: branding.vkRepostUrl,
      });

      // Save to posts history
      const posts = await getList(ctx, companyId, "smm-posts");
      posts.push({ id: generateId(), projectId, text: text.slice(0, 200), platforms, results, hasImage: !!imageBase64, publishedAt: new Date().toISOString() });
      await setList(ctx, companyId, "smm-posts", posts);

      await ctx.activity.log({ companyId, message: `SMM: опубликовано в ${results.filter(r => r.ok).length}/${results.length} платформ${imageBase64 ? " (с обложкой)" : ""}` });
      return { ok: true, results };
    });

    // Agent tool: publish-post (with image support)
    ctx.tools.register("publish-post",
      {
        name: "publish-post", displayName: "Опубликовать пост",
        description: "Опубликовать пост в VK, Telegram, Telegraph. Поддерживает отправку с обложкой (imageBase64 — base64 PNG из generate-cover). VK: wall.post + фото, Telegram: sendPhoto multipart, Telegraph: страница с картинкой.",
        parametersSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "ID проекта: sitechist, itc34, uspeshnyy" },
            text: { type: "string", description: "Текст поста" },
            platforms: { type: "array", items: { type: "string" }, description: "Платформы: vk, telegram, telegraph" },
            imageBase64: { type: "string", description: "Base64 PNG обложки (из generate-cover). Опционально." },
            imageUrl: { type: "string", description: "URL обложки для Telegraph. Опционально." },
          },
          required: ["projectId", "text", "platforms"],
        },
      },
      async (params: any) => {
        const companyId = "cc5dce5f-2073-40c2-b436-5f9026fe45c5";
        const text = params.text as string;
        const platforms = (params.platforms as string[]) || [];
        const projectId = (params.projectId as string) || "";
        const imageBase64 = (params.imageBase64 as string) || "";
        const imageUrl = (params.imageUrl as string) || "";
        if (!text) return { content: "Error: text required" };

        // Load branding for CTA + repost settings
        const branding = projectId ? (await ctx.state.get({ scopeKind: "project", scopeId: projectId, stateKey: "smm-branding" })) as any || {} : {};

        const allAccounts = await getList(ctx, companyId, "smm-accounts");
        const accounts = projectId ? allAccounts.filter((a: any) => a.projectId === projectId) : allAccounts;
        const results = await publishToAccounts(ctx.http, accounts, text, platforms, {
          imageBase64: imageBase64 || undefined,
          imageUrl: imageUrl || undefined,
          subscribeCta: branding.subscribeCta,
          vkRepostUrl: branding.vkRepostUrl,
        });

        return { content: results.map(r => `${r.platform}: ${r.ok ? "OK" : "FAIL"} — ${r.detail}`).join("\n") };
      }
    );

    ctx.logger.info(`${PLUGIN_NAME} plugin ready`);
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
