import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Worker
await esbuild.build({
  entryPoints: [path.join(root, "src/worker.ts")],
  outfile: path.join(root, "dist/worker.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["es2022"],
  sourcemap: true,
  external: ["@paperclipai/plugin-sdk"],
});

// Manifest (CJS)
await esbuild.build({
  entryPoints: [path.join(root, "src/manifest.ts")],
  outfile: path.join(root, "dist/manifest.cjs"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: ["es2022"],
  external: ["@paperclipai/plugin-sdk"],
});

// Index
await esbuild.build({
  entryPoints: [path.join(root, "src/index.ts")],
  outfile: path.join(root, "dist/index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["es2022"],
  external: ["@paperclipai/plugin-sdk"],
});

// UI
await esbuild.build({
  entryPoints: [path.join(root, "src/ui/index.tsx")],
  outfile: path.join(root, "dist/ui/index.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  external: ["react", "react-dom", "react/jsx-runtime", "@paperclipai/plugin-sdk/ui"],
});

console.log("Build complete!");
