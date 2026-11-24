// =========================================================================
// CONFIGURAÇÃO DE ATUALIZAÇÃO REMOTA (LSP 105)
// =========================================================================
const VERSAO_LOCAL = "1.4";
const URL_CONTROLE_VERSAO = "https://raw.githubusercontent.com/soares4jessica-code/spx-produtividade-lsp105/refs/heads/main/versao.json";

// =========================================================================
// TURNOS E CONFIGURAÇÕES DO LSP 105
// =========================================================================
const INTERVALOS_TURNO = {
  AM: ["02:00", "03:00", "04:00", "05:00"],
  PM: ["08:00", "09:00", "10:00", "11:00"],
  PM2: ["12:00", "13:00", "14:00", "15:00"]
};

const NOMES_TURNOS = {
  TODOS: "Todos os Horários",
  AM: "Turno AM (02:00 - 05:30)",
  PM: "Turno PM (08:00 - 12:00)",
  PM2: "Turno PM 2 (12:00 - 15:30)"
};

const CONFIG_BANCADAS = [
  { id: "b1", nome: "Bancada 1", tipo: "regular", estacoes: [{ id: "e1", label: "Estação 1" }, { id: "e2", label: "Estação 2" }] },
  { id: "b2", nome: "Bancada 2", tipo: "regular", estacoes: [{ id: "e3", label: "Estação 3" }, { id: "e4", label: "Estação 4" }] },
  { id: "b3", nome: "Bancada 3", tipo: "regular", estacoes: [{ id: "e5", label: "Estação 5" }, { id: "e6", label: "Estação 6" }] },
  { id: "b4", nome: "Bancada 4", tipo: "regular", estacoes: [{ id: "e7", label: "Estação 7" }, { id: "e8", label: "Estação 8" }] },
  { id: "b5", nome: "Bancada 5", tipo: "regular", estacoes: [{ id: "e9", label: "Estação 9" }, { id: "e10", label: "Estação 10" }] },
  { id: "b6", nome: "Bancada 6", tipo: "regular", estacoes: [{ id: "e11", label: "Estação 11" }, { id: "e12", label: "Estação 12" }] },
  { id: "bv1", nome: "Volumoso 1", tipo: "volumoso", estacoes: [{ id: "ev1", label: "Estação Volumoso 1" }, { id: "ev2", label: "Estação Volumoso 2" }] },
  { id: "bv2", nome: "Volumoso 2", tipo: "volumoso", estacoes: [{ id: "ev3", label: "Estação Volumoso 3" }, { id: "ev4", label: "Estação Volumoso 4" }] }
];

let turnoSelecionado = "TODOS";
let horarioSelecionado = "TODOS";
let dadosBrutosExtraidos = { ths: [], linhas: [] };
let metaVolumetria = 0;
let escalaEstacoes = {};
let mapaTotaisOperadores = {};
let temaAtual = "light";

function extrairOps(nomeBruto) {
  if (!nomeBruto) return "OPS-00";
  const match = nomeBruto.match(/\[(.*?)\]/);
  if (match && match[1]) return match[1].trim();
  const partes = nomeBruto.trim().split(/\s+/);
  return partes[0] || "OPS";
}

function limparNome(nomeBruto) {
  if (!nomeBruto) return "Desconhecido";
  return nomeBruto.replace(/^\[.*?\]\s*/i, '').replace(/\s+/g, ' ').trim();
}

function aplicarTema(tema) {
  temaAtual = tema;
  const btn = document.getElementById("btn-toggle-theme");
  if (tema === "dark") {
    document.body.classList.add("dark-mode");
    if (btn) btn.innerHTML = "☀️ Claro";
  } else {
    document.body.classList.remove("dark-mode");
    if (btn) btn.innerHTML = "🌙 Escuro";
  }
}

function alternarTema() {
  const novoTema = temaAtual === "dark" ? "light" : "dark";
  aplicarTema(novoTema);
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ app_theme: novoTema });
  }
}

