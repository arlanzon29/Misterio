import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Versión visible en la app: hash corto del commit + fecha de compilación (UTC).
function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git -c safe.directory=* rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "local";
  }
}
const version = `${commit()} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;

// base relativa para que funcione en GitHub Pages (https://usuario.github.io/Misterio/)
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { host: true },
});
