const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const db = new Database('financeiro.db');

const JWT_SECRET = process.env.JWT_SECRET || 'fluxo-caixa-secret-2024';
const SALT_ROUNDS = 10;

// ── Tabelas ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'usuario' CHECK(tipo IN ('admin', 'usuario')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS movimentacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida')),
    usuario_id INTEGER NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota raiz redireciona para login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ── Middleware de autenticação ────────────────────────────────────────────────
function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }
  try {
    req.usuario = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

function apenasAdmin(req, res, next) {
  if (req.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
}

// ── Auth: cadastro ────────────────────────────────────────────────────────────
app.post('/auth/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ erro: 'E-mail inválido.' });
  }

  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (existe) {
    return res.status(409).json({ erro: 'E-mail já cadastrado.' });
  }

  // Primeiro usuário vira admin automaticamente
  const total = db.prepare('SELECT COUNT(*) as total FROM usuarios').get();
  const tipo = total.total === 0 ? 'admin' : 'usuario';

  const hash = await bcrypt.hash(senha, SALT_ROUNDS);
  const result = db.prepare(
    'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)'
  ).run(nome.trim(), email.toLowerCase(), hash, tipo);

  const token = jwt.sign(
    { id: result.lastInsertRowid, nome: nome.trim(), email: email.toLowerCase(), tipo },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.status(201).json({ token, usuario: { id: result.lastInsertRowid, nome: nome.trim(), email: email.toLowerCase(), tipo } });
});

// ── Auth: login ───────────────────────────────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (!usuario) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }

  const senhaOk = await bcrypt.compare(senha, usuario.senha);
  if (!senhaOk) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo } });
});

// ── Usuários (admin) ──────────────────────────────────────────────────────────
app.get('/usuarios', autenticar, apenasAdmin, (req, res) => {
  const usuarios = db.prepare(
    'SELECT id, nome, email, tipo, criado_em FROM usuarios ORDER BY criado_em DESC'
  ).all();
  res.json(usuarios);
});

app.delete('/usuarios/:id', autenticar, apenasAdmin, (req, res) => {
  const { id } = req.params;

  if (Number(id) === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode remover sua própria conta.' });
  }

  const result = db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' });
  }

  res.json({ mensagem: 'Usuário removido.' });
});

app.patch('/usuarios/:id/tipo', autenticar, apenasAdmin, (req, res) => {
  const { id } = req.params;
  const { tipo } = req.body;

  if (!['admin', 'usuario'].includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo inválido.' });
  }

  if (Number(id) === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode alterar seu próprio tipo.' });
  }

  const result = db.prepare('UPDATE usuarios SET tipo = ? WHERE id = ?').run(tipo, id);
  if (result.changes === 0) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' });
  }

  res.json({ mensagem: 'Tipo atualizado.' });
});

// ── Movimentações ─────────────────────────────────────────────────────────────
app.get('/movimentacoes', autenticar, (req, res) => {
  // Admin vê tudo; usuário comum vê apenas as próprias
  const rows = req.usuario.tipo === 'admin'
    ? db.prepare(`
        SELECT m.*, u.nome as usuario_nome
        FROM movimentacoes m
        JOIN usuarios u ON u.id = m.usuario_id
        ORDER BY m.data DESC, m.id DESC
      `).all()
    : db.prepare(`
        SELECT m.*, u.nome as usuario_nome
        FROM movimentacoes m
        JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.usuario_id = ?
        ORDER BY m.data DESC, m.id DESC
      `).all(req.usuario.id);

  const entradas = rows.filter(r => r.tipo === 'entrada').reduce((acc, r) => acc + r.valor, 0);
  const saidas   = rows.filter(r => r.tipo === 'saida').reduce((acc, r) => acc + r.valor, 0);

  res.json({ movimentacoes: rows, resumo: { entradas, saidas, saldo: entradas - saidas } });
});

app.post('/movimentacoes', autenticar, (req, res) => {
  const { descricao, valor, data, tipo } = req.body;

  if (!descricao || !valor || !data || !tipo) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
  }

  if (!['entrada', 'saida'].includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo inválido.' });
  }

  if (isNaN(valor) || Number(valor) <= 0) {
    return res.status(400).json({ erro: 'Valor deve ser um número positivo.' });
  }

  const result = db.prepare(
    'INSERT INTO movimentacoes (descricao, valor, data, tipo, usuario_id) VALUES (?, ?, ?, ?, ?)'
  ).run(descricao.trim(), Number(valor), data, tipo, req.usuario.id);

  res.status(201).json({ id: result.lastInsertRowid, descricao, valor: Number(valor), data, tipo });
});

app.delete('/movimentacoes/:id', autenticar, (req, res) => {
  const { id } = req.params;

  // Admin pode deletar qualquer um; usuário só o próprio
  const mov = db.prepare('SELECT * FROM movimentacoes WHERE id = ?').get(id);
  if (!mov) return res.status(404).json({ erro: 'Registro não encontrado.' });

  if (req.usuario.tipo !== 'admin' && mov.usuario_id !== req.usuario.id) {
    return res.status(403).json({ erro: 'Sem permissão para remover este registro.' });
  }

  db.prepare('DELETE FROM movimentacoes WHERE id = ?').run(id);
  res.json({ mensagem: 'Registro removido.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
