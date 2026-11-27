// -----------------------------------------
// CONFIGURAÇÕES

const LIMITE_PADRAO = 3; // livros por usuário, se não houver limite próprio
const PRAZO_DIAS = 7; // prazo de cada empréstimo / renovação
const MAX_RENOVACOES = 2;

const ST_AGUARDANDO = "Aguardando";
const ST_RETIRADA = "Disponível para retirada";


// -----------------------------------------
// ESTADO DA TELA

let usuarioAtual = null;
let livroAtual = null;
let obrasSelecionadas = [];


// =========================================
// LOCALSTORAGE

function obterDados(chave) {

 try {

 const dados = JSON.parse(localStorage.getItem(chave));

 return Array.isArray(dados) ? dados : [];

 } catch (erro) {

 return [];

 }

}

function salvarDados(chave, dados) {

 localStorage.setItem(chave, JSON.stringify(dados));

}


// =========================================
// LOGIN / TEMA

function verificarLogin() {

 if (localStorage.getItem("logado") !== "true") {

 window.location.href = "{% url 'login_usuarios' %}";

 return false;

 }

 return true;

}

function carregarUsuarioLogado() {

 let conta = null;

 try {

 conta = JSON.parse(localStorage.getItem("usuario"));

 } catch (erro) {

 conta = null;

 }

 if (conta && conta.nome && campo("nomeUsuario")) {

 campo("nomeUsuario").textContent = conta.nome;

 }

}

function sair() {

 // Remove só a sessão. A conta ("usuario") precisa continuar salva.
 localStorage.removeItem("logado");

 window.location.href = "{% url 'login_usuarios' %}";

}

function aplicarTema() {

 const tema = localStorage.getItem("tema");

 if (tema) {

 document.body.setAttribute("data-bs-theme", tema);

 }

}

function alternarTema() {

 const body = document.body;

 const novo = body.getAttribute("data-bs-theme") === "dark"
 ? "light"
 : "dark";

 body.setAttribute("data-bs-theme", novo);

 localStorage.setItem("tema", novo);

}


// =========================================
// FUNÇÕES AUXILIARES

function campo(id) {

 return document.getElementById(id);

}

function valor(id) {

 return campo(id)?.value.trim() || "";

}

function preencher(id, conteudo) {

 if (campo(id)) {

 campo(id).value = conteudo ?? "";

 }

}

function normalizar(texto) {

 return String(texto ?? "").trim().toLowerCase();

}

// Evita que texto digitado vire HTML
function esc(texto) {

 return String(texto ?? "").replace(/[&<>"']/g, function (c) {

 return {
 "&": "&amp;",
 "<": "&lt;",
 ">": "&gt;",
 '"': "&quot;",
 "'": "&#39;"
 }[c];

 });

}

// Procura por código exato (campos exatos) ou por texto parcial.
// Retorna { item } se achou um, { varios } se achou mais de um, {} se nada.
function localizar(lista, termo, camposExatos, camposTexto) {

 const t = normalizar(termo);

 const exato = lista.find(function (x) {

 return camposExatos.some(function (c) {

 return normalizar(x[c]) === t;

 });

 });

 if (exato) return { item: exato };

 const parciais = lista.filter(function (x) {

 return camposTexto.some(function (c) {

 return normalizar(x[c]).includes(t);

 });

 });

 if (parciais.length === 1) return { item: parciais[0] };

 if (parciais.length > 1) return { varios: parciais };

 return {};

}

function descreverVarios(lista, campoCodigo, campoNome) {

 const nomes = lista.slice(0, 5).map(function (x) {

 return x[campoNome] + " (" + x[campoCodigo] + ")";

 });

 return "Vários resultados: " + nomes.join(", ") +
 (lista.length > 5 ? "..." : "") +
 ". Digite o código para escolher um.";

}

function proximoCodigo(prefixo, lista) {

 const maior = lista.reduce(function (m, x) {

 const n = parseInt(String(x.codigo || "").replace(/\D/g, ""), 10);

 return n > m ? n : m;

 }, 0);

 return prefixo + String(maior + 1).padStart(4, "0");

}


// -----------------------------------------
// DATAS (guardadas como AAAA-MM-DD)

function paraISO(data) {

 const mes = String(data.getMonth() + 1).padStart(2, "0");

 const dia = String(data.getDate()).padStart(2, "0");

 return data.getFullYear() + "-" + mes + "-" + dia;

}

function hojeISO() {

 return paraISO(new Date());

}

function somarDias(iso, dias) {

 const data = new Date(iso + "T00:00:00");

 data.setDate(data.getDate() + dias);

 return paraISO(data);

}

function formatarData(iso) {

 if (!iso) return "—";

 const partes = iso.split("-");

 return partes[2] + "/" + partes[1] + "/" + partes[0];

}

