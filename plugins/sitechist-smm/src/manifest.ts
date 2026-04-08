import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "sitechist-smm",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "SMM",
  description: "Управление соцсетями: аккаунты, контент-план, UTM-ссылки, хэштеги",
  author: "Sitechist",
  categories: ["connector", "ui"],
  capabilities: [
    "ui.page.register",
    "ui.sidebar.register",
    "ui.dashboardWidget.register",
    "plugin.state.read",
    "plugin.state.write",
    "agents.read",
    "http.outbound",
    "activity.log.write",
    "agent.tools.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  tools: [
    {
      name: "list-social-accounts",
      displayName: "Список соцсетей",
      description: "Список подключённых соцсетей по проекту",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "ID проекта: sitechist, itc34, uspeshnyy" },
        },
      },
    },
    {
      name: "check-social-status",
      displayName: "Проверить статус соцсетей",
      description: "Проверить статус подключения аккаунтов соцсетей",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "ID проекта (опционально)" },
        },
      },
    },
    {
      name: "create-post-draft",
      displayName: "Создать черновик поста",
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
    },
    {
      name: "generate-utm-link",
      displayName: "UTM-ссылка",
      description: "Сгенерировать UTM-ссылку с коротким URL для публикации в соцсетях",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "ID проекта" },
          url: { type: "string", description: "Исходный URL" },
          platform: { type: "string", description: "Платформа" },
          campaign: { type: "string", description: "UTM campaign (опционально)" },
          content: { type: "string", description: "UTM content (опционально)" },
        },
        required: ["projectId", "url", "platform"],
      },
    },
    {
      name: "list-content-plan",
      displayName: "Контент-план",
      description: "Показать контент-план для проекта",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "ID проекта" },
          status: { type: "string", description: "Фильтр статуса: draft, scheduled, published" },
        },
        required: ["projectId"],
      },
    },
    {
      name: "list-hashtag-sets",
      displayName: "Хэштеги",
      description: "Показать наборы хэштегов для проекта",
      parametersSchema: {
        type: "object",
        properties: { projectId: { type: "string", description: "ID проекта" } },
        required: ["projectId"],
      },
    },
    {
      name: "get-post-guidelines",
      displayName: "Гайдлайны постов",
      description: "Получить инструкции по оформлению постов (тон, запрещённые слова, CTA, правила платформ)",
      parametersSchema: {
        type: "object",
        properties: { projectId: { type: "string", description: "ID проекта" } },
        required: ["projectId"],
      },
    },
    {
      name: "generate-image",
      displayName: "Сгенерировать картинку",
      description: "Сгенерировать картинку через Google Imagen 4 по текстовому описанию. Возвращает URL картинки.",
      parametersSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Описание картинки на английском" },
          aspectRatio: { type: "string", description: "Соотношение сторон: 1:1, 16:9, 9:16, 4:3, 3:4. По умолчанию 1:1" },
        },
        required: ["prompt"],
      },
    },
    {
      name: "generate-report",
      displayName: "Сгенерировать HTML-отчёт",
      description: "Создать красивый HTML-отчёт, залить в GCS и отправить ссылку в Telegram как mini-app кнопку",
      parametersSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Заголовок отчёта" },
          sections: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, content: { type: "string" } } }, description: "Секции отчёта: [{heading, content}]" },
          projectId: { type: "string", description: "ID проекта" },
          sendTelegram: { type: "boolean", description: "Отправить в Telegram канал (true/false)" },
        },
        required: ["title", "sections"],
      },
    },
    {
      name: "generate-cover",
      displayName: "Сгенерировать обложку",
      description: "Генерация обложки для поста: GPT Image 1 создаёт фон, ImageMagick накладывает заголовок, логотип и ссылку по branding настройкам проекта",
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
    {
      name: "publish-post",
      displayName: "Опубликовать пост",
      description: "Опубликовать пост в VK, Telegram, Telegraph. Поддерживает обложку: VK — фото-вложение, Telegram — sendPhoto multipart, Telegraph — страница с картинкой.",
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
  ],
  ui: {
    slots: [
      {
        type: "page",
        id: "smm-page",
        displayName: "SMM",
        exportName: "SmmPage",
        routePath: "smm",
      },
      {
        type: "sidebar",
        id: "smm-sidebar",
        displayName: "SMM",
        exportName: "SmmSidebarLink",
      },
      {
        type: "dashboardWidget",
        id: "smm-widget",
        displayName: "SMM: Соцсети",
        exportName: "SmmWidget",
      },
    ],
  },
};

export default manifest;
