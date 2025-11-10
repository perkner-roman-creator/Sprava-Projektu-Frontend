import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Demo token pro jednoduchou autentizaci
const DEMO_TOKEN = 'demo-token-12345';

// Middleware pro ověření tokenu
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== DEMO_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Přihlášení
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'demo@demo.cz' && password === 'demo') {
    return res.json({ token: DEMO_TOKEN });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// Získat všechny projekty
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const formatted = projects.map(p => ({
      id: p.id,
      title: p.name,
      description: p.description
    }));
    res.json(formatted);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Přidat projekt (vyžaduje autentizaci)
app.post('/api/projects', authMiddleware, async (req, res) => {
  console.log('Request body:', req.body);
  try {
    const { title, description } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const project = await prisma.project.create({
      data: { 
        name: title.trim(), 
        description: description || null 
      }
    });
    res.json({ id: project.id, title: project.name, description: project.description });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upravit projekt (vyžaduje autentizaci)
app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description } = req.body;
    const project = await prisma.project.update({
      where: { id: Number(req.params.id) },
      data: { 
        name: title, 
        description: description || null 
      }
    });
    res.json({ id: project.id, title: project.name, description: project.description });
  } catch (error) {
    console.error('PUT /api/projects/:id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Smazat projekt (vyžaduje autentizaci)
app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.project.delete({
      where: { id: Number(req.params.id) }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/:id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 4500;

app.listen(PORT, () => {
  console.log(`Server běží na portu ${PORT}`);
  console.log(`API dostupné na http://localhost:${PORT}`);
});