// Positivo = dias de atraso. Zero = vence hoje. Negativo = no prazo.
function diasDeAtraso(previstaISO) {

 const hoje = new Date(hojeISO() + "T00:00:00");

 const prevista = new Date(previstaISO + "T00:00:00");

 return Math.round((hoje - prevista) / 86400000);

}


// -----------------------------------------
// AVISOS E CONFIRMAÇÃO

function avisar(mensagem, tipo) {

 tipo = tipo || "success";

 const el = document.createElement("div");

 el.className = "toast align-items-center border-0 text-bg-" + tipo;

 el.setAttribute("role", "alert");

 el.innerHTML =
 '<div class="d-flex">' +
 '<div class="toast-body" style="white-space:pre-line"></div>' +
 '<button type="button" class="btn-close' +
 (tipo === "warning" ? "" : " btn-close-white") +
 ' me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>' +
 '</div>';

 el.querySelector(".toast-body").textContent = mensagem;

 campo("toasts").appendChild(el);

 el.addEventListener("hidden.bs.toast", function () {

 el.remove();

 });

 new bootstrap.Toast(el, {
 delay: tipo === "danger" ? 6000 : 4000
 }).show();

}

// Retorna uma Promise: true se a pessoa confirmou
function confirmar(titulo, mensagem, textoBotao, classeBotao) {

 return new Promise(function (resolve) {

 const modalEl = campo("modalConfirmar");

 const botao = campo("btnConfirmarModal");

 campo("modalConfirmarTitulo").textContent = titulo;

 campo("modalConfirmarTexto").textContent = mensagem;

 botao.textContent = textoBotao || "Confirmar";

 botao.className = "btn " + (classeBotao || "btn-primary");

 const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

 let confirmado = false;

 function aoClicar() {

 confirmado = true;

 modal.hide();

 }

 botao.addEventListener("click", aoClicar, { once: true });

 modalEl.addEventListener("hidden.bs.modal", function () {

 botao.removeEventListener("click", aoClicar);

 resolve(confirmado);

 }, { once: true });

 modal.show();

 });

}


// =========================================
// REGRAS DE NEGÓCIO

function totalExemplares(livro) {

 return Number(livro.quantidade) || 0;

}

function disponiveis(livro) {

 return Number(livro.quantidadeDisponivel ?? livro.quantidade) || 0;

}

function atualizarStatusLivro(livro) {

 // Mesmos valores usados pelo dashboard (index.js)
 livro.status = disponiveis(livro) > 0 ? "Disponível" : "Emprestado";

}

// Garante que livros criados antes desta versão tenham os campos novos
function migrarLivros() {

 const livros = obterDados("livros");

 let mudou = false;

 livros.forEach(function (l) {

 if (!l.codigo) {

 l.codigo = proximoCodigo("L", livros);

 mudou = true;

 }

 if (typeof l.quantidade !== "number") {

 l.quantidade = Number(l.quantidade) || 1;

 mudou = true;

 }

 if (l.quantidadeDisponivel === undefined) {

 l.quantidadeDisponivel = l.quantidade;

 mudou = true;

 }

 const antes = l.status;

 atualizarStatusLivro(l);

 if (antes !== l.status) mudou = true;

 });

 if (mudou) salvarDados("livros", livros);

}

function usuarioBloqueado(usuario) {

 return usuario.bloqueado === true ||
 normalizar(usuario.status) === "bloqueado";

}

function limiteDoUsuario(usuario) {

 return Number(usuario.limiteEmprestimos) || LIMITE_PADRAO;

}

function emprestimosAbertos() {

 return obterDados("emprestimos").filter(function (e) {

 return e.status === "Emprestado";

 });

}

function emprestimosDoUsuario(codigoUsuario) {

 return emprestimosAbertos().filter(function (e) {

 return e.codigoUsuario === codigoUsuario;

 });

}

function titulosEmUso(codigoUsuario) {

 return emprestimosDoUsuario(codigoUsuario).reduce(function (t, e) {

 return t + e.quantidade;

 }, 0);

}

function atrasosDoUsuario(codigoUsuario) {

 return emprestimosDoUsuario(codigoUsuario).filter(function (e) {

 return diasDeAtraso(e.dataPrevista) > 0;

 }).length;

}

// Texto explicando por que o usuário não pode pegar livros (ou "" se pode)
function usuarioImpedido(usuario) {

 if (usuarioBloqueado(usuario)) {

 return "Este usuário está bloqueado para empréstimos.";

 }

 const atrasos = atrasosDoUsuario(usuario.codigo);

 if (atrasos > 0) {

 return "Este usuário tem " + atrasos +
 " empréstimo(s) em atraso. Registre a devolução antes de emprestar.";

 }

 return "";

}

function reservasAtivas() {

 return obterDados("reservas").filter(function (r) {

 return r.status === ST_AGUARDANDO || r.status === ST_RETIRADA;

 });

}

