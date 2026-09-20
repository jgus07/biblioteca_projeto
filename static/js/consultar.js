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
}