// ── Guarda de autenticação ────────────────────────────────────────────────────
const token = localStorage.getItem('token');
const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

if (!token || !usuario) {
  window.location.href = '/login.html';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mostrarFeedback(msg, tipo) {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  el.className = `feedback ${tipo}`;
  setTimeout(() => { el.textContent = ''; el.className = 'feedback'; }, 3500);
}

function sair() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/login.html';
}

// ── Inicializa header ─────────────────────────────────────────────────────────
document.getElementById('usuario-nome').textContent = usuario.nome;
const badge = document.getElementById('usuario-badge');
badge.textContent = usuario.tipo === 'admin' ? 'Admin' : 'Usuário';
badge.classList.add(usuario.tipo === 'admin' ? 'badge-admin' : 'badge-usuario');

if (usuario.tipo === 'admin') {
  document.getElementById('painel-admin').style.display = '';
}

// ── Resumo ────────────────────────────────────────────────────────────────────
function atualizarResumo(resumo) {
  document.getElementById('saldo').textContent = formatarMoeda(resumo.saldo);
  document.getElementById('total-entradas').textContent = formatarMoeda(resumo.entradas);
  document.getElementById('total-saidas').textContent = formatarMoeda(resumo.saidas);
  document.getElementById('saldo').style.color = resumo.saldo >= 0 ? 'var(--azul)' : 'var(--vermelho)';
}

// ── Lista de movimentações ────────────────────────────────────────────────────
function renderizarLista(movimentacoes) {
  const lista = document.getElementById('lista-movimentacoes');

  if (movimentacoes.length === 0) {
    lista.innerHTML = '<li class="vazio">Nenhuma movimentação registrada.</li>';
    return;
  }

  lista.innerHTML = movimentacoes.map(m => {
    const podeRemover = usuario.tipo === 'admin' || m.usuario_id === usuario.id;
    const autorLabel  = usuario.tipo === 'admin' ? `<span class="item-autor">${escapeHtml(m.usuario_nome)}</span>` : '';

    return `
      <li class="item ${m.tipo}" data-id="${m.id}">
        <div class="item-info">
          <div class="item-descricao">${escapeHtml(m.descricao)}</div>
          <div class="item-data">${formatarData(m.data)}${autorLabel}</div>
        </div>
        <span class="item-valor">${m.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(m.valor)}</span>
        ${podeRemover ? `<button class="btn-remover" onclick="remover(${m.id})" aria-label="Remover ${escapeHtml(m.descricao)}">✕</button>` : '<span class="btn-remover-placeholder"></span>'}
      </li>`;
  }).join('');
}

// ── Carrega movimentações ─────────────────────────────────────────────────────
async function carregar() {
  try {
    const res = await fetch('/movimentacoes', { headers: authHeaders() });

    if (res.status === 401) { sair(); return; }

    const data = await res.json();
    atualizarResumo(data.resumo);
    renderizarLista(data.movimentacoes);
  } catch {
    mostrarFeedback('Erro ao carregar movimentações.', 'erro');
  }
}

// ── Submete movimentação ──────────────────────────────────────────────────────
document.getElementById('form-movimentacao').addEventListener('submit', async (e) => {
  e.preventDefault();

  const descricao = document.getElementById('descricao').value.trim();
  const valor     = parseFloat(document.getElementById('valor').value);
  const data      = document.getElementById('data').value;
  const tipo      = document.getElementById('tipo').value;

  if (!descricao || !valor || !data || !tipo) {
    mostrarFeedback('Preencha todos os campos.', 'erro');
    return;
  }

  try {
    const res = await fetch('/movimentacoes', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ descricao, valor, data, tipo })
    });

    const resp = await res.json();
    if (!res.ok) { mostrarFeedback(resp.erro || 'Erro ao salvar.', 'erro'); return; }

    mostrarFeedback('Movimentação adicionada!', 'sucesso');
    e.target.reset();
    document.getElementById('data').valueAsDate = new Date();
    await carregar();
  } catch {
    mostrarFeedback('Erro de conexão.', 'erro');
  }
});

// ── Remove movimentação ───────────────────────────────────────────────────────
async function remover(id) {
  if (!confirm('Deseja remover esta movimentação?')) return;

  try {
    const res = await fetch(`/movimentacoes/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) { mostrarFeedback('Erro ao remover.', 'erro'); return; }
    await carregar();
  } catch {
    mostrarFeedback('Erro de conexão.', 'erro');
  }
}

// ── Painel admin: usuários ────────────────────────────────────────────────────
async function carregarUsuarios() {
  if (usuario.tipo !== 'admin') return;

  try {
    const res = await fetch('/usuarios', { headers: authHeaders() });
    const lista = await res.json();
    renderizarUsuarios(lista);
  } catch {
    document.getElementById('lista-usuarios').innerHTML = '<li class="vazio">Erro ao carregar usuários.</li>';
  }
}

function renderizarUsuarios(usuarios) {
  const lista = document.getElementById('lista-usuarios');

  if (usuarios.length === 0) {
    lista.innerHTML = '<li class="vazio">Nenhum usuário cadastrado.</li>';
    return;
  }

  lista.innerHTML = usuarios.map(u => {
    const ehVoce = u.id === usuario.id;
    return `
      <li class="item-usuario">
        <div class="item-info">
          <div class="item-descricao">${escapeHtml(u.nome)} ${ehVoce ? '<span class="badge-voce">você</span>' : ''}</div>
          <div class="item-data">${escapeHtml(u.email)} · desde ${formatarDataHora(u.criado_em)}</div>
        </div>
        <div class="usuario-acoes">
          <span class="badge ${u.tipo === 'admin' ? 'badge-admin' : 'badge-usuario'}">${u.tipo === 'admin' ? 'Admin' : 'Usuário'}</span>
          ${!ehVoce ? `
            <button class="btn-tipo" onclick="alterarTipo(${u.id}, '${u.tipo === 'admin' ? 'usuario' : 'admin'}')"
              title="${u.tipo === 'admin' ? 'Rebaixar para Usuário' : 'Promover a Admin'}">
              ${u.tipo === 'admin' ? '↓' : '↑'}
            </button>
            <button class="btn-remover" onclick="removerUsuario(${u.id})" aria-label="Remover ${escapeHtml(u.nome)}">✕</button>
          ` : ''}
        </div>
      </li>`;
  }).join('');
}

async function alterarTipo(id, novoTipo) {
  const label = novoTipo === 'admin' ? 'promover a Admin' : 'rebaixar para Usuário';
  if (!confirm(`Deseja ${label} este usuário?`)) return;

  try {
    const res = await fetch(`/usuarios/${id}/tipo`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ tipo: novoTipo })
    });
    if (!res.ok) { const d = await res.json(); alert(d.erro); return; }
    await carregarUsuarios();
  } catch {
    alert('Erro de conexão.');
  }
}

async function removerUsuario(id) {
  if (!confirm('Deseja remover este usuário? As movimentações dele serão mantidas.')) return;

  try {
    const res = await fetch(`/usuarios/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) { const d = await res.json(); alert(d.erro); return; }
    await carregarUsuarios();
  } catch {
    alert('Erro de conexão.');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.getElementById('data').valueAsDate = new Date();
carregar();
if (usuario.tipo === 'admin') carregarUsuarios();