// Exemplares que este usuário pode pegar agora
// (desconta os que estão separados para a retirada de outras pessoas)
function disponivelPara(livro, codigoUsuario) {

 const separados = obterDados("reservas").filter(function (r) {

 return r.status === ST_RETIRADA &&
 String(r.livroId) === String(livro.id) &&
 r.codigoUsuario !== codigoUsuario;

 }).length;

 return Math.max(0, disponiveis(livro) - separados);

}

// Quando sobra exemplar, libera a reserva mais antiga da fila
function promoverReservas(livros, livroId) {

 const livro = livros.find(function (l) {

 return String(l.id) === String(livroId);

 });

 if (!livro) return [];

 const reservas = obterDados("reservas");

 const doLivro = reservas.filter(function (r) {

 return String(r.livroId) === String(livroId);

 });

 const separados = doLivro.filter(function (r) {

 return r.status === ST_RETIRADA;

 }).length;

 let livres = disponiveis(livro) - separados;

 const promovidas = [];

 doLivro
 .filter(function (r) { return r.status === ST_AGUARDANDO; })
 .sort(function (a, b) { return a.id - b.id; })
 .forEach(function (r) {

 if (livres > 0) {

 r.status = ST_RETIRADA;

 livres--;

 promovidas.push(r);

 }

 });

 if (promovidas.length) salvarDados("reservas", reservas);

 return promovidas;

}


// =========================================
// INICIALIZAÇÃO

document.addEventListener("DOMContentLoaded", function () {

 if (!verificarLogin()) return;

 aplicarTema();

 carregarUsuarioLogado();

 migrarLivros();

 preencherDatas();

 ligarEventos();

 abrirAbaDoHash();

 renderTudo();

});

function preencherDatas() {

 const hoje = hojeISO();

 preencher("dataEmprestimo", formatarData(hoje));

 preencher("dataDevolucao", formatarData(somarDias(hoje, PRAZO_DIAS)));

}

function ligarEventos() {

 // Enter dispara a busca
 function aoEnter(id, funcao) {

 campo(id).addEventListener("keydown", function (e) {

 if (e.key === "Enter") {

 e.preventDefault();

 funcao();

 }

 });

 }

 aoEnter("codigoUsuario", buscarUsuario);

 aoEnter("codigoExemplar", buscarExemplar);

 aoEnter("reservaLivro", reservarLivro);

 aoEnter("reservaUsuario", reservarLivro);

 // Se a pessoa muda o código depois de buscar, limpa os dados antigos
 campo("codigoUsuario").addEventListener("input", function () {

 if (usuarioAtual && valor("codigoUsuario") !== usuarioAtual.codigo) {

 limparUsuario(false);

 }

 });

 campo("codigoExemplar").addEventListener("input", function () {

 if (livroAtual && valor("codigoExemplar") !== livroAtual.codigo) {

 limparExemplar(false);

 }

 });

 // Filtros das tabelas
 campo("filtroDevolucao").addEventListener("input", renderTudo);

 campo("filtroRenovacao").addEventListener("input", renderTudo);

 // Atualiza as listas ao trocar de aba e guarda a aba na URL
 document.querySelectorAll("#mainTabs button[data-bs-toggle='tab']")
 .forEach(function (botao) {

 botao.addEventListener("shown.bs.tab", function () {

 const aba = botao.getAttribute("data-bs-target").replace("#", "");

 history.replaceState(null, "", "#" + aba);

 renderTudo();

 });

 });

}

// Permite abrir direto numa aba: emprestimo.html#reservas
function abrirAbaDoHash() {

 const aba = location.hash.replace("#", "");

 if (["devolucoes", "renovacoes", "reservas"].includes(aba)) {

 mostrarAba(aba);

 }

}

function mostrarAba(nome) {

 const botao = campo(nome + "-tab");

 if (botao) bootstrap.Tab.getOrCreateInstance(botao).show();

}


// =========================================
// USUÁRIO

function buscarUsuario() {

 const termo = valor("codigoUsuario");

 if (!termo) {

 avisar("Digite o código, CPF/RG ou nome do usuário.", "warning");

 return;

 }

 const resultado = localizar(
 obterDados("usuarios"),
 termo,
 ["codigo", "cpf"],
 ["nome"]
 );

 if (resultado.varios) {

 avisar(descreverVarios(resultado.varios, "codigo", "nome"), "warning");

 return;

 }

 if (!resultado.item) {

 limparUsuario(false);

 avisar("Usuário não encontrado. Use o botão Novo para cadastrá-lo.", "danger");

 return;

 }

 definirUsuario(resultado.item);

}

function definirUsuario(usuario) {

 usuarioAtual = usuario;

 preencher("codigoUsuario", usuario.codigo);

 preencher("nomeCompletoUsuario", usuario.nome);

 preencher("documentoUsuario", usuario.cpf);

 preencher("sexoUsuario", usuario.sexo);

 preencher("grauUsuario", usuario.grau);

 preencher("turnoUsuario", usuario.turno);

 preencher("cursoUsuario", usuario.curso);

 atualizarResumoUsuario();

}

