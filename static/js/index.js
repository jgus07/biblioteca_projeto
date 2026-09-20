// ===============================
// VERIFICA SE O USUÁRIO ESTÁ LOGADO
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    verificarLogin();

    carregarUsuario();

    atualizarDashboard();

});


// ===============================
// VERIFICA LOGIN
// ===============================

function verificarLogin(){

    if(localStorage.getItem("logado") !== "true"){

        window.location.href = "login.html";

    }

}


// ===============================
// CARREGA O NOME DO USUÁRIO
// ===============================

function carregarUsuario(){

    const usuario =
        JSON.parse(localStorage.getItem("usuario"));

    if(usuario){

        document.getElementById("nomeUsuario").textContent =
            usuario.nome;

    }

}


// ===============================
// DASHBOARD
// ===============================

function atualizarDashboard(){

    const livros =
        JSON.parse(localStorage.getItem("livros")) || [];


    document.getElementById("totalLivros").textContent =
        livros.length;


    document.getElementById("livrosDisponiveis").textContent =
        livros.filter(
            l => l.status === "Disponível"
        ).length;


    document.getElementById("livrosEmprestados").textContent =
        livros.filter(
            l => l.status === "Emprestado"
        ).length;

}


// ===============================
// PESQUISAR
// ===============================

function pesquisarLivro(){

    const pesquisa =
        document
        .getElementById("pesquisa")
        .value
        .toLowerCase();


    const livros =
        JSON.parse(localStorage.getItem("livros")) || [];


    const resultado =
        livros.filter(livro =>

            livro.titulo
                .toLowerCase()
                .includes(pesquisa)

        );


    console.log(resultado);


    alert(
        "Pesquisa simulada.\n\n" +
        "Foram encontrados " +
        resultado.length +
        " livro(s)."
    );

}


// ===============================
// BOTÕES
// ===============================

function verLivros(){

    window.location.href = "../Tela_Consultar/consultar.html";

}


// ADICIONAR LIVRO

function adicionarLivro(){

    window.location.href = "../Tela_Add/add.html";

}


// EMPRESTAR

function emprestarLivro(){

   window.location.href = "../Tela_Emprestimos/emprestimo.html";

}


// STATUS

function statusLivro(){

    alert("Tela de status em desenvolvimento.");

}


// ===============================
// TEMA
// ===============================

function alternarTema(){

    const body = document.body;


    if(
        body.getAttribute("data-bs-theme") === "dark"
    ){

        body.setAttribute(
            "data-bs-theme",
            "light"
        );

    }else{

        body.setAttribute(
            "data-bs-theme",
            "dark"
        );

    }

}


// ===============================
// SAIR
// ===============================

function sair(){

    localStorage.removeItem("logado");

    window.location.href = "../Tela_Login/login.html";

}