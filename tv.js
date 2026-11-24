let temaTVAtual = "dark";
let telaAtiva = 1;
let segundosRestantes = 60;
let intervaloRotacao = null;

// Relógio em tempo real
function atualizarRelogio() {
  const el = document.getElementById("tv-relogio");
  if (el) el.innerText = new Date().toLocaleTimeString("pt-BR");
}
setInterval(atualizarRelogio, 1000);
atualizarRelogio();

// 1. ALTERNÂNCIA DE TELAS (Automática ou Manual)
function alternarTela(telaEscolhida) {
  if (telaEscolhida !== undefined) {
    telaAtiva = telaEscolhida;
  } else {
    telaAtiva = telaAtiva === 1 ? 2 : 1;
  }

  const screenMeta = document.getElementById("screen-meta");
  const screenRanking = document.getElementById("screen-ranking");
  const tabMeta = document.getElementById("tab-meta");
  const tabRanking = document.getElementById("tab-ranking");

  if (telaAtiva === 1) {
    if (screenRanking) screenRanking.classList.remove("active");
    if (screenMeta) screenMeta.classList.add("active");
    if (tabRanking) tabRanking.classList.remove("active");
    if (tabMeta) tabMeta.classList.add("active");
  } else {
    if (screenMeta) screenMeta.classList.remove("active");
    if (screenRanking) screenRanking.classList.add("active");
    if (tabMeta) tabMeta.classList.remove("active");
    if (tabRanking) tabRanking.classList.add("active");
  }

  segundosRestantes = 60;
  atualizarIndicadorTempo();
}

function atualizarIndicadorTempo() {
  const el = document.getElementById("tv-tempo-troca");
  if (el) el.innerText = `Próxima troca em: ${segundosRestantes}s`;
}

function iniciarTemporizadorRotacao() {
  if (intervaloRotacao) clearInterval(intervaloRotacao);

  intervaloRotacao = setInterval(() => {
    segundosRestantes--;
    if (segundosRestantes <= 0) {
      alternarTela();
    } else {
      atualizarIndicadorTempo();
    }
  }, 1000);
}

// 2. CONTROLE DO MODO CLARO / ESCURO
function aplicarTemaTV(tema) {
  temaTVAtual = tema;
  const btn = document.getElementById("btn-tv-theme");
  if (tema === "light") {
    document.body.classList.add("light-mode");
    if (btn) btn.innerHTML = "🌙 Escuro";
  } else {
    document.body.classList.remove("light-mode");
    if (btn) btn.innerHTML = "☀️ Claro";
  }
}

function alternarTemaTV() {
  const novoTema = temaTVAtual === "light" ? "dark" : "light";
  aplicarTemaTV(novoTema);
  chrome.storage.local.set({ app_theme: novoTema });
}

// Extrai somente o primeiro nome limpo
function pegarPrimeiroNome(nomeCompleto) {
  if (!nomeCompleto) return "Operador";
  const partes = nomeCompleto.trim().split(/\s+/);
  return partes[0] || "Operador";
}