function atualizarResumoUsuario() {

 const aviso = campo("avisoUsuario");

 if (!usuarioAtual) {

 aviso.className = "alert d-none py-2";

 preencher("titulosEmprestimo", "");

 return;

 }

 const emUso = titulosEmUso(usuarioAtual.codigo);

 const limite = limiteDoUsuario(usuarioAtual);

 preencher("titulosEmprestimo", emUso + "/" + limite);

 const motivo = usuarioImpedido(usuarioAtual);

 if (motivo) {

 aviso.className = "alert alert-danger py-2";

 aviso.textContent = motivo;

 } else if (emUso >= limite) {

 aviso.className = "alert alert-warning py-2";

 aviso.textContent = "Limite de " + limite + " livro(s) atingido. Registre devoluções para emprestar mais.";

 } else {

 aviso.className = "alert alert-success py-2";

 aviso.textContent = "Pode pegar mais " + (limite - emUso) + " livro(s).";

 }

}

function limparUsuario(limparCodigo) {

 usuarioAtual = null;

 if (limparCodigo) preencher("codigoUsuario", "");

 ["nomeCompletoUsuario", "documentoUsuario", "sexoUsuario",
 "grauUsuario", "turnoUsuario", "cursoUsuario"]
 .forEach(function (id) { preencher(id, ""); });

 atualizarResumoUsuario();

}


// -----------------------------------------
// NOVO USUÁRIO (modal)

function abrirNovoUsuario() {

 ["nuNome", "nuDocumento", "nuSexo", "nuGrau", "nuTurno", "nuCurso"]
 .forEach(function (id) { preencher(id, ""); });

 preencher("nuLimite", LIMITE_PADRAO);

 bootstrap.Modal.getOrCreateInstance(campo("modalNovoUsuario")).show();

}

function salvarNovoUsuario() {

 const nome = valor("nuNome");

 if (!nome) {

 avisar("Informe o nome do usuário.", "warning");

 return;

 }

 const usuarios = obterDados("usuarios");

 const documento = valor("nuDocumento");

 if (documento && usuarios.some(function (u) {

 return normalizar(u.cpf) === normalizar(documento);

 })) {

 avisar("Já existe um usuário com este CPF/RG.", "danger");

 return;

 }

 const novo = {

 codigo: proximoCodigo("U", usuarios),

 nome: nome,

 cpf: documento,

 sexo: valor("nuSexo"),

 grau: valor("nuGrau"),

 turno: valor("nuTurno"),

 curso: valor("nuCurso"),

 limiteEmprestimos: Number(valor("nuLimite")) || LIMITE_PADRAO,

 status: "Ativo"

 };

 usuarios.push(novo);

 salvarDados("usuarios", usuarios);

 bootstrap.Modal.getOrCreateInstance(campo("modalNovoUsuario")).hide();

 definirUsuario(novo);

 avisar("Usuário cadastrado. Código: " + novo.codigo);

}


// =========================================
// EXEMPLAR

function buscarExemplar() {

 const termo = valor("codigoExemplar");

 if (!termo) {

 avisar("Digite o código, ISBN ou título do exemplar.", "warning");

 return;

 }

 const resultado = localizar(
 obterDados("livros"),
 termo,
 ["codigo", "id", "isbn"],
 ["titulo"]
 );

 if (resultado.varios) {

 avisar(descreverVarios(resultado.varios, "codigo", "titulo"), "warning");

 return;

 }

 if (!resultado.item) {

 limparExemplar(false);

 avisar("Exemplar não encontrado.", "danger");

 return;

 }

 definirExemplar(resultado.item);

}

function definirExemplar(livro) {

 livroAtual = livro;

 preencher("codigoExemplar", livro.codigo);

 preencher("tituloExemplar", livro.titulo);

 preencher("ano", livro.ano);

 preencher("autorExemplar", livro.autor);

 preencher("editoraExemplar", livro.editora);

 preencher("isbnExemplar", livro.isbn);

 preencher("categoria", livro.categoria);

 preencher("localizacao", livro.localizacao);

 const livres = usuarioAtual
 ? disponivelPara(livro, usuarioAtual.codigo)
 : disponiveis(livro);

 preencher(
 "disponibilidadeExemplar",
 livres + " de " + totalExemplares(livro)
 );

 campo("quantidade").max = Math.max(livres, 1);

 if (livres <= 0) {

 avisar(
 "Sem exemplares disponíveis. Você pode reservar na aba Reservas.",
 "warning"
 );

 }

}

