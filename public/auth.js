// Redireciona se já estiver logado
if (localStorage.getItem('token')) {
  window.location.href = '/index.html';
}

function trocarAba(aba) {
  document.getElementById('form-login').style.display   = aba === 'login'    ? '' : 'none';
  document.getElementById('form-cadastro').style.display = aba === 'cadastro' ? '' : 'none';
  document.getElementById('aba-login').classList.toggle('ativa', aba === 'login');
  document.getElementById('aba-cadastro').classList.toggle('ativa', aba === 'cadastro');
  document.getElementById('aba-login').setAttribute('aria-selected', aba === 'login');
  document.getElementById('aba-cadastro').setAttribute('aria-selected', aba === 'cadastro');
}

function mostrarFeedback(id, msg, tipo) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = `feedback ${tipo}`;
}

// Login
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json();

    if (!res.ok) {
      mostrarFeedback('feedback-login', data.erro, 'erro');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    window.location.href = '/index.html';
  } catch {
    mostrarFeedback('feedback-login', 'Erro de conexão.', 'erro');
  }
});

// Cadastro
document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome  = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;

  try {
    const res = await fetch('/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });
    const data = await res.json();

    if (!res.ok) {
      mostrarFeedback('feedback-cadastro', data.erro, 'erro');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    window.location.href = '/index.html';
  } catch {
    mostrarFeedback('feedback-cadastro', 'Erro de conexão.', 'erro');
  }
});
