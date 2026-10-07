import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  // Absolute base so deep-linked/refreshed routes (e.g. /bonds/ZCCM) resolve
  // their JS/CSS from the site root instead of relative to the current path.
  // With base: './' + a client-side-routing 200 rewrite, a refresh on any
  // nested route 404'd on its own assets.
  base: '/',
  server: {
    // Only widen beyond localhost when explicitly opted into (e.g. testing
    // from a phone on the same LAN). Binding "::" by default put every dev
    // server run on this network, which is also the exact precondition for
    // a known Vite dev-server advisory (GHSA-g4jq-h2w9-997c).
    host: process.env.VITE_DEV_LAN === 'true' ? '::' : 'localhost',
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