function limparExemplar(limparCodigo) {

 livroAtual = null;

 if (limparCodigo) preencher("codigoExemplar", "");

 ["tituloExemplar", "ano", "autorExemplar", "editoraExemplar",
 "isbnExemplar", "categoria", "localizacao", "disponibilidadeExemplar"]
 .forEach(function (id) { preencher(id, ""); });

 preencher("quantidade", 1);

 campo("quantidade").removeAttribute("max");

}


// =========================================
// OBRAS DO EMPRÉSTIMO (lista temporária)

function adicionarObra() {

 if (!usuarioAtual) {

 avisar("Busque o usuário antes de adicionar obras.", "warning");

 return;

 }

 if (!livroAtual) {

 avisar("Busque um exemplar antes de adicionar.", "warning");

 return;

 }

 const motivo = usuarioImpedido(usuarioAtual);

 if (motivo) {

 avisar(motivo, "danger");

 return;

 }

 // Lê o livro de novo para ter o estoque mais atual
 const livro = obterDados("livros").find(function (l) {

 return String(l.id) === String(livroAtual.id);

 });

 if (!livro) {

 avisar("Este livro não existe mais no acervo.", "danger");

 return;

 }

 const quantidade = Number(valor("quantidade") || 1);

 if (!Number.isInteger(quantidade) || quantidade < 1) {

 avisar("Informe uma quantidade válida.", "warning");

 return;

 }

 const existente = obrasSelecionadas.find(function (o) {

 return String(o.id) === String(livro.id);

 });

 const jaNaLista = existente ? existente.quantidade : 0;

 const livres = disponivelPara(livro, usuarioAtual.codigo) - jaNaLista;

 if (quantidade > livres) {

 avisar(
 livres > 0
 ? "Só há " + livres + " exemplar(es) disponível(is) de \"" + livro.titulo + "\"."
 : "Sem exemplares disponíveis. Você pode reservar na aba Reservas.",
 "danger"
 );

 return;

 }

 const naLista = obrasSelecionadas.reduce(function (t, o) {

 return t + o.quantidade;

 }, 0);

 const emUso = titulosEmUso(usuarioAtual.codigo);

 const limite = limiteDoUsuario(usuarioAtual);

 if (emUso + naLista + quantidade > limite) {

 avisar(
 "Limite de " + limite + " livro(s) por usuário. " +
 "Em uso: " + emUso + ", nesta lista: " + naLista + ".",
 "danger"
 );

 return;

 }

 if (existente) {

 existente.quantidade += quantidade;

 } else {

 obrasSelecionadas.push({

 id: livro.id,

 codigo: livro.codigo,

 titulo: livro.titulo,

 autor: livro.autor,

 quantidade: quantidade

 });

 }

 atualizarListaObras();

 limparExemplar(true);

 avisar("Obra adicionada ao empréstimo.");

}

function atualizarListaObras() {

 const lista = campo("obrasAdicionadas");

 if (obrasSelecionadas.length === 0) {

 lista.innerHTML =
 '<p class="text-body-secondary mb-0">' +
 'Nenhuma obra adicionada ainda. Busque um exemplar e use ' +
 '<strong>Adicionar obra</strong>.</p>';

 return;

 }

 let html =
 '<h6 class="text-primary mb-3">' +
 '<i class="bi bi-book-half"></i> Obras selecionadas</h6>' +
 '<div class="list-group">';

 obrasSelecionadas.forEach(function (obra, indice) {

 html +=
 '<div class="list-group-item d-flex justify-content-between align-items-center">' +
 '<div>' +
 '<strong>' + esc(obra.titulo) + '</strong><br>' +
 '<small class="text-body-secondary">' +
 esc(obra.autor) + ' | Código: ' + esc(obra.codigo) +
 ' | Quantidade: ' + obra.quantidade +
 '</small></div>' +
 '<button type="button" class="btn btn-sm btn-outline-danger" ' +
 'onclick="removerObra(' + indice + ')" title="Remover">' +
 '<i class="bi bi-trash"></i></button>' +
 '</div>';

 });

 html += '</div>';

 lista.innerHTML = html;

}

function removerObra(indice) {

 obrasSelecionadas.splice(indice, 1);

 atualizarListaObras();

}


// =========================================
// CONFIRMAR / CANCELAR EMPRÉSTIMO

