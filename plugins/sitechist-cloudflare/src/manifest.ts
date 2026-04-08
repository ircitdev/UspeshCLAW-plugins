import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "sitechist-cloudflare",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Поддомены",
  description: "Cloudflare DNS: создание поддоменов и публикация HTML-сайтов на *.sitechist.ru",
  author: "Sitechist",
  categories: ["connector", "ui"],
  capabilities: [
    "ui.page.register",
    "ui.sidebar.register",
    "plugin.state.read",
    "plugin.state.write",
    "http.outbound",
    "activity.log.write",
    "agent.tools.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      cfEmail: {
        type: "string",
        title: "Cloudflare Email",
      },
      cfApiKey: {
        type: "string",
        title: "Cloudflare Global API Key",
      },
      cfZoneId: {
        type: "string",
        title: "Zone ID для sitechist.ru",
      },
      serverIp: {
        type: "string",
        title: "IP VPS-сервера",
        default: "2.27.63.110",
      },
    },
    required: ["cfEmail", "cfApiKey", "cfZoneId"],
  },
  tools: [
    {
      name: "create-subdomain",
      displayName: "Создать поддомен",
      description: "Создаёт A-запись поддомена *.sitechist.ru в Cloudflare DNS и директорию для сайта",
      parametersSchema: {
        type: "object",
        properties: {
          subdomain: { type: "string", description: "Имя поддомена (без .sitechist.ru)" },
          htmlContent: { type: "string", description: "HTML-контент для index.html (опционально)" },
        },
        required: ["subdomain"],
      },
    },
    {
      name: "publish-site",
      displayName: "Опубликовать сайт",
      description: "Загружает HTML-контент на существующий поддомен",
      parametersSchema: {
        type: "object",
        properties: {
          subdomain: { type: "string", description: "Имя поддомена" },
          filename: { type: "string", description: "Имя файла (default: index.html)" },
          content: { type: "string", description: "HTML-контент файла" },
        },
        required: ["subdomain", "content"],
      },
    },
    {
      name: "list-subdomains",
      displayName: "Список поддоменов",
      description: "Возвращает список всех созданных поддоменов sitechist.ru",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
  ui: {
    slots: [
      {
        type: "page",
        id: "subdomains-page",
        displayName: "Поддомены",
        exportName: "SubdomainsPage",
        routePath: "subdomains",
      },
      {
        type: "sidebar",
        id: "subdomains-sidebar",
        displayName: "Поддомены",
        exportName: "SubdomainsSidebarLink",
      },
    ],
  },
};

export default manifest;
