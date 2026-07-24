require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./auth');
const projectRoutes = require('./projects');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Sidón Gantt API escuchando en http://localhost:${PORT}`);
});