// =========================================================================
// VERIFICADOR DE ATUALIZAÇÃO NO GITHUB
// =========================================================================
async function verificarAtualizacaoRemota() {
  try {
    const resposta = await fetch(`${URL_CONTROLE_VERSAO}?t=${Date.now()}`);
    if (!resposta.ok) return;

    const info = await resposta.json();

    if (info.versao && info.versao !== VERSAO_LOCAL) {
      const banner = document.getElementById("banner-atualizacao");
      const lblVersao = document.getElementById("upd-versao");
      const lblDesc = document.getElementById("upd-descricao");
      const lblArquivo = document.getElementById("upd-arquivo");
      const btnBaixar = document.getElementById("btn-baixar-update");

      if (lblVersao) lblVersao.innerText = `v${info.versao}`;
      if (lblDesc) lblDesc.innerText = info.mensagem || "Nova melhoria disponível";
      if (lblArquivo) lblArquivo.innerText = info.arquivo || "dashboard.js";

      if (btnBaixar && info.url_download) {
        btnBaixar.href = info.url_download;
        btnBaixar.setAttribute("download", info.arquivo || "dashboard.js");
      }

      if (banner) banner.style.display = "flex";
    }
  } catch (e) {
    console.log("[SPX] Verificação de atualização indisponível offline.");
  }
}