// 3. RENDERIZAÇÃO DOS DADOS
function renderizarTelaTV() {
  chrome.storage.local.get(['tv_dados_ranking', 'tv_meta', 'tv_total_bipado', 'app_theme'], (res) => {
    if (res.app_theme) {
      aplicarTemaTV(res.app_theme);
    }

    const ranking = Array.isArray(res.tv_dados_ranking) ? res.tv_dados_ranking : [];
    const meta = parseInt(res.tv_meta, 10) || 0;
    const totalBipado = parseInt(res.tv_total_bipado, 10) || 0;

    // TELA 1: KPIs
    const elBipado = document.getElementById("tv-bipado");
    const elMeta = document.getElementById("tv-meta");
    const elFalta = document.getElementById("tv-falta");
    const elPct = document.getElementById("tv-porcentagem");
    const elBar = document.getElementById("tv-progresso-bar");

    if (elBipado) elBipado.innerText = totalBipado.toLocaleString("pt-BR");
    if (elMeta) elMeta.innerText = meta.toLocaleString("pt-BR");

    if (meta > 0) {
      const falta = Math.max(0, meta - totalBipado);
      const pct = Math.min(100, Math.round((totalBipado / meta) * 100));
      if (elFalta) elFalta.innerText = falta.toLocaleString("pt-BR");
      if (elPct) elPct.innerText = `${pct}%`;
      if (elBar) elBar.style.width = `${pct}%`;
    } else {
      if (elFalta) elFalta.innerText = "--";
      if (elPct) elPct.innerText = "--%";
      if (elBar) elBar.style.width = "0%";
    }

    // TELA 2: TOP 6 CARDS
    const containerTop6 = document.getElementById("container-top6");
    if (containerTop6) {
      containerTop6.innerHTML = "";

      const top6 = ranking.slice(0, 6);

      if (top6.length === 0) {
        containerTop6.innerHTML = `
          <div style="grid-column: 1 / -1; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:24px; color:var(--text-muted); font-weight:700; gap:12px;">
            <span>Aguardando bipagens (> 0)...</span>
            <span style="font-size:16px; font-weight:500;">Abra o painel principal e clique em "Sincronizar"</span>
          </div>
        `;
      } else {
        top6.forEach((item, index) => {
          let medalha = `#${index + 1}`;
          let classePos = "";

          if (index === 0) { medalha = "🥇"; classePos = "pos-1"; }
          else if (index === 1) { medalha = "🥈"; classePos = "pos-2"; }
          else if (index === 2) { medalha = "🥉"; classePos = "pos-3"; }

          const primeiroNome = pegarPrimeiroNome(item.nome);
          const opsTag = item.ops ? `(${item.ops})` : "";
          const totalVal = item.totalGeral || 0;

          const card = document.createElement("div");
          card.className = `top6-card ${classePos}`;
          card.innerHTML = `
            <span class="pos-medal">${medalha}</span>
            <div class="top6-card-body">
              <div class="top6-header-line">
                <span class="top6-nome">${primeiroNome}</span>
                ${opsTag ? `<span class="top6-ops-micro">${opsTag}</span>` : ''}
              </div>
              <div class="top6-bottom-line">
                <span class="top6-total-val">${totalVal.toLocaleString("pt-BR")}</span>
                <span class="top6-total-pcs">peças</span>
              </div>
            </div>
          `;
          containerTop6.appendChild(card);
        });

        // Preenche vagas restantes se tiver menos de 6
        for (let i = top6.length; i < 6; i++) {
          const cardVazio = document.createElement("div");
          cardVazio.className = "top6-card";
          cardVazio.style.opacity = "0.35";
          cardVazio.style.borderStyle = "dashed";
          cardVazio.innerHTML = `
            <span class="pos-medal" style="color:var(--text-muted);">#${i + 1}</span>
            <div class="top6-card-body">
              <div class="top6-header-line">
                <span class="top6-nome" style="color:var(--text-muted);">Disponível</span>
              </div>
              <div class="top6-bottom-line">
                <span class="top6-total-val" style="color:var(--text-muted);">--</span>
                <span class="top6-total-pcs">aguardando</span>
              </div>
            </div>
          `;
          containerTop6.appendChild(cardVazio);
        }
      }
    }

    const elStatus = document.getElementById("tv-status-txt");
    if (elStatus) {
      elStatus.innerText = `Atualizado às ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  });
}

// Ouve atualizações de dados ou tema vindas da extensão em tempo real
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.app_theme) aplicarTemaTV(changes.app_theme.newValue);
    if (changes.tv_dados_ranking || changes.tv_total_bipado || changes.tv_meta) {
      renderizarTelaTV();
    }
  }
});

// Inicialização segura
function inicializarTV() {
  const btnTheme = document.getElementById("btn-tv-theme");
  if (btnTheme) {
    btnTheme.addEventListener("click", alternarTemaTV);
  }

  const tabMeta = document.getElementById("tab-meta");
  const tabRanking = document.getElementById("tab-ranking");
  if (tabMeta) {
    tabMeta.addEventListener("click", () => alternarTela(1));
  }
  if (tabRanking) {
    tabRanking.addEventListener("click", () => alternarTela(2));
  }

  chrome.storage.local.get(['app_theme'], (res) => {
    aplicarTemaTV(res.app_theme || "dark");
    renderizarTelaTV();
  });

  iniciarTemporizadorRotacao();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarTV);
} else {
  inicializarTV();
}