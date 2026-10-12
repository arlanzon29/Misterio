import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa para que funcione en GitHub Pages (https://usuario.github.io/Misterio/)
export default defineConfig({ base: "./", plugins: [react()], server: { host: true } });
