
// MOSTRAR TELA DE CADASTRO


function mostrarCadastro() {

    document.getElementById("login").style.display = "none";
    document.getElementById("cadastro").style.display = "block";

}


// MOSTRAR TELA DE LOGIN

function mostrarLogin() {

    document.getElementById("cadastro").style.display = "none";
    document.getElementById("login").style.display = "block";

}


// CADASTRAR USUÁRIO


function cadastrar() {

    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("emailCadastro").value.trim();
    const senha = document.getElementById("senhaCadastro").value;
    const confirmar = document.getElementById("confirmarSenha").value;

    if(nome == "" || email == "" || senha == "" || confirmar == ""){

        alert("Preencha todos os campos.");

        return;

    }

    if(senha != confirmar){

        alert("As senhas não coincidem.");

        return;

    }

    const usuario = {

        nome: nome,

        email: email,

        senha: senha

    };

    localStorage.setItem("usuario", JSON.stringify(usuario));

    alert("Cadastro realizado com sucesso!");

    mostrarLogin();

}


// LOGIN


function entrar() {

    const email = document.getElementById("emailLogin").value.trim();
    const senha = document.getElementById("senhaLogin").value;

    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if(usuario == null){

        alert("Nenhum usuário cadastrado.");

        return;

    }

    if(email === usuario.email && senha === usuario.senha){

        localStorage.setItem("logado", "true");

        window.location.href = "{% templates 'dashboard/index.html' %}";

    }

    else{

        alert("E-mail ou senha incorretos.");

    }

}


// VERIFICAR LOGIN


function verificarLogin(){

    if(localStorage.getItem("logado") != "true"){

        window.location.href = "{% templates 'usuarios/login.html' %}";

    }

}


// LOGOUT


function sair(){

    localStorage.removeItem("logado");

    window.location.href = "{% templates 'usuarios/login.html' %}";

}


// TEMA


function alternarTema(){

    const body = document.body;

    if(body.getAttribute("data-bs-theme") == "dark"){

        body.setAttribute("data-bs-theme","light");

    }else{

        body.setAttribute("data-bs-theme","dark");

    }

}