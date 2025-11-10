import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

app.get("/", (_req, res) => {
  res.type("text/plain").send(
    "API pro správu projektů běží.\n" +
    "GET  /health\n" +
    "GET  /health/db\n" +
    "GET  /api/projects\n" +
    "POST /api/auth/login {email,password}\n"
  );
});

// health
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ db: "ok" });
  } catch {
    res.status(500).json({ db: "failed" });
  }
});

// auth
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (email === "demo@demo.cz" && password === "demo") {
    const token = jwt.sign({ sub: email }, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ token });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});

// auth middleware
function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  try {
    jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// projects (SQLite přes Prisma)
app.get("/api/projects", async (_req, res) => {
  const items = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
  res.json(items);
});

app.post("/api/projects", auth, async (req, res) => {
  const { title, description } = req.body ?? {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: "Title required" });
  const item = await prisma.project.create({
    data: { title: String(title).trim(), description: String(description ?? "") }
  });
  res.status(201).json(item);
});

app.put("/api/projects/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const { title, description } = req.body ?? {};
  try {
    const item = await prisma.project.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(description !== undefined ? { description: String(description) } : {})
      }
    });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

app.delete("/api/projects/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const item = await prisma.project.delete({ where: { id } });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

const PORT = Number(process.env.PORT) || 4500;

// manuální seed endpoint (dev only)
if (process.env.NODE_ENV === "development") {
  app.post("/api/dev/seed", async (_req, res) => {
    try {
      const count = await prisma.project.count();
      if (count === 0) {
        await prisma.project.createMany({
          data: [
            { title: "Ukázkový projekt", description: "Popis..." },
            { title: "Programování", description: "Práce s CoPilotem" }
          ]
        });
      }
      res.json({ seeded: true });
    } catch (e) {
      console.error("Seed failed:", e);
      res.status(500).json({ error: "Seed failed" });
    }
  });
}

// start: seed -> listen
async function main() {
  await prisma.$connect();
  const count = await prisma.project.count();
  if (count === 0) {
    await prisma.project.createMany({
      data: [
        { title: "Ukázkový projekt", description: "Popis..." },
        { title: "Programování", description: "Práce s CoPilotem" }
      ]
    });
    console.log("Seeded demo data");
  }
  app.listen(PORT, () => console.log(`Portfolio API na http://localhost:${PORT}`));
}

main().catch(err => {
  console.error("Server start failed:", err);
  process.exit(1);
});

// graceful shutdown
process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });