import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "sitechist-devices",
  apiVersion: 1,
  version: "0.3.0",
  displayName: "Аккаунты",
  description: "GPT-аккаунты, прокси, OAuth-сессии и Telegram-боты — управление и мониторинг",
  author: "Sitechist",
  categories: ["connector", "ui"],
  capabilities: [
    "ui.page.register",
    "ui.sidebar.register",
    "ui.dashboardWidget.register",
    "plugin.state.read",
    "plugin.state.write",
    "agents.read",
    "events.subscribe",
    "http.outbound",
    "activity.log.write",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "page",
        id: "devices-page",
        displayName: "Аккаунты",
        exportName: "DevicesPage",
        routePath: "devices",
      },
      {
        type: "sidebar",
        id: "devices-sidebar",
        displayName: "Аккаунты",
        exportName: "DevicesSidebarLink",
      },
      {
        type: "dashboardWidget",
        id: "devices-widget",
        displayName: "Статус аккаунтов",
        exportName: "DevicesWidget",
      },
    ],
  },
};

export default manifest;
