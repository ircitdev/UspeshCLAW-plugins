import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

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

// Get per-project Cloudflare config
async function getProjectCfConfig(ctx: any, companyId: string, projectId: string): Promise<any> {
  const val = await ctx.state.get({ scopeKind: "project", scopeId: projectId, stateKey: "cf-config" });
  if (val) return val;
  // Fallback: try company-level config
  const fallback = await ctx.state.get({ scopeKind: "company", scopeId: companyId, stateKey: "cf-config-default" });
  if (fallback) return fallback;
  // Fallback: instance config
  const config = await ctx.config.get();
  return { cfEmail: config?.cfEmail || "", cfApiKey: config?.cfApiKey || "", cfZoneId: config?.cfZoneId || "", serverIp: config?.serverIp || "2.27.63.110", domain: "sitechist.ru" };
}

// Get all project configs for listing
async function getAllProjectConfigs(ctx: any, companyId: string): Promise<any[]> {
  const projects = await ctx.projects.list({ companyId });
  const configs = [];
  for (const p of projects) {
    const cfg = await ctx.state.get({ scopeKind: "project", scopeId: p.id, stateKey: "cf-config" });
    configs.push({ projectId: p.id, projectName: p.name, config: cfg || null });
  }
  return configs;
}

// Cloudflare API with per-project config
async function cfRequest(ctx: any, cfConfig: any, method: string, path: string, body?: any) {
  const url = `https://api.cloudflare.com/client/v4/zones/${cfConfig.cfZoneId}${path}`;
  const resp = await ctx.http.fetch(url, {
    method,
    headers: {
      "X-Auth-Email": cfConfig.cfEmail,
      "X-Auth-Key": cfConfig.cfApiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return resp.json();
}

async function createDnsRecord(ctx: any, cfConfig: any, subdomain: string): Promise<{ ok: boolean; dnsId?: string; error?: string }> {
  const serverIp = cfConfig.serverIp || "2.27.63.110";
  const result = await cfRequest(ctx, cfConfig, "POST", "/dns_records", {
    type: "A", name: subdomain, content: serverIp, ttl: 1, proxied: false,
  });
  if (result.success) return { ok: true, dnsId: result.result.id };
  return { ok: false, error: result.errors?.[0]?.message || "CF error" };
}

async function deleteDnsRecord(ctx: any, cfConfig: any, dnsId: string): Promise<boolean> {
  const result = await cfRequest(ctx, cfConfig, "DELETE", `/dns_records/${dnsId}`);
  return result.success;
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("sitechist-cloudflare plugin setup");

    // ── PROJECT CONFIG ──

    ctx.data.register("project-cf-configs", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { configs: [] };
      return { configs: await getAllProjectConfigs(ctx, companyId) };
    });

    ctx.data.register("project-cf-config", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const projectId = params.projectId as string;
      if (!projectId) return { config: null };
      return { config: await getProjectCfConfig(ctx, companyId, projectId) };
    });

    ctx.actions.register("project-cf-config-save", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      if (!projectId) throw new Error("projectId required");
      const config = {
        cfEmail: (params.cfEmail as string) || "",
        cfApiKey: (params.cfApiKey as string) || "",
        cfZoneId: (params.cfZoneId as string) || "",
        serverIp: (params.serverIp as string) || "2.27.63.110",
        domain: (params.domain as string) || "",
      };
      await ctx.state.set({ scopeKind: "project", scopeId: projectId, stateKey: "cf-config" }, config);
      return { ok: true };
    });

    // ── SUBDOMAINS (per-project) ──

    ctx.data.register("subdomains-list", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { subdomains: [] };
      const subdomains = await getList(ctx, companyId, "subdomains");
      return { subdomains };
    });

    ctx.actions.register("subdomain-create", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const projectId = params.projectId as string;
      const subdomain = (params.subdomain as string || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!subdomain) throw new Error("Subdomain name required");

      const subdomains = await getList(ctx, companyId, "subdomains");
      if (subdomains.some((s: any) => s.name === subdomain)) {
        throw new Error(`Subdomain ${subdomain} already exists`);
      }

      const cfConfig = await getProjectCfConfig(ctx, companyId, projectId || "");
      const domain = cfConfig.domain || "sitechist.ru";
      const dns = await createDnsRecord(ctx, cfConfig, subdomain);
      if (!dns.ok) throw new Error(`Cloudflare: ${dns.error}`);

      const record = {
        id: generateId(), name: subdomain, fullDomain: `${subdomain}.${domain}`,
        dnsId: dns.dnsId, projectId: projectId || null,
        status: "active", files: [] as string[], createdAt: new Date().toISOString(),
      };
      subdomains.push(record);
      await setList(ctx, companyId, "subdomains", subdomains);
      await ctx.activity.log({ companyId, message: `Создан поддомен: ${record.fullDomain}` });
      return { ok: true, subdomain: record };
    });

    ctx.actions.register("subdomain-delete", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      let subdomains = await getList(ctx, companyId, "subdomains");
      const sub = subdomains.find((s: any) => s.id === id);
      if (sub?.dnsId) {
        const cfConfig = await getProjectCfConfig(ctx, companyId, sub.projectId || "");
        await deleteDnsRecord(ctx, cfConfig, sub.dnsId);
      }
      subdomains = subdomains.filter((s: any) => s.id !== id);
      await setList(ctx, companyId, "subdomains", subdomains);
      await ctx.activity.log({ companyId, message: `Удалён поддомен: ${sub?.fullDomain}` });
      return { ok: true };
    });

    ctx.actions.register("subdomain-publish", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const filename = (params.filename as string) || "index.html";
      const content = params.content as string;
      if (!content) throw new Error("Content required");
      const subdomains = await getList(ctx, companyId, "subdomains");
      const idx = subdomains.findIndex((s: any) => s.id === id);
      if (idx === -1) throw new Error("Subdomain not found");
      const fileKey = `file:${subdomains[idx].name}:${filename}`;
      await ctx.state.set({ scopeKind: "company", scopeId: companyId, stateKey: fileKey }, content);
      if (!subdomains[idx].files.includes(filename)) subdomains[idx].files.push(filename);
      subdomains[idx].publishedAt = new Date().toISOString();
      await setList(ctx, companyId, "subdomains", subdomains);
      await ctx.activity.log({ companyId, message: `Опубликован ${filename} на ${subdomains[idx].fullDomain}` });
      return { ok: true, url: `https://${subdomains[idx].fullDomain}/${filename}` };
    });

    // ── AGENT TOOLS ──

    ctx.tools.register("create-subdomain", {
      name: "create-subdomain", displayName: "Создать поддомен",
      description: "Создаёт A-запись поддомена через Cloudflare",
      parametersSchema: { type: "object", properties: { subdomain: { type: "string" }, projectId: { type: "string" }, htmlContent: { type: "string" } }, required: ["subdomain"] },
    }, async (params, runContext) => {
      const companyId = runContext.companyId;
      const projectId = (params.projectId as string) || "";
      const subdomain = (params.subdomain as string).toLowerCase().replace(/[^a-z0-9-]/g, "");
      const subdomains = await getList(ctx, companyId, "subdomains");
      if (subdomains.some((s: any) => s.name === subdomain)) return { content: `Поддомен ${subdomain} уже существует` };
      const cfConfig = await getProjectCfConfig(ctx, companyId, projectId);
      const domain = cfConfig.domain || "sitechist.ru";
      const dns = await createDnsRecord(ctx, cfConfig, subdomain);
      if (!dns.ok) return { content: `Ошибка Cloudflare: ${dns.error}` };
      const record = { id: generateId(), name: subdomain, fullDomain: `${subdomain}.${domain}`, dnsId: dns.dnsId, projectId, status: "active", files: [] as string[], createdAt: new Date().toISOString() };
      subdomains.push(record);
      await setList(ctx, companyId, "subdomains", subdomains);
      if (params.htmlContent) {
        await ctx.state.set({ scopeKind: "company", scopeId: companyId, stateKey: `file:${subdomain}:index.html` }, params.htmlContent as string);
        record.files.push("index.html");
        await setList(ctx, companyId, "subdomains", subdomains);
      }
      return { content: `Создан поддомен https://${record.fullDomain}` };
    });

    ctx.tools.register("publish-site", {
      name: "publish-site", displayName: "Опубликовать сайт",
      description: "Загружает HTML на поддомен",
      parametersSchema: { type: "object", properties: { subdomain: { type: "string" }, filename: { type: "string" }, content: { type: "string" } }, required: ["subdomain", "content"] },
    }, async (params, runContext) => {
      const companyId = runContext.companyId;
      const subdomain = (params.subdomain as string).toLowerCase();
      const filename = (params.filename as string) || "index.html";
      const subdomains = await getList(ctx, companyId, "subdomains");
      const sub = subdomains.find((s: any) => s.name === subdomain);
      if (!sub) return { content: `Поддомен ${subdomain} не найден` };
      await ctx.state.set({ scopeKind: "company", scopeId: companyId, stateKey: `file:${subdomain}:${filename}` }, params.content as string);
      if (!sub.files.includes(filename)) sub.files.push(filename);
      sub.publishedAt = new Date().toISOString();
      await setList(ctx, companyId, "subdomains", subdomains);
      return { content: `Опубликован https://${sub.fullDomain}/${filename}` };
    });

    ctx.tools.register("list-subdomains", {
      name: "list-subdomains", displayName: "Список поддоменов",
      description: "Возвращает все поддомены",
      parametersSchema: { type: "object", properties: {} },
    }, async (_params, runContext) => {
      const subdomains = await getList(ctx, runContext.companyId, "subdomains");
      if (subdomains.length === 0) return { content: "Нет поддоменов" };
      const list = subdomains.map((s: any) => `- ${s.fullDomain} [${s.status}] (${s.files?.length || 0} файлов)`).join("\n");
      return { content: `Поддомены:\n${list}` };
    });
  },

  async onHealth() {
    return { status: "ok", message: "sitechist-cloudflare ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