function confirmarEmprestimo() {

 if (!usuarioAtual) {

 avisar("Busque um usuário válido antes de continuar.", "warning");

 return;

 }

 // Dados frescos do armazenamento
 const usuario = obterDados("usuarios").find(function (u) {

 return u.codigo === usuarioAtual.codigo;

 });

 if (!usuario) {

 avisar("Usuário não encontrado. Busque novamente.", "danger");

 return;

 }

 const motivo = usuarioImpedido(usuario);

 if (motivo) {

 avisar(motivo, "danger");

 atualizarResumoUsuario();

 return;

 }

 if (obrasSelecionadas.length === 0) {

 avisar("Adicione pelo menos uma obra.", "warning");

 return;

 }

 const quantidadeNova = obrasSelecionadas.reduce(function (t, o) {

 return t + o.quantidade;

 }, 0);

 const emUso = titulosEmUso(usuario.codigo);

 const limite = limiteDoUsuario(usuario);

 if (emUso + quantidadeNova > limite) {

 avisar("O usuário ultrapassaria o limite de " + limite + " livro(s).", "danger");

 return;

 }

 const livros = obterDados("livros");

 // Confere o estoque de todas as obras antes de gravar qualquer coisa
 for (const obra of obrasSelecionadas) {

 const livro = livros.find(function (l) {

 return String(l.id) === String(obra.id);

 });

 if (!livro) {

 avisar("O livro \"" + obra.titulo + "\" não foi encontrado.", "danger");

 return;

 }

 if (disponivelPara(livro, usuario.codigo) < obra.quantidade) {

 avisar("Estoque insuficiente para: " + obra.titulo, "danger");

 return;

 }

 }

 const hoje = hojeISO();

 const prevista = somarDias(hoje, PRAZO_DIAS);

 const emprestimos = obterDados("emprestimos");

 const novos = obrasSelecionadas.map(function (obra) {

 return {

 id: Date.now() + Math.floor(Math.random() * 100000),

 codigoUsuario: usuario.codigo,

 nomeUsuario: usuario.nome,

 livroId: obra.id,

 codigoExemplar: obra.codigo,

 titulo: obra.titulo,

 autor: obra.autor,

 quantidade: obra.quantidade,

 dataEmprestimo: hoje,

 dataPrevista: prevista,

 dataDevolucao: null,

 renovacoes: 0,

 status: "Emprestado"

 };

 });

 // Atualiza o estoque (a quantidade total não muda)
 obrasSelecionadas.forEach(function (obra) {

 const livro = livros.find(function (l) {

 return String(l.id) === String(obra.id);

 });

 livro.quantidadeDisponivel = disponiveis(livro) - obra.quantidade;

 atualizarStatusLivro(livro);

 });

 // Reservas do próprio usuário para estes livros viram "Atendida"
 const reservas = obterDados("reservas");

 reservas.forEach(function (r) {

 const ativa = r.status === ST_AGUARDANDO || r.status === ST_RETIRADA;

 const dele = r.codigoUsuario === usuario.codigo;

 const comprou = obrasSelecionadas.some(function (o) {

 return String(o.id) === String(r.livroId);

 });

 if (ativa && dele && comprou) r.status = "Atendida";

 });

 salvarDados("livros", livros);

 salvarDados("reservas", reservas);

 salvarDados("emprestimos", emprestimos.concat(novos));

 avisar(
 "Empréstimo registrado para " + usuario.nome + ".\n" +
 quantidadeNova + " obra(s). Devolução prevista: " + formatarData(prevista)
 );

 cancelarEmprestimo();

 renderTudo();

}

function cancelarEmprestimo() {

 obrasSelecionadas = [];

 limparUsuario(true);

 limparExemplar(true);

 atualizarListaObras();

 preencherDatas();

}


// =========================================
// TABELAS: DEVOLUÇÕES E RENOVAÇÕES

function situacaoEmprestimo(emprestimo) {

 const atraso = diasDeAtraso(emprestimo.dataPrevista);

 if (atraso > 0) {

 return { texto: atraso + " dia(s) de atraso", classe: "bg-danger" };

 }

 if (atraso === 0) {

 return { texto: "Vence hoje", classe: "bg-warning text-dark" };

 }

 return { texto: "No prazo", classe: "bg-success" };

}

