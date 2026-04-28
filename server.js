const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database('financeiro.db');

// Criar tabela se não existir
db.exec(`
  CREATE TABLE IF NOT EXISTS movimentacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    data TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida'))
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /movimentacoes - listar ordenado por data desc
app.get('/movimentacoes', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM movimentacoes ORDER BY data DESC, id DESC'
  ).all();

  const entradas = rows
    .filter(r => r.tipo === 'entrada')
    .reduce((acc, r) => acc + r.valor, 0);

  const saidas = rows
    .filter(r => r.tipo === 'saida')
    .reduce((acc, r) => acc + r.valor, 0);

  res.json({
    movimentacoes: rows,
    resumo: {
      entradas,
      saidas,
      saldo: entradas - saidas
    }
  });
});

// POST /movimentacoes - inserir nova movimentação
app.post('/movimentacoes', (req, res) => {
  const { descricao, valor, data, tipo } = req.body;

  if (!descricao || !valor || !data || !tipo) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
  }

  if (!['entrada', 'saida'].includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo inválido. Use "entrada" ou "saida".' });
  }

  if (isNaN(valor) || Number(valor) <= 0) {
    return res.status(400).json({ erro: 'Valor deve ser um número positivo.' });
  }

  const stmt = db.prepare(
    'INSERT INTO movimentacoes (descricao, valor, data, tipo) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(descricao.trim(), Number(valor), data, tipo);

  res.status(201).json({ id: result.lastInsertRowid, descricao, valor: Number(valor), data, tipo });
});

// DELETE /movimentacoes/:id - remover registro
app.delete('/movimentacoes/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM movimentacoes WHERE id = ?').run(id);

  if (result.changes === 0) {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }

  res.json({ mensagem: 'Registro removido com sucesso.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
