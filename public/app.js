const form = document.getElementById('form-movimentacao');
const feedback = document.getElementById('feedback');
const lista = document.getElementById('lista-movimentacoes');

// Formata valor para BRL
function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formata data ISO para dd/mm/aaaa
function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Exibe mensagem de feedback temporária
function mostrarFeedback(msg, tipo) {
  feedback.textContent = msg;
  feedback.className = `feedback ${tipo}`;
  setTimeout(() => { feedback.textContent = ''; feedback.className = 'feedback'; }, 3000);
}

// Atualiza os cards de resumo
function atualizarResumo(resumo) {
  document.getElementById('saldo').textContent = formatarMoeda(resumo.saldo);
  document.getElementById('total-entradas').textContent = formatarMoeda(resumo.entradas);
  document.getElementById('total-saidas').textContent = formatarMoeda(resumo.saidas);

  const saldoEl = document.getElementById('saldo');
  saldoEl.style.color = resumo.saldo >= 0 ? 'var(--azul)' : 'var(--vermelho)';
}

// Renderiza a lista de movimentações
function renderizarLista(movimentacoes) {
  if (movimentacoes.length === 0) {
    lista.innerHTML = '<li class="vazio">Nenhuma movimentação registrada.</li>';
    return;
  }

  lista.innerHTML = movimentacoes.map(m => `
    <li class="item ${m.tipo}" data-id="${m.id}">
      <div class="item-info">
        <div class="item-descricao">${escapeHtml(m.descricao)}</div>
        <div class="item-data">${formatarData(m.data)}</div>
      </div>
      <span class="item-valor">${m.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(m.valor)}</span>
      <button class="btn-remover" onclick="remover(${m.id})" aria-label="Remover ${escapeHtml(m.descricao)}">✕</button>
    </li>
  `).join('');
}

// Previne XSS básico
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Carrega dados da API
async function carregar() {
  try {
    const res = await fetch('/movimentacoes');
    const data = await res.json();
    atualizarResumo(data.resumo);
    renderizarLista(data.movimentacoes);
  } catch {
    mostrarFeedback('Erro ao carregar movimentações.', 'erro');
  }
}

// Submete nova movimentação
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const descricao = document.getElementById('descricao').value.trim();
  const valor = parseFloat(document.getElementById('valor').value);
  const data = document.getElementById('data').value;
  const tipo = document.getElementById('tipo').value;

  if (!descricao || !valor || !data || !tipo) {
    mostrarFeedback('Preencha todos os campos.', 'erro');
    return;
  }

  try {
    const res = await fetch('/movimentacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao, valor, data, tipo })
    });

    const data_res = await res.json();

    if (!res.ok) {
      mostrarFeedback(data_res.erro || 'Erro ao salvar.', 'erro');
      return;
    }

    mostrarFeedback('Movimentação adicionada com sucesso!', 'sucesso');
    form.reset();
    await carregar();
  } catch {
    mostrarFeedback('Erro de conexão com o servidor.', 'erro');
  }
});

// Remove uma movimentação
async function remover(id) {
  if (!confirm('Deseja remover esta movimentação?')) return;

  try {
    const res = await fetch(`/movimentacoes/${id}`, { method: 'DELETE' });

    if (!res.ok) {
      mostrarFeedback('Erro ao remover.', 'erro');
      return;
    }

    await carregar();
  } catch {
    mostrarFeedback('Erro de conexão com o servidor.', 'erro');
  }
}

// Define data de hoje como padrão no campo data
document.getElementById('data').valueAsDate = new Date();

// Carrega ao iniciar
carregar();
