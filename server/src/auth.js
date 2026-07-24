const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { requireAuth } = require('./authMiddleware');

const router = express.Router();

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

function issueToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

router.post('/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (db.findUserByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = db.createUser({ email: normalizedEmail, passwordHash, name: name.trim() });
  const token = issueToken(user.id);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña requeridos' });

  const user = db.findUserByEmail(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  const token = issueToken(user.id);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.findUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