// =========================================================================
// LEITURA DA TABELA DO SPX
// =========================================================================
async function sincronizarTabelaProdutividade() {
  const lblTimer = document.getElementById("lbl-timer");
  if (lblTimer) lblTimer.innerText = "Sincronizando...";

  try {
    const tabs = await chrome.tabs.query({});
    const spxTab = tabs.find(t =>
      (t.title && /productiv|produtiv|spx/i.test(t.title)) ||
      (t.url && /shopee|productivity|toproductivity/i.test(t.url))
    );

    if (!spxTab) {
      if (lblTimer) lblTimer.innerText = "⚠️ Abra a aba do SPX";
      return;
    }

    const r = await chrome.scripting.executeScript({
      target: { tabId: spxTab.id },
      func: () => {
        function lerDocumento(doc) {
          // Captura os cabeçalhos da tabela principal (ignorando clones fixos ocultos)
          const ths = Array.from(doc.querySelectorAll(".el-table__header-wrapper th, table thead th"))
            .filter(th => !th.classList.contains("gutter"))
            .map(th => (th.innerText || th.textContent || "").trim());

          const trs = Array.from(doc.querySelectorAll(".el-table__body-wrapper tbody tr, table tbody tr"))
            .filter(tr => !tr.closest(".el-table__fixed") && !tr.closest(".el-table__fixed-right"));

          const linhas = trs.map(tr =>
            Array.from(tr.querySelectorAll("td")).map(td => (td.innerText || td.textContent || "").trim())
          ).filter(linha => linha.length > 0);

          return { ths, linhas };
        }

        let res = lerDocumento(document);

        if (!res.linhas || res.linhas.length === 0) {
          const iframes = document.querySelectorAll("iframe");
          for (let ifr of iframes) {
            try {
              const subDoc = ifr.contentDocument || ifr.contentWindow.document;
              if (subDoc) {
                const subRes = lerDocumento(subDoc);
                if (subRes.linhas && subRes.linhas.length > 0) {
                  res = subRes;
                  break;
                }
              }
            } catch (e) {}
          }
        }

        return res;
      }
    });

    const resultado = r && r[0] ? r[0].result : null;

    if (resultado && resultado.linhas && resultado.linhas.length > 0) {
      dadosBrutosExtraidos = resultado;
      renderizarPainelCompleto();
      if (lblTimer) {
        lblTimer.innerText = `Atualizado às ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }
    } else {
      if (lblTimer) lblTimer.innerText = "⚠️ Tabela sem dados (recarregue o SPX)";
    }
  } catch (err) {
    console.error("[SPX] Erro ao sincronizar:", err);
    if (lblTimer) lblTimer.innerText = "⚠️ Falha ao ler aba (dê F5 no SPX)";
  }
}

function atualizarOpcoesSelectHorario(colunasDoTurno) {
  const selectHorario = document.getElementById("select-horario");
  if (!selectHorario) return;

  const horasDisponiveis = colunasDoTurno.map(c => c.hora);

  if (horarioSelecionado !== "TODOS" && !horasDisponiveis.includes(horarioSelecionado)) {
    horarioSelecionado = "TODOS";
  }

  let htmlOptions = `<option value="TODOS">Todos os horários (${horasDisponiveis.length} faixas)</option>`;
  horasDisponiveis.forEach(h => {
    const selected = h === horarioSelecionado ? "selected" : "";
    let labelHora = `Horário: ${h}`;
    if (turnoSelecionado === "AM" && h === "05:00") labelHora = "Horário: 05:00 (até 05:30)";
    if (turnoSelecionado === "PM2" && h === "15:00") labelHora = "Horário: 15:00 (até 15:30)";
    htmlOptions += `<option value="${h}" ${selected}>${labelHora}</option>`;
  });

  selectHorario.innerHTML = htmlOptions;
}

function atualizarBadgeFiltro() {
  const badge = document.getElementById("badge-resumo-filtro");
  if (!badge) return;

  const nomeTurno = NOMES_TURNOS[turnoSelecionado] || turnoSelecionado;
  if (horarioSelecionado === "TODOS") {
    badge.innerText = `Exibindo: ${nomeTurno}`;
  } else {
    badge.innerText = `Exibindo: ${nomeTurno} • Faixa ${horarioSelecionado}`;
  }
}

function renderizarPainelCompleto() {
  if (!dadosBrutosExtraidos.linhas || dadosBrutosExtraidos.linhas.length === 0) return;

  const ths = dadosBrutosExtraidos.ths || [];
  const linhas = dadosBrutosExtraidos.linhas || [];

  // Procura HH:MM em qualquer lugar do cabeçalho (aceita "12:00", "12:00~13:00", "24/11 12:00", etc.)
  let colunasDetectadas = [];
  const horasVistas = new Set();

  ths.forEach((cabecalho, index) => {
    const match = cabecalho.match(/(\d{2}:\d{2})/);
    if (match && match[1] && !horasVistas.has(match[1])) {
      horasVistas.add(match[1]);
      colunasDetectadas.push({ index, hora: match[1] });
    }
  });

  let colunasDoTurno = colunasDetectadas;
  if (turnoSelecionado !== "TODOS" && INTERVALOS_TURNO[turnoSelecionado]) {
    const horasDoTurno = INTERVALOS_TURNO[turnoSelecionado];
    colunasDoTurno = colunasDetectadas.filter(col => horasDoTurno.includes(col.hora));
  }
  colunasDoTurno.sort((a, b) => a.hora.localeCompare(b.hora));

  atualizarOpcoesSelectHorario(colunasDoTurno);
  atualizarBadgeFiltro();

  let colunasFiltradas = colunasDoTurno;
  if (horarioSelecionado !== "TODOS") {
    colunasFiltradas = colunasDoTurno.filter(col => col.hora === horarioSelecionado);
  }

  const listaHoras = colunasFiltradas.map(c => c.hora);

  const mapaColaboradores = {};
  let totalBipadoPeriodo = 0;

  linhas.forEach(linha => {
    // Procura a célula que contém o nome/OPS do operador (evita pegar coluna de número de linha)
    let operadorBruto = linha.find(cel => /\[.*\]|[a-zA-ZÀ-ÿ]{3,}/.test(cel)) || linha[1] || linha[0];
    if (!operadorBruto || /total|soma/i.test(operadorBruto)) return;

    const nome = limparNome(operadorBruto);
    const opsReal = extrairOps(operadorBruto);

    if (!mapaColaboradores[nome]) {
      mapaColaboradores[nome] = {
        nome: nome,
        ops: opsReal,
        horas: {},
        totalGeral: 0
      };
      listaHoras.forEach(h => mapaColaboradores[nome].horas[h] = 0);
    }

    colunasFiltradas.forEach(col => {
      const valorTexto = linha[col.index] || "0";
      const qtd = parseInt(valorTexto.replace(/\D/g, ''), 10) || 0;
      mapaColaboradores[nome].horas[col.hora] = (mapaColaboradores[nome].horas[col.hora] || 0) + qtd;
      mapaColaboradores[nome].totalGeral += qtd;
      totalBipadoPeriodo += qtd;
    });
  });

  const ranking = [];
  mapaTotaisOperadores = {};
  const listaNomesOperadores = Object.keys(mapaColaboradores);

  listaNomesOperadores.forEach(nome => {
    const op = mapaColaboradores[nome];
    mapaTotaisOperadores[nome] = op.totalGeral;

    if (op.totalGeral > 0) {
      ranking.push(op);
    }
  });

  ranking.sort((a, b) => b.totalGeral - a.totalGeral);
  listaNomesOperadores.sort((a, b) => a.localeCompare(b));

  desenharTabela(ranking, listaHoras);
  atualizarCardVolumetria(totalBipadoPeriodo);
  renderizarBancadas(listaNomesOperadores);

  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      tv_dados_ranking: ranking,
      tv_horas: listaHoras,
      tv_meta: metaVolumetria,
      tv_total_bipado: totalBipadoPeriodo
    });
  }
}

function renderizarBancadas(listaNomes) {
  const container = document.getElementById("container-bancadas");
  if (!container) return;

  container.innerHTML = "";

  CONFIG_BANCADAS.forEach(bancada => {
    let totalBancada = 0;

    bancada.estacoes.forEach(estacao => {
      const nomeSelecionado = escalaEstacoes[estacao.id] || "";
      if (nomeSelecionado && mapaTotaisOperadores[nomeSelecionado]) {
        totalBancada += mapaTotaisOperadores[nomeSelecionado];
      }
    });

    const card = document.createElement("div");
    card.className = `bancada-card ${bancada.tipo === 'volumoso' ? 'volumoso' : ''}`;

    let htmlEstacoes = "";
    bancada.estacoes.forEach(estacao => {
      const opAtual = escalaEstacoes[estacao.id] || "";
      const totalOp = opAtual && mapaTotaisOperadores[opAtual] ? mapaTotaisOperadores[opAtual] : 0;

      let optionsHtml = `<option value="">-- Selecione Operador --</option>`;
      listaNomes.forEach(nome => {
        const isSelected = nome === opAtual ? "selected" : "";
        optionsHtml += `<option value="${nome}" ${isSelected}>${nome}</option>`;
      });

      htmlEstacoes += `
        <div class="estacao-bloco">
          <div class="estacao-header">
            <span>${estacao.label}</span>
            <span class="estacao-valor">${totalOp.toLocaleString("pt-BR")} pcs</span>
          </div>
          <select class="select-operador" data-estacao-id="${estacao.id}">
            ${optionsHtml}
          </select>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="bancada-topo">
        <span class="bancada-topo-nome">${bancada.nome}</span>
        <span class="bancada-total-badge">${totalBancada.toLocaleString("pt-BR")} pcs</span>
      </div>
      ${htmlEstacoes}
    `;

    container.appendChild(card);
  });

  container.querySelectorAll(".select-operador").forEach(select => {
    select.onchange = (e) => {
      const estacaoId = e.target.getAttribute("data-estacao-id");
      const nomeEscolhido = e.target.value;
      escalaEstacoes[estacaoId] = nomeEscolhido;

      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ escalaEstacoes: escalaEstacoes }, () => {
          renderizarPainelCompleto();
        });
      }
    };
  });
}

function desenharTabela(ranking, listaHoras) {
  const theadTr = document.getElementById("header-colunas");
  const tbody = document.getElementById("linhas-tabela");

  if (!theadTr || !tbody) return;

  let htmlTh = `<th style="width: 70px;">Posição</th><th class="col-colaborador">Colaborador</th>`;
  listaHoras.forEach(h => {
    htmlTh += `<th>${h}</th>`;
  });
  htmlTh += `<th class="col-total">Total Filtrado</th>`;
  theadTr.innerHTML = htmlTh;

  if (listaHoras.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding: 40px; color: var(--text-muted);">Nenhuma coluna de horário encontrada para o filtro selecionado.</td></tr>`;
    return;
  }

  if (ranking.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${listaHoras.length + 3}" style="padding: 40px; color: var(--text-muted);">Nenhum operador com bipagens ativas (> 0) neste período até ao momento.</td></tr>`;
    return;
  }

  let htmlTr = "";
  ranking.forEach((item, index) => {
    let badgeHtml = `<span class="pos-default">#${index + 1}</span>`;
    if (index === 0) badgeHtml = `<span class="pos-badge pos-1">🥇 1</span>`;
    else if (index === 1) badgeHtml = `<span class="pos-badge pos-2">🥈 2</span>`;
    else if (index === 2) badgeHtml = `<span class="pos-badge pos-3">🥉 3</span>`;

    htmlTr += `
      <tr>
        <td>${badgeHtml}</td>
        <td class="col-colaborador">${item.nome}</td>
    `;

    listaHoras.forEach(h => {
      const v = item.horas[h] || 0;
      htmlTr += `<td>${v > 0 ? v.toLocaleString("pt-BR") : '-'}</td>`;
    });

    htmlTr += `<td class="col-total">${item.totalGeral.toLocaleString("pt-BR")}</td></tr>`;
  });

  tbody.innerHTML = htmlTr;
}

function atualizarCardVolumetria(totalBipado) {
  const valBipado = document.getElementById("val-bipado");
  const valMetaKpi = document.getElementById("val-meta-kpi");
  const valFalta = document.getElementById("val-falta");
  const valPorcentagem = document.getElementById("val-porcentagem");
  const progressBar = document.getElementById("progress-bar-fill");

  if (valBipado) valBipado.innerText = totalBipado.toLocaleString("pt-BR");
  if (valMetaKpi) valMetaKpi.innerText = metaVolumetria.toLocaleString("pt-BR");

  if (metaVolumetria > 0) {
    const falta = Math.max(0, metaVolumetria - totalBipado);
    let textoPct = "";

    if (totalBipado >= metaVolumetria) {
      textoPct = "100%";
      if (progressBar) progressBar.style.width = "100%";
    } else {
      const pctReal = (totalBipado / metaVolumetria) * 100;
      const pctFormatada = Math.min(99.9, pctReal).toFixed(1).replace(".", ",");
      textoPct = `${pctFormatada}%`;
      if (progressBar) progressBar.style.width = `${Math.min(99, Math.floor(pctReal))}%`;
    }

    if (valFalta) valFalta.innerText = falta.toLocaleString("pt-BR");
    if (valPorcentagem) valPorcentagem.innerText = textoPct;
  } else {
    if (valFalta) valFalta.innerText = "Sem meta";
    if (valPorcentagem) valPorcentagem.innerText = "--%";
    if (progressBar) progressBar.style.width = "0%";
  }
}

function gerenciarHorarioCorte() {
  const agora = new Date();
  const minutos = agora.getMinutes();
  const segundos = agora.getSeconds();

  if (minutos === 5 && segundos <= 2) {
    sincronizarTabelaProdutividade();
  }

  let proximaHora = agora.getHours();
  if (minutos >= 5) {
    proximaHora = (proximaHora + 1) % 24;
  }
  const strProx = `${String(proximaHora).padStart(2, '0')}:05`;
  const lblProx = document.getElementById("lbl-proxima-hora");
  if (lblProx) lblProx.innerText = `Próximo corte: ${strProx}`;
}

function carregarMetaDoTurno(turno) {
  const inputMeta = document.getElementById("input-meta");
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([`meta_${turno}`, 'escalaEstacoes'], (res) => {
      metaVolumetria = parseInt(res[`meta_${turno}`], 10) || 0;
      escalaEstacoes = res.escalaEstacoes || {};
      if (inputMeta) inputMeta.value = metaVolumetria > 0 ? metaVolumetria : "";
      renderizarPainelCompleto();
    });
  }
}

function inicializarPainel() {
  const btnAtualizar = document.getElementById("btn-atualizar-agora");
  if (btnAtualizar) {
    btnAtualizar.onclick = () => {
      sincronizarTabelaProdutividade();
      verificarAtualizacaoRemota();
    };
  }

  const btnTv = document.getElementById("btn-abrir-tv");
  if (btnTv) {
    btnTv.onclick = () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("tv.html") });
    };
  }

  const btnTheme = document.getElementById("btn-toggle-theme");
  if (btnTheme) {
    btnTheme.onclick = () => alternarTema();
  }

  const btnFecharUpdate = document.getElementById("btn-fechar-update");
  if (btnFecharUpdate) {
    btnFecharUpdate.onclick = () => {
      const banner = document.getElementById("banner-atualizacao");
      if (banner) banner.style.display = "none";
    };
  }

  const botoesTurno = document.querySelectorAll(".btn-turno");
  botoesTurno.forEach(btn => {
    btn.onclick = () => {
      botoesTurno.forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      turnoSelecionado = btn.getAttribute("data-turno");
      horarioSelecionado = "TODOS";
      carregarMetaDoTurno(turnoSelecionado);
    };
  });

  const selectHorario = document.getElementById("select-horario");
  if (selectHorario) {
    selectHorario.onchange = (e) => {
      horarioSelecionado = e.target.value;
      renderizarPainelCompleto();
    };
  }

  const inputMeta = document.getElementById("input-meta");
  if (inputMeta) {
    inputMeta.oninput = (e) => {
      metaVolumetria = parseInt(e.target.value, 10) || 0;
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [`meta_${turnoSelecionado}`]: metaVolumetria });
      }
      renderizarPainelCompleto();
    };
  }

  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['app_theme'], (res) => {
      aplicarTema(res.app_theme || "light");
    });
  }

  carregarMetaDoTurno("TODOS");
  sincronizarTabelaProdutividade();
  verificarAtualizacaoRemota();

  setInterval(gerenciarHorarioCorte, 1000);
  setInterval(sincronizarTabelaProdutividade, 180000);
  setInterval(verificarAtualizacaoRemota, 600000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarPainel);
} else {
  inicializarPainel();
}