function renderAtivos(tbodyId, filtroId, modo) {

 const termo = normalizar(valor(filtroId));

 const lista = emprestimosAbertos()
 .filter(function (e) {

 if (!termo) return true;

 return [e.codigoUsuario, e.nomeUsuario, e.titulo, e.codigoExemplar]
 .some(function (c) { return normalizar(c).includes(termo); });

 })
 .sort(function (a, b) {

 return a.dataPrevista.localeCompare(b.dataPrevista);

 });

 const colunas = modo === "devolucao" ? 7 : 6;

 if (lista.length === 0) {

 campo(tbodyId).innerHTML =
 '<tr><td colspan="' + colunas + '" class="text-center text-body-secondary py-4">' +
 (termo ? "Nenhum empréstimo encontrado para este filtro."
 : "Nenhum empréstimo em aberto.") +
 '</td></tr>';

 return;

 }

 campo(tbodyId).innerHTML = lista.map(function (e) {

 const s = situacaoEmprestimo(e);

 const usuario =
 '<td><strong>' + esc(e.nomeUsuario) + '</strong><br>' +
 '<small class="text-body-secondary">' + esc(e.codigoUsuario) + '</small></td>';

 const livro =
 '<td>' + esc(e.titulo) + '<br>' +
 '<small class="text-body-secondary">' + esc(e.codigoExemplar) + '</small></td>';

 const situacao =
 '<td><span class="badge ' + s.classe + '">' + s.texto + '</span></td>';

 if (modo === "devolucao") {

 return '<tr>' + usuario + livro +
 '<td class="text-center">' + e.quantidade + '</td>' +
 '<td>' + formatarData(e.dataEmprestimo) + '</td>' +
 '<td>' + formatarData(e.dataPrevista) + '</td>' +
 situacao +
 '<td class="text-end">' +
 '<button class="btn btn-sm btn-outline-danger" onclick="devolver(' + e.id + ')">' +
 '<i class="bi bi-journal-arrow-down me-1"></i>Devolver</button></td></tr>';

 }

 return '<tr>' + usuario + livro +
 '<td>' + formatarData(e.dataPrevista) + '</td>' +
 '<td class="text-center">' + (e.renovacoes || 0) + '/' + MAX_RENOVACOES + '</td>' +
 situacao +
 '<td class="text-end">' +
 '<button class="btn btn-sm btn-outline-success" onclick="renovar(' + e.id + ')">' +
 '<i class="bi bi-arrow-repeat me-1"></i>Renovar</button></td></tr>';

 }).join("");

}

async function devolver(id) {

 const emprestimos = obterDados("emprestimos");

 const emprestimo = emprestimos.find(function (e) { return e.id === id; });

 if (!emprestimo || emprestimo.status !== "Emprestado") return;

 const ok = await confirmar(
 "Registrar devolução",
 emprestimo.titulo + " (" + emprestimo.quantidade + "x), emprestado a " +
 emprestimo.nomeUsuario + ".",
 "Devolver",
 "btn-danger"
 );

 if (!ok) return;

 emprestimo.status = "Devolvido";

 emprestimo.dataDevolucao = hojeISO();

 const livros = obterDados("livros");

 const livro = livros.find(function (l) {

 return String(l.id) === String(emprestimo.livroId);

 });

 if (livro) {

 livro.quantidadeDisponivel = Math.min(
 totalExemplares(livro),
 disponiveis(livro) + emprestimo.quantidade
 );

 atualizarStatusLivro(livro);

 }

 salvarDados("emprestimos", emprestimos);

 salvarDados("livros", livros);

 const promovidas = livro ? promoverReservas(livros, emprestimo.livroId) : [];

 const atraso = diasDeAtraso(emprestimo.dataPrevista);

 let mensagem = "Devolução registrada.";

 if (atraso > 0) mensagem += "\nDevolvido com " + atraso + " dia(s) de atraso.";

 if (promovidas.length) {

 mensagem += "\nReserva liberada para: " +
 promovidas.map(function (r) { return r.nomeUsuario; }).join(", ") + ".";

 }

 avisar(mensagem, atraso > 0 ? "warning" : "success");

 atualizarResumoUsuario();

 renderTudo();

}

function renovar(id) {

 const emprestimos = obterDados("emprestimos");

 const emprestimo = emprestimos.find(function (e) { return e.id === id; });

 if (!emprestimo || emprestimo.status !== "Emprestado") return;

 if (diasDeAtraso(emprestimo.dataPrevista) > 0) {

 avisar("Empréstimo em atraso. Registre a devolução.", "danger");

 return;

 }

 if ((emprestimo.renovacoes || 0) >= MAX_RENOVACOES) {

 avisar("Limite de " + MAX_RENOVACOES + " renovações atingido.", "danger");

 return;

 }

 const reservadoPorOutro = reservasAtivas().some(function (r) {

 return String(r.livroId) === String(emprestimo.livroId) &&
 r.codigoUsuario !== emprestimo.codigoUsuario;

 });

 if (reservadoPorOutro) {

 avisar("Este livro tem reserva de outro usuário e não pode ser renovado.", "danger");

 return;

 }

 emprestimo.dataPrevista = somarDias(emprestimo.dataPrevista, PRAZO_DIAS);

 emprestimo.renovacoes = (emprestimo.renovacoes || 0) + 1;

 salvarDados("emprestimos", emprestimos);

 avisar("Renovado. Nova devolução: " + formatarData(emprestimo.dataPrevista));

 renderTudo();

}


// =========================================
// RESERVAS

