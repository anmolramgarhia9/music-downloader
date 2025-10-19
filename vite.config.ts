import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8080,
    allowedHosts: ["susannah-unspewed-danyelle.ngrok-free.dev"],
    fs: {
      allow: ["./client", "./shared", "./index.html"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"],
    },
  },
  build: {
    outDir: "dist",
  },
  plugins: [
    react(), 
    // Only use express plugin in development mode
    ...(mode === 'development' ? [expressPlugin()] : [])
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    async configureServer(server) {
      const { createSimpleServer } = await import("./server/simple.js");
      const app = createSimpleServer();

      // Add Express app as middleware to Vite dev server
      server.middlewares.use(app);
    },
  };
}
