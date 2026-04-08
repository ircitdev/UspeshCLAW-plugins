import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "sitechist-reports",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Отчёты",
  description: "Генерация HTML-отчётов и загрузка на Google Cloud Storage",
  author: "Sitechist",
  categories: ["automation", "ui"],
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
      gcsProjectId: { type: "string", title: "GCS Project ID" },
      gcsBucket: { type: "string", title: "GCS Bucket Name" },
      gcsKeyJson: { type: "string", title: "GCS Service Account Key (JSON)" },
    },
  },
  tools: [
    {
      name: "generate-report",
      displayName: "Создать отчёт",
      description: "Генерирует HTML-отчёт из данных и сохраняет. Может загрузить на GCS и опубликовать на поддомене.",
      parametersSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Заголовок отчёта" },
          htmlContent: { type: "string", description: "HTML-контент отчёта" },
          uploadToGcs: { type: "boolean", description: "Загрузить на GCS" },
          subdomain: { type: "string", description: "Поддомен для публикации (опционально)" },
        },
        required: ["title", "htmlContent"],
      },
    },
    {
      name: "list-reports",
      displayName: "Список отчётов",
      description: "Возвращает список всех созданных отчётов",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
  ui: {
    slots: [
      {
        type: "page",
        id: "reports-page",
        displayName: "Отчёты",
        exportName: "ReportsPage",
        routePath: "reports",
      },
      {
        type: "sidebar",
        id: "reports-sidebar",
        displayName: "Отчёты",
        exportName: "ReportsSidebarLink",
      },
    ],
  },
};

export default manifest;
