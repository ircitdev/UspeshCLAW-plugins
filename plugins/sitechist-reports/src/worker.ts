import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

function generateId(): string { return crypto.randomUUID(); }

async function getState(ctx: any, scope: string, scopeId: string, key: string): Promise<any> {
  return await ctx.state.get({ scopeKind: scope, scopeId, stateKey: key });
}
async function setState(ctx: any, scope: string, scopeId: string, key: string, val: any): Promise<void> {
  await ctx.state.set({ scopeKind: scope, scopeId, stateKey: key }, val);
}
async function getList(ctx: any, companyId: string, key: string): Promise<any[]> {
  const val = await getState(ctx, "company", companyId, key);
  if (!val) return [];
  try { return Array.isArray(val) ? val : JSON.parse(val as string); } catch { return []; }
}
async function setList(ctx: any, companyId: string, key: string, data: any[]): Promise<void> {
  await setState(ctx, "company", companyId, key, data);
}

// ── Per-project config helpers ──

async function getProjectConfig(ctx: any, companyId: string, projectId: string): Promise<any> {
  if (projectId) {
    const val = await getState(ctx, "project", projectId, "report-config");
    if (val) return val;
  }
  const fallback = await getState(ctx, "company", companyId, "report-config-default");
  return fallback || {};
}

async function getProjectBranding(ctx: any, companyId: string, projectId: string): Promise<any> {
  const cfg = await getProjectConfig(ctx, companyId, projectId);
  return cfg.branding || { companyName: "", logo: "", slogan: "", primaryColor: "#2563eb", accentColor: "#7dd3fc" };
}

async function getProjectContacts(ctx: any, companyId: string, projectId: string): Promise<any> {
  const cfg = await getProjectConfig(ctx, companyId, projectId);
  return cfg.contacts || { phone: "", email: "", website: "", telegram: "", address: "" };
}

async function getProjectCtas(ctx: any, companyId: string, projectId: string): Promise<any[]> {
  const cfg = await getProjectConfig(ctx, companyId, projectId);
  return cfg.ctas || [];
}

async function getProjectTemplates(ctx: any, companyId: string, projectId: string): Promise<any[]> {
  const cfg = await getProjectConfig(ctx, companyId, projectId);
  return cfg.templates || [];
}

async function getProjectGcsConfig(ctx: any, companyId: string, projectId: string): Promise<any> {
  if (projectId) {
    const val = await getState(ctx, "project", projectId, "gcs-config");
    if (val) return val;
  }
  const config = await ctx.config.get();
  return { gcsBucket: config?.gcsBucket || "", gcsKeyJson: config?.gcsKeyJson || "" };
}

async function getAllProjectConfigs(ctx: any, companyId: string): Promise<any[]> {
  const projects = await ctx.projects.list({ companyId });
  const configs = [];
  for (const p of projects) {
    const cfg = await getState(ctx, "project", p.id, "report-config");
    const gcs = await getState(ctx, "project", p.id, "gcs-config");
    configs.push({ projectId: p.id, projectName: p.name, config: cfg || null, gcsConfig: gcs || null });
  }
  return configs;
}

// ── Build final HTML from template + branding ──

