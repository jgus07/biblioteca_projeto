const form = document.getElementById("formLivro");
const mensagem = document.getElementById("mensagem");


form.addEventListener("submit", function(event){

    event.preventDefault();


    // Cria o objeto do livro

    const livro = {

        id: Date.now(),

        titulo: document
            .getElementById("titulo")
            .value
            .trim(),

        autor: document
            .getElementById("autor")
            .value
            .trim(),

        ano: document
            .getElementById("ano")
            .value,

        editora: document
            .getElementById("editora")
            .value
            .trim(),

        isbn: document
            .getElementById("isbn")
            .value
            .trim(),

        categoria: document
            .getElementById("categoria")
            .value,

        quantidade: document
            .getElementById("quantidade")
            .value,

        localizacao: document
            .getElementById("localizacao")
            .value
            .trim(),

        descricao: document
            .getElementById("descricao")
            .value
            .trim(),

        status: "Disponível"

    };


    // Busca os livros existentes

    let livros =
        JSON.parse(
            localStorage.getItem("livros")
        ) || [];


    // Adiciona o novo livro

    livros.push(livro);


    // Salva os livros

    localStorage.setItem(
        "livros",
        JSON.stringify(livros)
    );


    // Mostra mensagem

    mensagem.className =
        "alert alert-success mt-4";

    mensagem.innerHTML = `

        <i class="bi bi-check-circle-fill"></i>

        <strong>Livro cadastrado!</strong>

        O livro
        <strong>${livro.titulo}</strong>
        foi adicionado com sucesso.

    `;


    // Limpa o formulário

    form.reset();


    // Volta para o dashboard

    setTimeout(function(){

        window.location.href = "../dashboard/index.html";

    }, 1500);

});