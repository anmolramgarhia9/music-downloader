import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 8081; // Use different port

// Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Basic ping route
app.get("/api/ping", (_req, res) => {
  res.json({ message: "Server is working!" });
});

// Simple download test
app.post("/api/download", async (req, res) => {
  console.log('Download request received:', req.body);
  res.json({ message: "Download endpoint is working", body: req.body });
});

app.listen(PORT, () => {
  console.log(`Standalone server running on http://localhost:${PORT}`);
});