function reservarLivro() {

 const termoUsuario = valor("reservaUsuario");

 const termoLivro = valor("reservaLivro");

 if (!termoUsuario || !termoLivro) {

 avisar("Informe o usuário e o livro.", "warning");

 return;

 }

 const ru = localizar(obterDados("usuarios"), termoUsuario, ["codigo", "cpf"], ["nome"]);

 if (ru.varios) { avisar(descreverVarios(ru.varios, "codigo", "nome"), "warning"); return; }

 if (!ru.item) { avisar("Usuário não encontrado.", "danger"); return; }

 const livros = obterDados("livros");

 const rl = localizar(livros, termoLivro, ["codigo", "id", "isbn"], ["titulo"]);

 if (rl.varios) { avisar(descreverVarios(rl.varios, "codigo", "titulo"), "warning"); return; }

 if (!rl.item) { avisar("Livro não encontrado.", "danger"); return; }

 const usuario = ru.item;

 const livro = rl.item;

 if (usuarioBloqueado(usuario)) {

 avisar("Este usuário está bloqueado.", "danger");

 return;

 }

 const duplicada = reservasAtivas().some(function (r) {

 return r.codigoUsuario === usuario.codigo &&
 String(r.livroId) === String(livro.id);

 });

 if (duplicada) {

 avisar("Este usuário já reservou este livro.", "warning");

 return;

 }

 if (disponivelPara(livro, usuario.codigo) > 0) {

 avisar("Há exemplares disponíveis. Faça o empréstimo direto na aba Empréstimos.", "warning");

 return;

 }

 const reservas = obterDados("reservas");

 reservas.push({

 id: Date.now() + Math.floor(Math.random() * 100000),

 codigoUsuario: usuario.codigo,

 nomeUsuario: usuario.nome,

 livroId: livro.id,

 codigoExemplar: livro.codigo,

 titulo: livro.titulo,

 dataReserva: hojeISO(),

 status: ST_AGUARDANDO

 });

 salvarDados("reservas", reservas);

 preencher("reservaUsuario", "");

 preencher("reservaLivro", "");

 avisar("Reserva registrada para " + usuario.nome + ".");

 renderTudo();

}

function renderReservas() {

 const lista = reservasAtivas().sort(function (a, b) { return a.id - b.id; });

 if (lista.length === 0) {

 campo("tabelaReservas").innerHTML =
 '<tr><td colspan="5" class="text-center text-body-secondary py-4">' +
 'Nenhuma reserva ativa.</td></tr>';

 return;

 }

 campo("tabelaReservas").innerHTML = lista.map(function (r) {

 const pronta = r.status === ST_RETIRADA;

 return '<tr>' +
 '<td><strong>' + esc(r.nomeUsuario) + '</strong><br>' +
 '<small class="text-body-secondary">' + esc(r.codigoUsuario) + '</small></td>' +
 '<td>' + esc(r.titulo) + '<br>' +
 '<small class="text-body-secondary">' + esc(r.codigoExemplar) + '</small></td>' +
 '<td>' + formatarData(r.dataReserva) + '</td>' +
 '<td><span class="badge ' + (pronta ? "bg-success" : "bg-warning text-dark") + '">' +
 esc(r.status) + '</span></td>' +
 '<td class="text-end">' +
 (pronta
 ? '<button class="btn btn-sm btn-success me-1" onclick="emprestarReserva(' + r.id + ')">' +
 '<i class="bi bi-journal-arrow-up me-1"></i>Emprestar</button>'
 : '') +
 '<button class="btn btn-sm btn-outline-danger" onclick="cancelarReserva(' + r.id + ')">' +
 '<i class="bi bi-x-lg me-1"></i>Cancelar</button></td></tr>';

 }).join("");

}

// Leva a reserva liberada para a aba de empréstimo, já preenchida
function emprestarReserva(id) {

 const reserva = obterDados("reservas").find(function (r) { return r.id === id; });

 if (!reserva) return;

 mostrarAba("emprestimos");

 cancelarEmprestimo();

 preencher("codigoUsuario", reserva.codigoUsuario);

 buscarUsuario();

 preencher("codigoExemplar", reserva.codigoExemplar);

 buscarExemplar();

 window.scrollTo({ top: 0, behavior: "smooth" });

}

async function cancelarReserva(id) {

 const reservas = obterDados("reservas");

 const reserva = reservas.find(function (r) { return r.id === id; });

 if (!reserva) return;

 const ok = await confirmar(
 "Cancelar reserva",
 reserva.titulo + ", reservado por " + reserva.nomeUsuario + ".",
 "Cancelar reserva",
 "btn-danger"
 );

 if (!ok) return;

 reserva.status = "Cancelada";

 salvarDados("reservas", reservas);

 // Se o exemplar estava separado, passa para o próximo da fila
 promoverReservas(obterDados("livros"), reserva.livroId);

 avisar("Reserva cancelada.");

 renderTudo();

}


// =========================================
// ATUALIZAR TELA

function atualizarBadges() {

 campo("badgeDevolucoes").textContent = emprestimosAbertos().length;

 campo("badgeReservas").textContent = reservasAtivas().length;

}

function renderTudo() {

 renderAtivos("tabelaDevolucoes", "filtroDevolucao", "devolucao");

 renderAtivos("tabelaRenovacoes", "filtroRenovacao", "renovacao");

 renderReservas();

 atualizarBadges();

 atualizarListaObras();

}