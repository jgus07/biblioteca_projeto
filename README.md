# 📚 Sistema de Gerenciamento de Biblioteca

## Descrição

O projeto consiste em um Sistema de Gerenciamento de Biblioteca, que abrange desde o cadastro do administrador responsável pelo acervo até o registro dos usuários autorizados a realizar empréstimos, proporcionando maior organização, agilidade e controle sobre os livros e suas movimentações.

## Objetivos

- Desenvolver um sistema para cadastro e gerenciamento do acervo bibliográfico;
- Permitir o cadastro e gerenciamento dos usuários da biblioteca;
- Automatizar o processo de empréstimo e devolução de exemplares;
- Registrar e controlar as datas de empréstimo e devolução dos materiais;
- Criar um histórico de movimentações realizadas pelos usuários;
- Facilitar a localização e consulta de títulos disponíveis no acervo;
- Reduzir perdas, extravios e inconsistências no controle dos livros;
- Melhorar a organização e a eficiência dos processos administrativos da biblioteca escolar;
- Proporcionar maior praticidade e agilidade no atendimento aos usuários.

## Funcionalidades

- Cadastro e gerenciamento de livros (acervo);
- Cadastro e gerenciamento de usuários;
- Registro de empréstimos e devoluções;
- Controle de datas de empréstimo e devolução;
- Histórico de movimentações;
- Dashboard com visão geral do sistema.

## Tecnologias utilizadas

- Python
- Django
- HTML / CSS / JavaScript
- SQLite (banco de dados padrão do Django)

## Estrutura do projeto

```
biblioteca_projeto/
├── dashboard/       # Painel com visão geral do sistema
├── livros/          # Gerenciamento do acervo bibliográfico
├── usuarios/        # Cadastro e gerenciamento de usuários
├── setup/           # Configurações do projeto Django
├── static/          # Arquivos estáticos (CSS, JS, imagens)
├── templates/       # Templates HTML
├── manage.py
└── requirements.txt
```

## Como executar o projeto

### Pré-requisitos

- Python 3.13.7
- Git instalado
- Pip (gerenciador de pacotes do Python)
- Um editor de código, como o Visual Studio Code (opcional)

### Passo a passo

**1. Clonar o repositório**

```bash
git clone https://github.com/jgus07/biblioteca_projeto.git
cd biblioteca_projeto
```

**2. Criar o ambiente virtual**

```bash
python -m venv ./venv
```

Ative o ambiente:

No Windows:

```bash
venv\Scripts\activate
```

No Linux ou Mac:

```bash
source venv/bin/activate
```

**3. Instalar as dependências**

```bash
pip install -r requirements.txt
```

**4. Criar o banco de dados**

```bash
python manage.py migrate
```

**5. (Opcional) Criar um superusuário**

Para acessar a área administrativa do Django:

```bash
python manage.py createsuperuser
```

**6. Rodar o projeto**

```bash
python manage.py runserver
```

Acesse [http://localhost:8000/](http://localhost:8000/) no navegador.

## Licença

Este projeto está licenciado sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

## Autores

- Darlan Vinícius Bune de Bezerra
- Lucas Rafael Nunes da Silva
- Jhonatan Gustavo da Silva Jandir