function buildReportHtml(body: string, branding: any, contacts: any, ctas: any[], headerHtml: string, footerHtml: string): string {
  const ctaHtml = ctas.map(c => `
    <div style="background:${branding.primaryColor || '#2563eb'};color:#fff;padding:1.5rem;border-radius:0.75rem;margin:1.5rem 0;text-align:center">
      <h3 style="margin:0 0 0.5rem">${c.title || ''}</h3>
      <p style="margin:0 0 1rem;opacity:0.9">${c.text || ''}</p>
      ${c.buttonText ? `<a href="${c.buttonUrl || '#'}" style="display:inline-block;background:#fff;color:${branding.primaryColor || '#2563eb'};padding:0.6rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600">${c.buttonText}</a>` : ''}
    </div>`).join('\n');

  const header = headerHtml || `
    <div style="display:flex;align-items:center;gap:1rem;padding:1rem 0;border-bottom:2px solid ${branding.primaryColor || '#2563eb'}">
      ${branding.logo ? `<img src="${branding.logo}" alt="logo" style="height:40px">` : ''}
      <div>
        <strong style="font-size:1.2rem">${branding.companyName || ''}</strong>
        ${branding.slogan ? `<div style="font-size:0.8rem;color:#888">${branding.slogan}</div>` : ''}
      </div>
    </div>`;

  const footer = footerHtml || `
    <div style="margin-top:2rem;padding:1rem 0;border-top:1px solid #ddd;font-size:0.8rem;color:#888">
      ${contacts.website ? `<a href="${contacts.website}">${contacts.website}</a> | ` : ''}
      ${contacts.email ? `${contacts.email} | ` : ''}
      ${contacts.phone ? `${contacts.phone} | ` : ''}
      ${contacts.telegram ? `Telegram: ${contacts.telegram}` : ''}
      ${contacts.address ? `<br>${contacts.address}` : ''}
    </div>`;

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${branding.companyName || 'Report'}</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:2rem;color:#333;line-height:1.6}
table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{padding:0.5rem;border:1px solid #ddd;text-align:left}
th{background:#f5f5f5}h1,h2,h3{color:${branding.primaryColor || '#2563eb'}}
a{color:${branding.accentColor || '#2563eb'}}</style>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head><body>
${header}
${body}
${ctaHtml}
${footer}
</body></html>`;
}

// GCS upload
async function uploadToGcs(ctx: any, gcsConfig: any, filename: string, content: string): Promise<string | null> {
  const bucket = gcsConfig?.gcsBucket;
  const keyJson = gcsConfig?.gcsKeyJson;
  if (!bucket || !keyJson) return null;
  let key;
  try { key = JSON.parse(keyJson); } catch { return null; }
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ iss: key.client_email, scope: "https://www.googleapis.com/auth/devstorage.read_write", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  try {
    const tokenResp = await ctx.http.fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${payload}` });
    if (!tokenResp.ok) return null;
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) return null;
    const uploadResp = await ctx.http.fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(filename)}`, { method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "text/html; charset=utf-8" }, body: content });
    if (uploadResp.ok) { const r = await uploadResp.json(); return `https://storage.googleapis.com/${bucket}/${r.name}`; }
    return null;
  } catch { return null; }
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("sitechist-reports plugin setup");

    // ── PROJECT CONFIG (branding, contacts, CTA, templates, GCS) ──

    ctx.data.register("project-report-configs", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { configs: [] };
      return { configs: await getAllProjectConfigs(ctx, companyId) };
    });

    ctx.data.register("project-report-config", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      const companyId = params.companyId as string;
      return { config: await getProjectConfig(ctx, companyId, projectId) };
    });

    ctx.actions.register("project-report-config-save", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      if (!projectId) throw new Error("projectId required");
      const config = {
        branding: params.branding || {},
        contacts: params.contacts || {},
        ctas: params.ctas || [],
        templates: params.templates || [],
        headerHtml: (params.headerHtml as string) || "",
        footerHtml: (params.footerHtml as string) || "",
      };
      await setState(ctx, "project", projectId, "report-config", config);
      return { ok: true };
    });

    ctx.actions.register("project-gcs-config-save", async (params: Record<string, unknown>) => {
      const projectId = params.projectId as string;
      if (!projectId) throw new Error("projectId required");
      await setState(ctx, "project", projectId, "gcs-config", {
        gcsProjectId: (params.gcsProjectId as string) || "",
        gcsBucket: (params.gcsBucket as string) || "",
        gcsKeyJson: (params.gcsKeyJson as string) || "",
      });
      return { ok: true };
    });

    // ── REPORTS CRUD ──

    ctx.data.register("reports-list", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      if (!companyId) return { reports: [] };
      const reports = await getList(ctx, companyId, "reports");
      return { reports: reports.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || "")) };
    });

    ctx.data.register("report-detail", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const reports = await getList(ctx, companyId, "reports");
      const report = reports.find((r: any) => r.id === id);
      if (!report) return { report: null, content: null };
      const content = await getState(ctx, "company", companyId, `report-html:${id}`);
      return { report, content: content || "" };
    });

    ctx.actions.register("report-create", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const projectId = (params.projectId as string) || "";
      const title = params.title as string;
      const bodyHtml = params.htmlContent as string;
      const templateId = params.templateId as string;
      const ctaIds = (params.ctaIds as string[]) || [];
      const useBranding = params.useBranding !== false; // default true
      if (!title || !bodyHtml) throw new Error("Title and HTML content required");

      let finalHtml = bodyHtml;

      if (useBranding && projectId) {
        const branding = await getProjectBranding(ctx, companyId, projectId);
        const contacts = await getProjectContacts(ctx, companyId, projectId);
        const allCtas = await getProjectCtas(ctx, companyId, projectId);
        const cfg = await getProjectConfig(ctx, companyId, projectId);
        const selectedCtas = ctaIds.length > 0 ? allCtas.filter((c: any) => ctaIds.includes(c.id) || ctaIds.includes(c.name)) : [];
        finalHtml = buildReportHtml(bodyHtml, branding, contacts, selectedCtas, cfg.headerHtml || "", cfg.footerHtml || "");
      }

      const id = generateId();
      const report: any = { id, title, projectId, templateId: templateId || null, status: "created", gcsUrl: null, agentId: (params.agentId as string) || null, sizeBytes: new TextEncoder().encode(finalHtml).length, createdAt: new Date().toISOString() };
      await setState(ctx, "company", companyId, `report-html:${id}`, finalHtml);

      if (params.uploadToGcs) {
        const gcsConfig = await getProjectGcsConfig(ctx, companyId, projectId);
        const filename = `reports/${id}/${title.replace(/[^a-zA-Z0-9-_]/g, "_")}.html`;
        const gcsUrl = await uploadToGcs(ctx, gcsConfig, filename, finalHtml);
        if (gcsUrl) { report.gcsUrl = gcsUrl; report.status = "uploaded"; }
      }

      const reports = await getList(ctx, companyId, "reports");
      reports.push(report);
      await setList(ctx, companyId, "reports", reports);
      await ctx.activity.log({ companyId, message: `Создан отчёт: ${title}${report.gcsUrl ? " (GCS)" : ""}` });
      return { ok: true, report };
    });

    ctx.actions.register("report-delete", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      let reports = await getList(ctx, companyId, "reports");
      reports = reports.filter((r: any) => r.id !== id);
      await setList(ctx, companyId, "reports", reports);
      await ctx.state.delete({ scopeKind: "company", scopeId: companyId, stateKey: `report-html:${id}` });
      return { ok: true };
    });

    ctx.actions.register("report-upload-gcs", async (params: Record<string, unknown>) => {
      const companyId = params.companyId as string;
      const id = params.id as string;
      const reports = await getList(ctx, companyId, "reports");
      const idx = reports.findIndex((r: any) => r.id === id);
      if (idx === -1) throw new Error("Report not found");
      const content = await getState(ctx, "company", companyId, `report-html:${id}`);
      if (!content) throw new Error("HTML not found");
      const gcsConfig = await getProjectGcsConfig(ctx, companyId, reports[idx].projectId || "");
      const gcsUrl = await uploadToGcs(ctx, gcsConfig, `reports/${id}/report.html`, content as string);
      if (!gcsUrl) throw new Error("GCS upload failed");
      reports[idx].gcsUrl = gcsUrl; reports[idx].status = "uploaded";
      await setList(ctx, companyId, "reports", reports);
      return { ok: true, gcsUrl };
    });

    // ── AGENT TOOLS ──

    ctx.tools.register("generate-report", {
      name: "generate-report", displayName: "Создать отчёт",
      description: "Создаёт HTML-отчёт с брендингом проекта, шапкой, подвалом и CTA-блоками. Параметры: title, htmlContent (тело отчёта), projectId (для брендинга), ctaIds (массив имён CTA-блоков), uploadToGcs, useBranding (default true).",
      parametersSchema: { type: "object", properties: {
        title: { type: "string", description: "Заголовок отчёта" },
        htmlContent: { type: "string", description: "HTML-тело отчёта (без шапки/подвала — они подставятся автоматически)" },
        projectId: { type: "string", description: "ID проекта для брендинга" },
        ctaIds: { type: "array", items: { type: "string" }, description: "Имена CTA-блоков для вставки" },
        uploadToGcs: { type: "boolean" },
        useBranding: { type: "boolean", description: "Подставить шапку, подвал, брендинг (default true)" },
      }, required: ["title", "htmlContent"] },
    }, async (params, runContext) => {
      const companyId = runContext.companyId;
      const projectId = (params.projectId as string) || "";
      const title = params.title as string;
      const bodyHtml = params.htmlContent as string;
      const ctaIds = (params.ctaIds as string[]) || [];
      const useBranding = params.useBranding !== false;

      let finalHtml = bodyHtml;
      if (useBranding && projectId) {
        const branding = await getProjectBranding(ctx, companyId, projectId);
        const contacts = await getProjectContacts(ctx, companyId, projectId);
        const allCtas = await getProjectCtas(ctx, companyId, projectId);
        const cfg = await getProjectConfig(ctx, companyId, projectId);
        const selectedCtas = ctaIds.length > 0 ? allCtas.filter((c: any) => ctaIds.includes(c.id) || ctaIds.includes(c.name)) : [];
        finalHtml = buildReportHtml(bodyHtml, branding, contacts, selectedCtas, cfg.headerHtml || "", cfg.footerHtml || "");
      }

      const id = generateId();
      const report: any = { id, title, projectId, status: "created", gcsUrl: null, agentId: runContext.agentId, sizeBytes: new TextEncoder().encode(finalHtml).length, createdAt: new Date().toISOString() };
      await setState(ctx, "company", companyId, `report-html:${id}`, finalHtml);

      if (params.uploadToGcs) {
        const gcsConfig = await getProjectGcsConfig(ctx, companyId, projectId);
        const gcsUrl = await uploadToGcs(ctx, gcsConfig, `reports/${id}/${title.replace(/[^a-zA-Z0-9-_]/g, "_")}.html`, finalHtml);
        if (gcsUrl) { report.gcsUrl = gcsUrl; report.status = "uploaded"; }
      }

      const reports = await getList(ctx, companyId, "reports");
      reports.push(report);
      await setList(ctx, companyId, "reports", reports);
      return { content: `Отчёт "${title}" создан (${report.sizeBytes} B)${report.gcsUrl ? `. GCS: ${report.gcsUrl}` : ""}` };
    });

    ctx.tools.register("list-reports", {
      name: "list-reports", displayName: "Список отчётов", description: "Все отчёты",
      parametersSchema: { type: "object", properties: {} },
    }, async (_params, runContext) => {
      const reports = await getList(ctx, runContext.companyId, "reports");
      if (reports.length === 0) return { content: "Нет отчётов" };
      const list = reports.map((r: any) => `- ${r.title} [${r.status}] ${r.gcsUrl || ""}`).join("\n");
      return { content: `Отчёты (${reports.length}):\n${list}` };
    });

    ctx.tools.register("list-report-ctas", {
      name: "list-report-ctas", displayName: "Доступные CTA-блоки",
      description: "Список CTA-блоков проекта для вставки в отчёт",
      parametersSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] },
    }, async (params, runContext) => {
      const ctas = await getProjectCtas(ctx, runContext.companyId, params.projectId as string);
      if (ctas.length === 0) return { content: "Нет CTA-блоков. Настройте в плагине Отчёты → Настройки." };
      const list = ctas.map((c: any) => `- "${c.name}": ${c.title} — ${c.text?.slice(0, 60)}...`).join("\n");
      return { content: `CTA-блоки (${ctas.length}):\n${list}\n\nИспользуйте ctaIds: ["имя"] в generate-report` };
    });

    ctx.tools.register("list-report-templates", {
      name: "list-report-templates", displayName: "Шаблоны отчётов",
      description: "Список шаблонов отчётов проекта",
      parametersSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] },
    }, async (params, runContext) => {
      const templates = await getProjectTemplates(ctx, runContext.companyId, params.projectId as string);
      if (templates.length === 0) return { content: "Нет шаблонов. Настройте в плагине Отчёты → Настройки." };
      const list = templates.map((t: any) => `- "${t.name}": ${t.description || t.name}`).join("\n");
      return { content: `Шаблоны (${templates.length}):\n${list}` };
    });
  },

  async onHealth() {
    return { status: "ok", message: "sitechist-reports ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
