import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import dotenv from "dotenv";
import { apiRouter } from "./src/server/routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mount API router
app.use("/api", apiRouter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function startServer() {
  if (!isProd) {
    // Development mode: Vite middleware
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve static assets from dist
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[AI Interview Prep Kit] Server listening on http://0.0.0.0:${PORT} (${isProd ? "production" : "development"})`);
  });
}

startServer().catch(err => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
