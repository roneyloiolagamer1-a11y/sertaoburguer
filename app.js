(function () {
  "use strict";

  var LOJA = window.LOJA || {};
  var CARDAPIO = Array.isArray(window.CARDAPIO) ? window.CARDAPIO : [];

  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var DIAS_TITULO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  var CHAVE_SACOLA = "sb-sacola-v1";
  var CHAVE_CLIENTE = "sb-cliente-v1";
  var VALIDADE_SACOLA_MS = 12 * 60 * 60 * 1000;
  var QTD_MAX = 50;

  /* ---------- Utilidades ---------- */

  function $(id) { return document.getElementById(id); }

  // Cria elementos sem innerHTML: todo texto entra como textContent (evita XSS).
  function el(tag, attrs, filhos) {
    var no = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "texto") no.textContent = v;
        else if (k === "classe") no.className = v;
        else if (k.slice(0, 2) === "on") no.addEventListener(k.slice(2), v);
        else no.setAttribute(k, v === true ? "" : v);
      });
    }
    (filhos || []).forEach(function (f) {
      if (f === null || f === undefined || f === false) return;
      no.appendChild(typeof f === "string" ? document.createTextNode(f) : f);
    });
    return no;
  }

  function svg(caminhos, classe) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    if (classe) s.setAttribute("class", classe);
    caminhos.forEach(function (d) {
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", d);
      s.appendChild(p);
    });
    return s;
  }

  var formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function reais(v) { return formatoMoeda.format(v).replace(/ /g, " "); }

  function normalizar(t) {
    return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  // Remove caracteres de controle e espaços repetidos de textos digitados.
  function limpar(t, max) {
    return String(t || "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function lerArmazenado(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || "null"); } catch (e) { return null; }
  }
  function salvarArmazenado(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* modo privado */ }
  }

  var temporizadorToast;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("visivel");
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(function () { t.classList.remove("visivel"); }, 2200);
  }

  function linkWhats(texto) {
    var url = "https://api.whatsapp.com/send?phone=" + encodeURIComponent(LOJA.whatsapp || "");
    return texto ? url + "&text=" + encodeURIComponent(texto) : url;
  }

  /* ---------- Dados do cardápio (validados) ---------- */

  var produtos = {};      // id -> produto
  var categorias = [];    // categorias com produtos válidos

  CARDAPIO.forEach(function (cat) {
    if (!cat || !cat.id || !cat.nome || !Array.isArray(cat.produtos)) return;
    var lista = cat.produtos.filter(function (p) {
      var ok = p && p.id && p.nome && typeof p.preco === "number" && isFinite(p.preco) && p.preco >= 0 && !produtos[p.id];
      if (!ok) console.warn("Produto ignorado (dados incompletos ou id repetido):", p);
      else produtos[p.id] = p;
      return ok;
    });
    if (lista.length) categorias.push({ id: String(cat.id), nome: cat.nome, descricao: cat.descricao, produtos: lista });
  });

  /* ---------- Horário de funcionamento ---------- */

  function paraMinutos(hhmm) {
    var p = String(hhmm).split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1] || "0", 10);
  }

  function formatarHora(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + "h" + (m ? String(m).padStart(2, "0") : "");
  }

  // Dia da semana e minutos do dia no fuso da loja (independe do fuso do celular).
  function agoraNaLoja(data) {
    data = data || new Date();
    try {
      var partes = new Intl.DateTimeFormat("en-US", {
        timeZone: LOJA.fusoHorario || "America/Fortaleza",
        weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(data);
      var v = {};
      partes.forEach(function (p) { v[p.type] = p.value; });
      var dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v.weekday);
      return { dia: dia, minutos: (parseInt(v.hour, 10) % 24) * 60 + parseInt(v.minute, 10) };
    } catch (e) {
      return { dia: data.getDay(), minutos: data.getHours() * 60 + data.getMinutes() };
    }
  }

  function horarioDoDia(dia) {
    var h = (LOJA.horarios || {})[dia];
    return h ? { abre: paraMinutos(h.abre), fecha: paraMinutos(h.fecha) } : null;
  }

  // Retorna { aberto, estado: "aberto" | "alerta" | "fechado", texto, proxima }
  function calcularStatus(agora) {
    var hoje = horarioDoDia(agora.dia);
    var m = agora.minutos;

    if (hoje && m >= hoje.abre && m < hoje.fecha) {
      var resta = hoje.fecha - m;
      if (resta <= 30) return { aberto: true, estado: "alerta", texto: "Aberto · fecha em " + resta + " min" };
      return { aberto: true, estado: "aberto", texto: "Aberto agora · até as " + formatarHora(hoje.fecha) };
    }

    if (hoje && m < hoje.abre) {
      var falta = hoje.abre - m;
      var proximaHoje = "hoje às " + formatarHora(hoje.abre);
      if (falta <= 60) return { aberto: false, estado: "alerta", texto: "Fechado · abre em " + falta + " min", proxima: proximaHoje };
      return { aberto: false, estado: "fechado", texto: "Fechado · abre " + proximaHoje, proxima: proximaHoje };
    }

    for (var d = 1; d <= 7; d++) {
      var dia = (agora.dia + d) % 7;
      var h = horarioDoDia(dia);
      if (!h) continue;
      var quando = d === 1 ? "amanhã" : d === 7 ? DIAS[dia] + " que vem" : DIAS[dia];
      var proxima = quando + " às " + formatarHora(h.abre);
      return { aberto: false, estado: "fechado", texto: "Fechado · abre " + proxima, proxima: proxima };
    }
    return { aberto: false, estado: "fechado", texto: "Fechado no momento" };
  }

  var statusAtual = { aberto: false };

  function atualizarStatus() {
    var agora = agoraNaLoja();
    statusAtual = calcularStatus(agora);

    $("status").setAttribute("data-estado", statusAtual.estado);
    $("status-texto").textContent = statusAtual.texto;

    var caixa = $("info-status");
    caixa.replaceChildren(el("span", { classe: "status", "data-estado": statusAtual.estado }, [
      el("span", { classe: "status-ponto", "aria-hidden": "true" }),
      el("span", { texto: statusAtual.texto })
    ]));

    var itens = $("lista-horarios").children;
    for (var i = 0; i < itens.length; i++) {
      itens[i].classList.toggle("hoje", Number(itens[i].getAttribute("data-dia")) === agora.dia);
    }
    atualizarBotaoEnviar();
  }

  function montarHorarios() {
    var lista = $("lista-horarios");
    [1, 2, 3, 4, 5, 6, 0].forEach(function (dia) {
      var h = horarioDoDia(dia);
      lista.appendChild(el("li", { "data-dia": dia, classe: h ? "" : "fechado-dia" }, [
        el("span", { texto: DIAS_TITULO[dia] }),
        el("span", { texto: h ? formatarHora(h.abre) + " às " + formatarHora(h.fecha) : "Fechado" })
      ]));
    });
  }

  /* ---------- Informações da loja ---------- */

  function montarInformacoes() {
    var cidade = LOJA.cidade || "";
    var raio = LOJA.raioEntregaKm;
    $("topo-cidade").textContent = cidade;
    $("topo-raio").textContent = raio ? "Entrega até " + raio + " km" : "";

    var enderecoCompleto = [LOJA.endereco, LOJA.bairro, cidade].filter(Boolean).join(" – ");
    $("rodape-endereco").textContent = enderecoCompleto;

    var entrega = $("info-entrega");
    if (raio) entrega.appendChild(el("li", null, ["Fazemos entrega num raio de ", el("strong", { texto: raio + " km" }), " do nosso endereço."]));
    entrega.appendChild(el("li", { texto: "Taxa de entrega: " + reais(LOJA.taxaEntrega || 0) }));
    entrega.appendChild(el("li", { texto: "Retirada no local sem taxa." }));

    var end = $("info-endereco");
    end.appendChild(el("li", { texto: enderecoCompleto }));
    if (LOJA.referencia) end.appendChild(el("li", { texto: "Ponto de referência: " + LOJA.referencia }));

    var pag = $("info-pagamento");
    var formas = (LOJA.pagamentos || []).slice();
    if (formas.length) {
      var txt = formas.length > 1 ? formas.slice(0, -1).join(", ") + " e " + formas[formas.length - 1].toLowerCase() : formas[0];
      pag.appendChild(el("li", { texto: "Aceitamos " + txt.toLowerCase().replace(/^pix/, "Pix") + "." }));
    }
    if (LOJA.levaMaquinaCartao) pag.appendChild(el("li", { texto: "Levamos máquina de cartão até você." }));

    var msg = "Olá, " + (LOJA.nome || "") + "! Vim pelo cardápio digital.";
    $("info-whats").href = linkWhats(msg);
    $("rodape-whats").href = linkWhats(msg);
    if (LOJA.telefoneExibicao) $("info-whats").setAttribute("aria-label", "Chamar no WhatsApp " + LOJA.telefoneExibicao);

    $("opcao-taxa").textContent = "+ " + reais(LOJA.taxaEntrega || 0);
    $("dica-raio").textContent = raio ? "Entregamos num raio de " + raio + " km da loja (" + (LOJA.endereco || "") + ")." : "";
  }

  /* ---------- Renderização do cardápio ---------- */

  var estado = { busca: "", ordem: "padrao", recolhidas: {} };

  function midia(p) {
    var caixa = el("div", { classe: "card-midia" });
    if (p.foto) {
      caixa.appendChild(el("img", { src: p.foto, alt: "", loading: "lazy", decoding: "async", width: 112, height: 112 }));
    } else {
      caixa.appendChild(el("div", { classe: "placeholder", "aria-hidden": "true" }));
    }
    return caixa;
  }

  function botaoMais(p) {
    return el("button", {
      classe: "card-mais", type: "button", "aria-label": "Adicionar " + p.nome + " à sacola",
      onclick: function (e) { e.stopPropagation(); adicionar(p.id, 1, ""); }
    }, [svg(["M12 5v14M5 12h14"])]);
  }

  function seloInfo(p) {
    if (p.esgotado) return el("span", { classe: "selo selo-esgotado", texto: "Esgotado" });
    if (p.exemplo) return el("span", { classe: "selo selo-exemplo", texto: "Exemplo" });
    return null;
  }

  function card(p) {
    var nome = el("h3", { classe: "card-nome" }, [
      el("button", { type: "button", onclick: function () { abrirProduto(p.id); } }, [
        p.codigo ? el("span", { classe: "codigo", texto: p.codigo }) : null,
        p.nome
      ])
    ]);
    // Sem foto: card compacto, com o botão "+" ao lado do preço.
    var m = p.foto ? midia(p) : null;
    var mais = p.esgotado ? null : botaoMais(p);
    if (m && mais) m.appendChild(mais);
    var classe = "card" + (p.foto ? "" : " card-sem-foto") + (p.esgotado ? " esgotado" : "");
    return el("article", { classe: classe }, [
      el("div", { classe: "card-texto" }, [
        nome,
        p.descricao ? el("p", { classe: "card-desc", texto: p.descricao }) : null,
        el("div", { classe: "card-rodape" }, [el("span", { classe: "preco", texto: reais(p.preco) }), seloInfo(p), m ? null : mais])
      ]),
      m
    ]);
  }

  function ordenar(lista) {
    var copia = lista.slice();
    if (estado.ordem === "menor") copia.sort(function (a, b) { return a.preco - b.preco; });
    else if (estado.ordem === "maior") copia.sort(function (a, b) { return b.preco - a.preco; });
    else if (estado.ordem === "nome") copia.sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
    return copia;
  }

  function combina(p, termo) {
    return !termo || normalizar(p.nome + " " + (p.descricao || "") + " " + (p.codigo || "")).indexOf(termo) !== -1;
  }

  // Separa os produtos pelo campo "grupo" (subtítulo), mantendo a ordem em que aparecem.
  function agruparPorGrupo(lista) {
    var grupos = [];
    lista.forEach(function (p) {
      var nome = p.grupo || "";
      var g = grupos.find(function (x) { return x.nome === nome; });
      if (!g) grupos.push(g = { nome: nome, itens: [] });
      g.itens.push(p);
    });
    var blocos = [];
    grupos.forEach(function (g) {
      if (g.nome) blocos.push(el("h3", { classe: "subgrupo", texto: g.nome }));
      var semFotos = g.itens.every(function (p) { return !p.foto; });
      blocos.push(el("div", { classe: "grade" + (semFotos ? " grade-compacta" : "") }, g.itens.map(card)));
    });
    return blocos;
  }

  function renderizar() {
    var termo = normalizar(estado.busca);
    var secoes = $("secoes");
    var nav = $("categorias-lista");
    var menu = $("menu-lista");
    var visiveis = 0;
    secoes.replaceChildren();
    nav.replaceChildren();
    menu.replaceChildren();

    categorias.forEach(function (c) {
      var lista = ordenar(c.produtos.filter(function (p) { return combina(p, termo); }));
      if (!lista.length) return;
      visiveis += lista.length;

      var aberta = termo ? true : !estado.recolhidas[c.id];
      var idConteudo = "conteudo-" + c.id;
      var cabeca = el("button", {
        classe: "secao-cabeca", type: "button", "aria-expanded": String(aberta), "aria-controls": idConteudo,
        onclick: function () {
          var nova = cabeca.getAttribute("aria-expanded") !== "true";
          cabeca.setAttribute("aria-expanded", String(nova));
          conteudo.hidden = !nova;
          if (nova) delete estado.recolhidas[c.id]; else estado.recolhidas[c.id] = true;
        }
      }, [svg(["M6 9l6 6 6-6"], "seta"), el("span", { texto: c.nome })]);

      var conteudo = el("div", { classe: "secao-conteudo", id: idConteudo }, agruparPorGrupo(lista));
      conteudo.hidden = !aberta;

      secoes.appendChild(el("section", { classe: "secao", id: "cat-" + c.id, "aria-label": c.nome }, [
        el("h2", { classe: "secao-titulo" }, [cabeca]),
        c.descricao ? el("p", { classe: "secao-desc", texto: c.descricao }) : null,
        conteudo
      ]));

      nav.appendChild(el("li", null, [el("a", { href: "#cat-" + c.id, "data-cat": c.id, texto: c.nome, onclick: irPara })]));
      menu.appendChild(el("li", null, [el("a", { href: "#cat-" + c.id, "data-cat": c.id, onclick: irPara }, [
        el("span", { texto: c.nome }), el("small", { texto: lista.length + (lista.length > 1 ? " itens" : " item") })
      ])]));
    });

    var vazio = $("vazio");
    if (!visiveis) {
      vazio.hidden = false;
      vazio.textContent = termo
        ? "Nenhum produto encontrado para “" + estado.busca.trim() + "”."
        : "Cardápio em atualização. Volte em breve!";
    } else {
      vazio.hidden = true;
    }
    marcarCategoriaAtiva();
  }

  /* ---------- Navegação por categorias ---------- */

  function irPara(e) {
    e.preventDefault();
    var id = this.getAttribute("data-cat");
    var rolar = function () {
      var secao = $("cat-" + id);
      if (!secao) return;
      if (estado.recolhidas[id]) {
        delete estado.recolhidas[id];
        var b = secao.querySelector(".secao-cabeca");
        b.setAttribute("aria-expanded", "true");
        $("conteudo-" + id).hidden = false;
      }
      secao.scrollIntoView({ behavior: "smooth", block: "start" });
      try { history.replaceState(history.state, "", "#cat-" + id); } catch (err) { /* file:// */ }
    };
    if ($("dlg-menu").open) fecharFolha($("dlg-menu"), rolar);
    else rolar();
  }

  var categoriaAtiva = null;
  function marcarCategoriaAtiva() {
    var nav = $("categorias");
    nav.classList.toggle("grudada", window.scrollY > 0 && nav.getBoundingClientRect().top <= 0);

    var limite = nav.offsetHeight + 24;
    var atual = null;
    var secoes = document.querySelectorAll(".secao");
    for (var i = 0; i < secoes.length; i++) {
      if (secoes[i].getBoundingClientRect().top <= limite) atual = secoes[i].id.slice(4);
    }
    // No topo, a primeira categoria; no fim da página (após rolar), a última.
    if (secoes.length && !atual) atual = secoes[0].id.slice(4);
    if (secoes.length && window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      atual = secoes[secoes.length - 1].id.slice(4);
    }
    if (atual === categoriaAtiva) return;
    categoriaAtiva = atual;

    var lista = $("categorias-lista");
    var links = lista.querySelectorAll("a");
    for (var j = 0; j < links.length; j++) {
      var ativo = links[j].getAttribute("data-cat") === atual;
      links[j].setAttribute("aria-current", ativo ? "true" : "false");
      if (ativo) {
        var alvo = links[j].offsetLeft - (lista.clientWidth - links[j].offsetWidth) / 2;
        lista.scrollTo({ left: Math.max(0, alvo), behavior: "smooth" });
      }
    }
  }

  var agendado = false;
  window.addEventListener("scroll", function () {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(function () { agendado = false; marcarCategoriaAtiva(); });
  }, { passive: true });

  /* ---------- Folhas (dialogs) com suporte ao botão "voltar" ---------- */

  var pilha = [];
  var aoFechar = new WeakMap();

  function abrirFolha(dlg) {
    if (dlg.open) return;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    pilha.push(dlg);
    document.body.classList.add("travado");
    try { history.pushState({ sbFolha: dlg.id }, ""); } catch (e) { /* ignora */ }
  }

  function fecharFolha(dlg, depois) {
    if (!dlg.open) { if (depois) depois(); return; }
    if (depois) aoFechar.set(dlg, depois);
    if (pilha[pilha.length - 1] === dlg && history.state && history.state.sbFolha === dlg.id) {
      history.back(); // popstate fecha de fato
    } else {
      fecharDeFato(dlg);
    }
  }

  function fecharDeFato(dlg) {
    var i = pilha.indexOf(dlg);
    if (i !== -1) pilha.splice(i, 1);
    if (dlg.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
    if (!pilha.length) document.body.classList.remove("travado");
    var cb = aoFechar.get(dlg);
    if (cb) { aoFechar.delete(dlg); requestAnimationFrame(cb); }
  }

  window.addEventListener("popstate", function () {
    var topo = pilha[pilha.length - 1];
    if (topo) fecharDeFato(topo);
  });

  Array.prototype.forEach.call(document.querySelectorAll("dialog.folha"), function (dlg) {
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); fecharFolha(dlg); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) fecharFolha(dlg); });
    Array.prototype.forEach.call(dlg.querySelectorAll("[data-fechar]"), function (b) {
      b.addEventListener("click", function () { fecharFolha(dlg); });
    });
  });

  /* ---------- Produto ---------- */

  var produtoAberto = null;
  var qtdProduto = 1;

  function atualizarProduto() {
    $("produto-qtd").textContent = qtdProduto;
    $("produto-menos").disabled = qtdProduto <= 1;
    $("produto-mais").disabled = qtdProduto >= QTD_MAX;
    $("produto-subtotal").textContent = "· " + reais(produtoAberto.preco * qtdProduto);
  }

  function abrirProduto(id) {
    var p = produtos[id];
    if (!p) return;
    produtoAberto = p;
    qtdProduto = 1;

    var midiaBox = $("produto-midia");
    midiaBox.replaceChildren();
    if (p.foto) midiaBox.appendChild(el("img", { src: p.foto, alt: p.nome, width: 600, height: 450 }));

    $("produto-nome").replaceChildren(p.codigo ? el("span", { classe: "codigo", texto: p.codigo }) : "", p.nome);
    $("produto-desc").textContent = p.descricao || "";
    $("produto-preco").textContent = reais(p.preco);
    $("produto-obs").value = "";

    var botao = $("produto-adicionar");
    botao.disabled = !!p.esgotado;
    $("produto-obs").disabled = !!p.esgotado;
    if (p.esgotado) {
      botao.replaceChildren("Indisponível no momento");
    } else {
      botao.replaceChildren("Adicionar ", el("span", { id: "produto-subtotal" }));
      atualizarProduto();
    }
    $("produto-menos").disabled = true;
    $("produto-mais").disabled = !!p.esgotado;
    abrirFolha($("dlg-produto"));
  }

  $("produto-menos").addEventListener("click", function () { if (qtdProduto > 1) { qtdProduto--; atualizarProduto(); } });
  $("produto-mais").addEventListener("click", function () { if (qtdProduto < QTD_MAX) { qtdProduto++; atualizarProduto(); } });
  $("produto-adicionar").addEventListener("click", function () {
    if (!produtoAberto || produtoAberto.esgotado) return;
    adicionar(produtoAberto.id, qtdProduto, $("produto-obs").value);
    fecharFolha($("dlg-produto"));
  });

  /* ---------- Sacola ---------- */

  var sacola = [];   // [{ id, qtd, obs }]

  function carregarSacola() {
    var salvo = lerArmazenado(CHAVE_SACOLA);
    if (!salvo || !Array.isArray(salvo.itens) || Date.now() - (salvo.em || 0) > VALIDADE_SACOLA_MS) return;
    salvo.itens.forEach(function (i) {
      var p = i && produtos[i.id];
      var qtd = parseInt(i && i.qtd, 10);
      if (p && !p.esgotado && qtd >= 1) sacola.push({ id: p.id, qtd: Math.min(qtd, QTD_MAX), obs: limpar(i.obs, 140) });
    });
  }

  function salvarSacola() {
    salvarArmazenado(CHAVE_SACOLA, { em: Date.now(), itens: sacola });
  }

  function adicionar(id, qtd, obs) {
    var p = produtos[id];
    if (!p || p.esgotado) return;
    obs = limpar(obs, 140);
    var existente = sacola.find(function (i) { return i.id === id && i.obs === obs; });
    if (existente) existente.qtd = Math.min(QTD_MAX, existente.qtd + qtd);
    else sacola.push({ id: id, qtd: qtd, obs: obs });
    salvarSacola();
    atualizarSacola(true);
    toast("✓ " + qtd + "x " + p.nome + " adicionado");
  }

  function subtotal() {
    return sacola.reduce(function (s, i) { return s + produtos[i.id].preco * i.qtd; }, 0);
  }
  function quantidadeTotal() {
    return sacola.reduce(function (s, i) { return s + i.qtd; }, 0);
  }
  function tipoEntrega() {
    var r = document.querySelector('input[name="tipo"]:checked');
    return r ? r.value : "entrega";
  }
  function taxa() { return tipoEntrega() === "entrega" ? Number(LOJA.taxaEntrega) || 0 : 0; }
  function total() { return subtotal() + taxa(); }

  function atualizarSacola(pular) {
    var qtd = quantidadeTotal();
    var barra = $("sacola-barra");
    barra.hidden = qtd === 0;
    document.body.classList.toggle("com-sacola", qtd > 0);
    $("sacola-qtd").textContent = qtd;
    $("sacola-total").textContent = reais(subtotal());
    barra.setAttribute("aria-label", "Ver pedido: " + qtd + (qtd === 1 ? " item, " : " itens, ") + reais(subtotal()));
    if (pular) {
      barra.classList.remove("pulo");
      void barra.offsetWidth;
      barra.classList.add("pulo");
    }
    if ($("dlg-sacola").open) renderizarSacola();
  }

  function renderizarSacola() {
    var lista = $("sacola-itens");
    lista.replaceChildren();
    if (!sacola.length) {
      lista.appendChild(el("li", { classe: "sacola-vazia", texto: "Sua sacola está vazia." }));
    }
    sacola.forEach(function (item, indice) {
      var p = produtos[item.id];
      lista.appendChild(el("li", { classe: "sacola-item" }, [
        el("div", { classe: "sacola-item-texto" }, [
          el("p", { classe: "sacola-item-nome", texto: p.nome }),
          item.obs ? el("p", { classe: "sacola-item-obs", texto: "Obs: " + item.obs }) : null,
          el("p", { classe: "sacola-item-preco", texto: reais(p.preco * item.qtd) })
        ]),
        el("div", { classe: "contador", role: "group", "aria-label": "Quantidade de " + p.nome }, [
          el("button", {
            type: "button", "aria-label": item.qtd === 1 ? "Remover " + p.nome : "Diminuir",
            texto: item.qtd === 1 ? "×" : "−",
            onclick: function () { alterarQtd(indice, -1); }
          }),
          el("output", { texto: String(item.qtd) }),
          el("button", {
            type: "button", "aria-label": "Aumentar", texto: "+", disabled: item.qtd >= QTD_MAX,
            onclick: function () { alterarQtd(indice, 1); }
          })
        ])
      ]));
    });

    var entrega = tipoEntrega() === "entrega";
    $("bloco-endereco").hidden = !entrega;
    $("linha-taxa").hidden = !entrega;
    $("resumo-subtotal").textContent = reais(subtotal());
    $("resumo-taxa").textContent = reais(taxa());
    $("resumo-total").textContent = reais(total());
    atualizarBotaoEnviar();
  }

  function alterarQtd(indice, delta) {
    var item = sacola[indice];
    if (!item) return;
    item.qtd += delta;
    if (item.qtd <= 0) sacola.splice(indice, 1);
    else if (item.qtd > QTD_MAX) item.qtd = QTD_MAX;
    salvarSacola();
    atualizarSacola(false);
  }

  function podePedir() {
    return statusAtual.aberto || LOJA.aceitarPedidosForaDoHorario === true;
  }

  function atualizarBotaoEnviar() {
    var botao = $("btn-enviar");
    var aviso = $("aviso-fechado");
    var bloqueado = !podePedir();
    aviso.hidden = !bloqueado;
    if (bloqueado) {
      aviso.textContent = "Estamos fechados agora." + (statusAtual.proxima ? " Abrimos " + statusAtual.proxima + "." : "");
    }
    botao.disabled = bloqueado || !sacola.length;
  }

  /* ---------- Formulário do pedido ---------- */

  function montarPagamentos() {
    var caixa = $("opcoes-pagamento");
    (LOJA.pagamentos || []).forEach(function (forma) {
      caixa.appendChild(el("label", { classe: "opcao" }, [
        el("input", { type: "radio", name: "pagamento", value: forma }),
        el("span", { texto: forma })
      ]));
    });
  }

  function pagamentoEscolhido() {
    var r = document.querySelector('input[name="pagamento"]:checked');
    return r ? r.value : "";
  }

  function ehDinheiro() { return normalizar(pagamentoEscolhido()) === "dinheiro"; }

  $("form-pedido").addEventListener("change", function (e) {
    if (e.target.name === "tipo") renderizarSacola();
    if (e.target.name === "pagamento") {
      $("bloco-troco").hidden = !ehDinheiro();
      erro("pagamento", "");
    }
  });
  $("form-pedido").addEventListener("submit", function (e) { e.preventDefault(); });

  function erro(campo, msg) {
    var span = $("erro-" + campo);
    if (span) span.textContent = msg;
    var input = $("cli-" + campo);
    if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function lerValor(t) {
    var s = String(t || "").replace(/[^\d,.]/g, "");
    if (!s) return null;
    if (s.indexOf(",") !== -1) s = s.replace(/\./g, "").replace(",", ".");
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  function validar() {
    var dados = {
      nome: limpar($("cli-nome").value, 60),
      rua: limpar($("cli-rua").value, 100),
      bairro: limpar($("cli-bairro").value, 60),
      referencia: limpar($("cli-ref").value, 100),
      observacoes: limpar($("cli-obs").value, 200),
      tipo: tipoEntrega(),
      pagamento: pagamentoEscolhido(),
      troco: null
    };
    var primeiroErro = null;
    function falha(campo, msg) { erro(campo, msg); if (!primeiroErro) primeiroErro = campo; }

    ["nome", "rua", "bairro", "troco", "pagamento"].forEach(function (c) { erro(c, ""); });

    if (dados.nome.length < 2) falha("nome", "Informe seu nome.");
    if (dados.tipo === "entrega") {
      if (dados.rua.length < 3) falha("rua", "Informe a rua e o número.");
      if (dados.bairro.length < 2) falha("bairro", "Informe o bairro.");
    }
    if ((LOJA.pagamentos || []).indexOf(dados.pagamento) === -1) falha("pagamento", "Escolha a forma de pagamento.");
    if (ehDinheiro() && $("cli-troco").value.trim()) {
      var v = lerValor($("cli-troco").value);
      if (v === null || isNaN(v)) falha("troco", "Valor inválido. Ex.: 50");
      else if (v < total()) falha("troco", "O valor precisa ser igual ou maior que o total (" + reais(total()) + ").");
      else if (v > total()) dados.troco = v;
    }

    if (primeiroErro) {
      var alvo = primeiroErro === "pagamento" ? document.querySelector('input[name="pagamento"]') : $("cli-" + primeiroErro);
      if (alvo) { alvo.focus({ preventScroll: true }); alvo.closest(".campo, .grupo").scrollIntoView({ behavior: "smooth", block: "center" }); }
      return null;
    }
    return dados;
  }

  function montarMensagem(d) {
    var linha = "━━━━━━━━━━━━━━";
    var m = [];
    m.push("🍔 *NOVO PEDIDO – " + (LOJA.nome || "") + "*");
    if (sacola.some(function (i) { return produtos[i.id].exemplo; })) m.push("⚠️ _Pedido de teste (itens de exemplo)_");
    m.push(linha);
    sacola.forEach(function (i) {
      var p = produtos[i.id];
      m.push(i.qtd + "x " + (p.codigo ? "[" + p.codigo + "] " : "") + p.nome + " – " + reais(p.preco * i.qtd));
      if (i.obs) m.push("   Obs: " + i.obs);
    });
    m.push(linha);
    m.push("Subtotal: " + reais(subtotal()));
    if (d.tipo === "entrega") m.push("Taxa de entrega: " + reais(taxa()));
    m.push("*TOTAL: " + reais(total()) + "*");
    m.push("");
    m.push("👤 Nome: " + d.nome);
    if (d.tipo === "entrega") {
      m.push("🛵 Entrega: " + d.rua + " – " + d.bairro);
      if (d.referencia) m.push("   Ref.: " + d.referencia);
    } else {
      m.push("🏪 Retirada no local");
    }
    var pag = "💳 Pagamento: " + d.pagamento;
    if (ehDinheiro()) pag += d.troco ? " (troco p/ " + reais(d.troco) + ")" : " (sem troco)";
    m.push(pag);
    if (d.observacoes) m.push("📝 Observações: " + d.observacoes);
    return m.join("\n");
  }

  $("btn-enviar").addEventListener("click", function () {
    if (!sacola.length) return;
    if (!podePedir()) { atualizarBotaoEnviar(); return; }
    var dados = validar();
    if (!dados) return;

    salvarArmazenado(CHAVE_CLIENTE, { nome: dados.nome, rua: dados.rua, bairro: dados.bairro, referencia: dados.referencia, tipo: dados.tipo });

    var url = linkWhats(montarMensagem(dados));
    var janela = window.open(url, "_blank", "noopener");
    if (!janela) window.location.href = url;
    toast("Pedido pronto! Confirme o envio no WhatsApp.");
  });

  function preencherCliente() {
    var c = lerArmazenado(CHAVE_CLIENTE);
    if (!c || typeof c !== "object") return;
    $("cli-nome").value = limpar(c.nome, 60);
    $("cli-rua").value = limpar(c.rua, 100);
    $("cli-bairro").value = limpar(c.bairro, 60);
    $("cli-ref").value = limpar(c.referencia, 100);
    if (c.tipo === "retirada") document.querySelector('input[name="tipo"][value="retirada"]').checked = true;
  }

  /* ---------- Topo: compartilhar e informações ---------- */

  $("btn-info").addEventListener("click", function () { abrirFolha($("dlg-info")); });
  $("status").addEventListener("click", function () { abrirFolha($("dlg-info")); });
  $("btn-menu").addEventListener("click", function () { abrirFolha($("dlg-menu")); });
  $("sacola-barra").addEventListener("click", function () { renderizarSacola(); abrirFolha($("dlg-sacola")); });

  $("btn-compartilhar").addEventListener("click", function () {
    var dados = { title: LOJA.nome, text: "Confira o cardápio da " + LOJA.nome + "!", url: location.href.split("#")[0] };
    if (navigator.share) {
      navigator.share(dados).catch(function () { /* cancelado */ });
    } else if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(dados.url).then(function () { toast("Link do cardápio copiado!"); }, function () { toast("Não foi possível copiar o link."); });
    } else {
      toast("Copie o link na barra do navegador.");
    }
  });

  /* ---------- Busca e ordenação ---------- */

  var temporizadorBusca;
  $("busca").addEventListener("input", function () {
    var valor = this.value;
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(function () { estado.busca = valor; renderizar(); }, 120);
  });
  $("ordenar").addEventListener("change", function () { estado.ordem = this.value; renderizar(); });

  /* ---------- Início ---------- */

  montarHorarios();
  montarInformacoes();
  montarPagamentos();
  carregarSacola();
  preencherCliente();
  renderizar();
  atualizarStatus();
  atualizarSacola(false);

  // Atualiza o selo no início de cada minuto e ao voltar para a aba.
  (function agendarMinuto() {
    setTimeout(function () { atualizarStatus(); agendarMinuto(); }, 60000 - (Date.now() % 60000) + 50);
  })();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) atualizarStatus(); });

  if (location.hash.indexOf("#cat-") === 0 && document.querySelector(location.hash.replace(/[^#\w-]/g, ""))) {
    requestAnimationFrame(function () { document.querySelector(location.hash.replace(/[^#\w-]/g, "")).scrollIntoView(); });
  }

  // Exposto apenas para os testes automatizados.
  window.__sertao = { calcularStatus: calcularStatus, montarMensagem: montarMensagem };
})();
