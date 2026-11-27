DROP DATABASE IF EXISTS biblioteca_escolar;

CREATE DATABASE biblioteca_escolar
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE biblioteca_escolar;

CREATE TABLE contas (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    email       VARCHAR(160) NOT NULL UNIQUE,
    senha_hash  VARCHAR(255) NOT NULL,
    criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categorias (
    id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome  VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE livros (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo                VARCHAR(10)  NOT NULL UNIQUE,
    titulo                VARCHAR(200) NOT NULL,
    autor                 VARCHAR(150) NOT NULL,
    ano                   SMALLINT UNSIGNED NOT NULL,
    editora               VARCHAR(120) NOT NULL,
    isbn                  VARCHAR(20)  NULL,
    categoria_id          INT UNSIGNED NOT NULL,
    quantidade            INT UNSIGNED NOT NULL DEFAULT 1,
    quantidade_disponivel INT UNSIGNED NOT NULL DEFAULT 1,
    localizacao           VARCHAR(100) NULL,
    descricao             TEXT NULL,
    criado_em             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(12) GENERATED ALWAYS AS (
        IF(quantidade_disponivel > 0, 'Disponível', 'Emprestado')
    ) STORED,
    CONSTRAINT fk_livros_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    CONSTRAINT ck_livros_quantidade CHECK (quantidade >= 1),
    CONSTRAINT ck_livros_disponivel CHECK (quantidade_disponivel <= quantidade),
    CONSTRAINT ck_livros_ano CHECK (ano BETWEEN 0 AND 2100),
    INDEX idx_livros_titulo (titulo),
    INDEX idx_livros_isbn (isbn)
);

CREATE TABLE usuarios (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo              VARCHAR(10)  NOT NULL UNIQUE,
    nome                VARCHAR(120) NOT NULL,
    cpf                 VARCHAR(20)  NULL UNIQUE,
    sexo                VARCHAR(15)  NULL,
    grau                VARCHAR(40)  NULL,
    turno               VARCHAR(15)  NULL,
    curso               VARCHAR(80)  NULL,
    limite_emprestimos  TINYINT UNSIGNED NOT NULL DEFAULT 3,
    status              ENUM('Ativo','Bloqueado') NOT NULL DEFAULT 'Ativo',
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usuarios_nome (nome)
);

CREATE TABLE emprestimos (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id       INT UNSIGNED NOT NULL,
    livro_id         INT UNSIGNED NOT NULL,
    quantidade       INT UNSIGNED NOT NULL DEFAULT 1,
    data_emprestimo  DATE NOT NULL,
    data_prevista    DATE NOT NULL,
    data_devolucao   DATE NULL,
    renovacoes       TINYINT UNSIGNED NOT NULL DEFAULT 0,
    status           ENUM('Emprestado','Devolvido') NOT NULL DEFAULT 'Emprestado',
    CONSTRAINT fk_emp_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT fk_emp_livro   FOREIGN KEY (livro_id)   REFERENCES livros(id),
    CONSTRAINT ck_emp_qtd     CHECK (quantidade >= 1),
    CONSTRAINT ck_emp_datas   CHECK (data_prevista >= data_emprestimo),
    INDEX idx_emp_status_prevista (status, data_prevista),
    INDEX idx_emp_usuario (usuario_id, status),
    INDEX idx_emp_livro (livro_id)
);

CREATE TABLE reservas (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id    INT UNSIGNED NOT NULL,
    livro_id      INT UNSIGNED NOT NULL,
    data_reserva  DATE NOT NULL DEFAULT (CURRENT_DATE),
    status        ENUM('Aguardando','Disponível para retirada','Atendida','Cancelada')
                  NOT NULL DEFAULT 'Aguardando',
    CONSTRAINT fk_res_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT fk_res_livro   FOREIGN KEY (livro_id)   REFERENCES livros(id),
    INDEX idx_res_livro_status (livro_id, status),
    INDEX idx_res_usuario (usuario_id)
);

CREATE VIEW vw_dashboard AS
SELECT
    COALESCE(SUM(quantidade), 0)                          AS total_livros,
    COALESCE(SUM(quantidade_disponivel), 0)               AS disponiveis,
    COALESCE(SUM(quantidade - quantidade_disponivel), 0)  AS emprestados
FROM livros;

CREATE VIEW vw_emprestimos_abertos AS
SELECT
    e.id,
    u.codigo                              AS codigo_usuario,
    u.nome                                AS nome_usuario,
    l.codigo                              AS codigo_exemplar,
    l.titulo,
    e.quantidade,
    e.data_emprestimo,
    e.data_prevista,
    e.renovacoes,
    DATEDIFF(CURDATE(), e.data_prevista)  AS dias_atraso,
    CASE
        WHEN DATEDIFF(CURDATE(), e.data_prevista) > 0 THEN 'Em atraso'
        WHEN DATEDIFF(CURDATE(), e.data_prevista) = 0 THEN 'Vence hoje'
        ELSE 'No prazo'
    END                                   AS situacao
FROM emprestimos e
JOIN usuarios u ON u.id = e.usuario_id
JOIN livros   l ON l.id = e.livro_id
WHERE e.status = 'Emprestado';

CREATE VIEW vw_titulos_em_uso AS
SELECT
    u.id AS usuario_id,
    u.codigo,
    u.nome,
    u.limite_emprestimos,
    COALESCE(SUM(e.quantidade), 0) AS em_uso
FROM usuarios u
LEFT JOIN emprestimos e
       ON e.usuario_id = u.id AND e.status = 'Emprestado'
GROUP BY u.id, u.codigo, u.nome, u.limite_emprestimos;

CREATE VIEW vw_reservas_ativas AS
SELECT
    r.id,
    u.codigo AS codigo_usuario,
    u.nome   AS nome_usuario,
    l.codigo AS codigo_exemplar,
    l.titulo,
    r.data_reserva,
    r.status
FROM reservas r
JOIN usuarios u ON u.id = r.usuario_id
JOIN livros   l ON l.id = r.livro_id
WHERE r.status IN ('Aguardando','Disponível para retirada')
ORDER BY r.id;

DELIMITER $$

CREATE PROCEDURE sp_emprestar(
    IN p_usuario_id INT UNSIGNED,
    IN p_livro_id   INT UNSIGNED,
    IN p_quantidade INT UNSIGNED
)
BEGIN
    DECLARE v_limite     INT;
    DECLARE v_status     VARCHAR(12);
    DECLARE v_em_uso     INT;
    DECLARE v_atrasos    INT;
    DECLARE v_disponivel INT;
    DECLARE v_separados  INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_quantidade < 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Informe uma quantidade válida.';
    END IF;

    START TRANSACTION;

    SELECT limite_emprestimos, status
      INTO v_limite, v_status
      FROM usuarios WHERE id = p_usuario_id FOR UPDATE;

    IF v_limite IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuário não encontrado.';
    END IF;

    IF v_status = 'Bloqueado' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Este usuário está bloqueado para empréstimos.';
    END IF;

    SELECT COUNT(*) INTO v_atrasos
      FROM emprestimos
     WHERE usuario_id = p_usuario_id
       AND status = 'Emprestado'
       AND data_prevista < CURDATE();

    IF v_atrasos > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuário com empréstimo em atraso.';
    END IF;

    SELECT COALESCE(SUM(quantidade), 0) INTO v_em_uso
      FROM emprestimos
     WHERE usuario_id = p_usuario_id AND status = 'Emprestado';

    IF v_em_uso + p_quantidade > v_limite THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'O usuário ultrapassaria o limite de empréstimos.';
    END IF;

    SELECT quantidade_disponivel INTO v_disponivel
      FROM livros WHERE id = p_livro_id FOR UPDATE;

    IF v_disponivel IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Livro não encontrado.';
    END IF;

    SELECT COUNT(*) INTO v_separados
      FROM reservas
     WHERE livro_id = p_livro_id
       AND status = 'Disponível para retirada'
       AND usuario_id <> p_usuario_id;

    IF v_disponivel - v_separados < p_quantidade THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exemplares insuficientes.';
    END IF;

    INSERT INTO emprestimos
        (usuario_id, livro_id, quantidade, data_emprestimo, data_prevista)
    VALUES
        (p_usuario_id, p_livro_id, p_quantidade, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY));

    UPDATE livros
       SET quantidade_disponivel = quantidade_disponivel - p_quantidade
     WHERE id = p_livro_id;

    UPDATE reservas
       SET status = 'Atendida'
     WHERE usuario_id = p_usuario_id
       AND livro_id = p_livro_id
       AND status IN ('Aguardando','Disponível para retirada');

    COMMIT;
END$$

CREATE PROCEDURE sp_devolver(IN p_emprestimo_id INT UNSIGNED)
BEGIN
    DECLARE v_livro_id   INT UNSIGNED;
    DECLARE v_quantidade INT UNSIGNED;
    DECLARE v_status     VARCHAR(12);
    DECLARE v_disp       INT;
    DECLARE v_separados  INT;
    DECLARE v_livres     INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT livro_id, quantidade, status
      INTO v_livro_id, v_quantidade, v_status
      FROM emprestimos WHERE id = p_emprestimo_id FOR UPDATE;

    IF v_livro_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Empréstimo não encontrado.';
    END IF;

    IF v_status <> 'Emprestado' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Este empréstimo já foi devolvido.';
    END IF;

    UPDATE emprestimos
       SET status = 'Devolvido', data_devolucao = CURDATE()
     WHERE id = p_emprestimo_id;

    UPDATE livros
       SET quantidade_disponivel = LEAST(quantidade, quantidade_disponivel + v_quantidade)
     WHERE id = v_livro_id;

    SELECT quantidade_disponivel INTO v_disp FROM livros WHERE id = v_livro_id;

    SELECT COUNT(*) INTO v_separados
      FROM reservas
     WHERE livro_id = v_livro_id AND status = 'Disponível para retirada';

    SET v_livres = GREATEST(v_disp - v_separados, 0);

    IF v_livres > 0 THEN
        UPDATE reservas
           SET status = 'Disponível para retirada'
         WHERE livro_id = v_livro_id AND status = 'Aguardando'
         ORDER BY id
         LIMIT v_livres;
    END IF;

    COMMIT;
END$$

CREATE PROCEDURE sp_renovar(IN p_emprestimo_id INT UNSIGNED)
BEGIN
    DECLARE v_usuario_id INT UNSIGNED;
    DECLARE v_livro_id   INT UNSIGNED;
    DECLARE v_prevista   DATE;
    DECLARE v_renovacoes INT;
    DECLARE v_status     VARCHAR(12);
    DECLARE v_reservas   INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT usuario_id, livro_id, data_prevista, renovacoes, status
      INTO v_usuario_id, v_livro_id, v_prevista, v_renovacoes, v_status
      FROM emprestimos WHERE id = p_emprestimo_id FOR UPDATE;

    IF v_livro_id IS NULL OR v_status <> 'Emprestado' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Empréstimo não encontrado ou já devolvido.';
    END IF;

    IF v_prevista < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Empréstimo em atraso. Registre a devolução.';
    END IF;

    IF v_renovacoes >= 2 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Limite de 2 renovações atingido.';
    END IF;

    SELECT COUNT(*) INTO v_reservas
      FROM reservas
     WHERE livro_id = v_livro_id
       AND usuario_id <> v_usuario_id
       AND status IN ('Aguardando','Disponível para retirada');

    IF v_reservas > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Livro reservado por outro usuário.';
    END IF;

    UPDATE emprestimos
       SET data_prevista = DATE_ADD(data_prevista, INTERVAL 7 DAY),
           renovacoes    = renovacoes + 1
     WHERE id = p_emprestimo_id;

    COMMIT;
END$$

CREATE PROCEDURE sp_reservar(
    IN p_usuario_id INT UNSIGNED,
    IN p_livro_id   INT UNSIGNED
)
BEGIN
    DECLARE v_status     VARCHAR(12);
    DECLARE v_disponivel INT;
    DECLARE v_separados  INT;
    DECLARE v_duplicada  INT;

    SELECT status INTO v_status FROM usuarios WHERE id = p_usuario_id;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuário não encontrado.';
    END IF;

    IF v_status = 'Bloqueado' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Este usuário está bloqueado.';
    END IF;

    SELECT quantidade_disponivel INTO v_disponivel FROM livros WHERE id = p_livro_id;

    IF v_disponivel IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Livro não encontrado.';
    END IF;

    SELECT COUNT(*) INTO v_duplicada
      FROM reservas
     WHERE usuario_id = p_usuario_id AND livro_id = p_livro_id
       AND status IN ('Aguardando','Disponível para retirada');

    IF v_duplicada > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Este usuário já reservou este livro.';
    END IF;

    SELECT COUNT(*) INTO v_separados
      FROM reservas
     WHERE livro_id = p_livro_id
       AND status = 'Disponível para retirada'
       AND usuario_id <> p_usuario_id;

    IF v_disponivel - v_separados > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Há exemplares disponíveis. Faça o empréstimo direto.';
    END IF;

    INSERT INTO reservas (usuario_id, livro_id) VALUES (p_usuario_id, p_livro_id);
END$$

CREATE PROCEDURE sp_cancelar_reserva(IN p_reserva_id INT UNSIGNED)
BEGIN
    DECLARE v_livro_id  INT UNSIGNED;
    DECLARE v_status    VARCHAR(30);
    DECLARE v_disp      INT;
    DECLARE v_separados INT;
    DECLARE v_livres    INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT livro_id, status
      INTO v_livro_id, v_status
      FROM reservas WHERE id = p_reserva_id FOR UPDATE;

    IF v_livro_id IS NULL OR v_status NOT IN ('Aguardando','Disponível para retirada') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reserva não encontrada ou já encerrada.';
    END IF;

    UPDATE reservas SET status = 'Cancelada' WHERE id = p_reserva_id;

    SELECT quantidade_disponivel INTO v_disp FROM livros WHERE id = v_livro_id;

    SELECT COUNT(*) INTO v_separados
      FROM reservas
     WHERE livro_id = v_livro_id AND status = 'Disponível para retirada';

    SET v_livres = GREATEST(v_disp - v_separados, 0);

    IF v_livres > 0 THEN
        UPDATE reservas
           SET status = 'Disponível para retirada'
         WHERE livro_id = v_livro_id AND status = 'Aguardando'
         ORDER BY id
         LIMIT v_livres;
    END IF;

    COMMIT;
END$$

DELIMITER ;

INSERT INTO categorias (nome) VALUES
    ('Literatura'),
    ('Romance'),
    ('Ficção'),
    ('História'),
    ('Ciência'),
    ('Tecnologia'),
    ('Didático'),
    ('Outros');

INSERT INTO livros
    (codigo, titulo, autor, ano, editora, isbn, categoria_id,
     quantidade, quantidade_disponivel, localizacao)
VALUES
    ('L0001', 'Dom Casmurro', 'Machado de Assis', 1899, 'Garnier', '978-85-10037-01-3', 1, 4, 4, 'Estante A - Prateleira 1'),
    ('L0002', 'Memórias Póstumas de Brás Cubas', 'Machado de Assis', 1881, 'Garnier', '978-85-10074-02-5', 1, 1, 1, 'Estante A - Prateleira 2'),
    ('L0003', 'Quincas Borba', 'Machado de Assis', 1891, 'Garnier', '978-85-10111-03-4', 1, 1, 1, 'Estante A - Prateleira 3'),
    ('L0004', 'O Cortiço', 'Aluísio Azevedo', 1890, 'Garnier', '978-85-10148-04-7', 1, 4, 4, 'Estante A - Prateleira 4'),
    ('L0005', 'Vidas Secas', 'Graciliano Ramos', 1938, 'Record', '978-85-10185-05-9', 1, 2, 2, 'Estante A - Prateleira 1'),
    ('L0006', 'São Bernardo', 'Graciliano Ramos', 1934, 'Record', '978-85-10222-06-8', 1, 2, 2, 'Estante A - Prateleira 2'),
    ('L0007', 'Grande Sertão: Veredas', 'João Guimarães Rosa', 1956, 'Nova Fronteira', '978-85-10259-07-1', 1, 2, 2, 'Estante A - Prateleira 3'),
    ('L0008', 'A Hora da Estrela', 'Clarice Lispector', 1977, 'Rocco', '978-85-10296-08-3', 1, 2, 2, 'Estante A - Prateleira 4'),
    ('L0009', 'O Primo Basílio', 'Eça de Queirós', 1878, 'Companhia das Letras', '978-85-10333-09-2', 1, 4, 4, 'Estante A - Prateleira 1'),
    ('L0010', 'Capitães da Areia', 'Jorge Amado', 1937, 'Companhia das Letras', '978-85-10370-10-3', 1, 1, 1, 'Estante A - Prateleira 2'),
    ('L0011', 'Macunaíma', 'Mário de Andrade', 1928, 'Itatiaia', '978-85-10407-11-3', 1, 4, 4, 'Estante A - Prateleira 3'),
    ('L0012', 'O Guarani', 'José de Alencar', 1857, 'Ática', '978-85-10444-12-5', 1, 4, 4, 'Estante A - Prateleira 4'),
    ('L0013', 'Iracema', 'José de Alencar', 1865, 'Ática', '978-85-10481-13-7', 1, 3, 3, 'Estante A - Prateleira 1'),
    ('L0014', 'Triste Fim de Policarpo Quaresma', 'Lima Barreto', 1915, 'Companhia das Letras', '978-85-10518-14-7', 1, 1, 1, 'Estante A - Prateleira 2'),
    ('L0015', 'Os Lusíadas', 'Luís de Camões', 1572, 'Martin Claret', '978-85-10555-15-9', 1, 3, 3, 'Estante A - Prateleira 3'),
    ('L0016', 'Auto da Compadecida', 'Ariano Suassuna', 1955, 'Nova Fronteira', '978-85-10592-16-1', 1, 3, 3, 'Estante A - Prateleira 4'),
    ('L0017', 'O Quinze', 'Rachel de Queiroz', 1930, 'José Olympio', '978-85-10629-17-1', 1, 1, 1, 'Estante A - Prateleira 1'),
    ('L0018', 'A Moreninha', 'Joaquim Manuel de Macedo', 1844, 'Ática', '978-85-10666-18-3', 1, 1, 1, 'Estante A - Prateleira 2'),
    ('L0019', 'O Ateneu', 'Raul Pompeia', 1888, 'Ática', '978-85-10703-19-2', 1, 1, 1, 'Estante A - Prateleira 3'),
    ('L0020', 'Memórias de um Sargento de Milícias', 'Manuel Antônio de Almeida', 1853, 'Ática', '978-85-10740-20-3', 1, 2, 2, 'Estante A - Prateleira 4'),
    ('L0021', 'Dom Quixote', 'Miguel de Cervantes', 1605, 'Editora 34', '978-85-10777-21-6', 1, 2, 2, 'Estante A - Prateleira 1'),
    ('L0022', 'Crime e Castigo', 'Fiódor Dostoiévski', 1866, 'Editora 34', '978-85-10814-22-5', 1, 3, 3, 'Estante A - Prateleira 2'),
    ('L0023', 'A Metamorfose', 'Franz Kafka', 1915, 'Companhia das Letras', '978-85-10851-23-7', 1, 3, 3, 'Estante A - Prateleira 3'),
    ('L0024', 'O Velho e o Mar', 'Ernest Hemingway', 1952, 'Bertrand Brasil', '978-85-10888-24-0', 1, 1, 1, 'Estante A - Prateleira 4'),
    ('L0025', 'O Grande Gatsby', 'F. Scott Fitzgerald', 1925, 'Martin Claret', '978-85-10925-25-9', 1, 3, 3, 'Estante A - Prateleira 1'),
    ('L0026', 'Meu Pé de Laranja Lima', 'José Mauro de Vasconcelos', 1968, 'Melhoramentos', '978-85-10962-26-1', 1, 2, 2, 'Estante A - Prateleira 2'),
    ('L0027', 'Reinações de Narizinho', 'Monteiro Lobato', 1931, 'Brasiliense', '978-85-10999-27-4', 1, 4, 4, 'Estante A - Prateleira 3'),
    ('L0028', 'Cem Anos de Solidão', 'Gabriel García Márquez', 1967, 'Record', '978-85-11036-28-2', 1, 4, 4, 'Estante A - Prateleira 4'),
    ('L0029', 'Ensaio sobre a Cegueira', 'José Saramago', 1995, 'Companhia das Letras', '978-85-11073-29-4', 1, 4, 4, 'Estante A - Prateleira 1'),
    ('L0030', 'Orgulho e Preconceito', 'Jane Austen', 1813, 'Martin Claret', '978-85-11110-30-2', 2, 3, 3, 'Estante B - Prateleira 1'),
    ('L0031', 'Razão e Sensibilidade', 'Jane Austen', 1811, 'Martin Claret', '978-85-11147-31-5', 2, 3, 3, 'Estante B - Prateleira 2'),
    ('L0032', 'Jane Eyre', 'Charlotte Brontë', 1847, 'Zahar', '978-85-11184-32-7', 2, 2, 2, 'Estante B - Prateleira 3'),
    ('L0033', 'O Morro dos Ventos Uivantes', 'Emily Brontë', 1847, 'Zahar', '978-85-11221-33-6', 2, 3, 3, 'Estante B - Prateleira 4'),
    ('L0034', 'Anna Kariênina', 'Liev Tolstói', 1878, 'Companhia das Letras', '978-85-11258-34-9', 2, 3, 3, 'Estante B - Prateleira 1'),
    ('L0035', 'Madame Bovary', 'Gustave Flaubert', 1857, 'Companhia das Letras', '978-85-11295-35-1', 2, 2, 2, 'Estante B - Prateleira 2'),
    ('L0036', 'Romeu e Julieta', 'William Shakespeare', 1597, 'L&PM', '978-85-11332-36-0', 2, 5, 5, 'Estante B - Prateleira 3'),
    ('L0037', 'O Amor nos Tempos do Cólera', 'Gabriel García Márquez', 1985, 'Record', '978-85-11369-37-3', 2, 5, 5, 'Estante B - Prateleira 4'),
    ('L0038', 'Senhora', 'José de Alencar', 1875, 'Ática', '978-85-11406-38-2', 2, 1, 1, 'Estante B - Prateleira 1'),
    ('L0039', 'A Escrava Isaura', 'Bernardo Guimarães', 1875, 'Ática', '978-85-11443-39-4', 2, 5, 5, 'Estante B - Prateleira 2'),
    ('L0040', 'A Culpa é das Estrelas', 'John Green', 2012, 'Intrínseca', '978-85-11480-40-5', 2, 5, 5, 'Estante B - Prateleira 3'),
    ('L0041', '1984', 'George Orwell', 1949, 'Companhia das Letras', '978-85-11517-41-5', 3, 2, 2, 'Estante C - Prateleira 1'),
    ('L0042', 'A Revolução dos Bichos', 'George Orwell', 1945, 'Companhia das Letras', '978-85-11554-42-7', 3, 4, 4, 'Estante C - Prateleira 2'),
    ('L0043', 'Admirável Mundo Novo', 'Aldous Huxley', 1932, 'Globo', '978-85-11591-43-9', 3, 3, 3, 'Estante C - Prateleira 3'),
    ('L0044', 'Fahrenheit 451', 'Ray Bradbury', 1953, 'Globo', '978-85-11628-44-9', 3, 2, 2, 'Estante C - Prateleira 4'),
    ('L0045', 'O Hobbit', 'J. R. R. Tolkien', 1937, 'HarperCollins', '978-85-11665-45-1', 3, 2, 2, 'Estante C - Prateleira 1'),
    ('L0046', 'O Senhor dos Anéis: A Sociedade do Anel', 'J. R. R. Tolkien', 1954, 'HarperCollins', '978-85-11702-46-0', 3, 2, 2, 'Estante C - Prateleira 2'),
    ('L0047', 'O Leão, a Feiticeira e o Guarda-Roupa', 'C. S. Lewis', 1950, 'WMF Martins Fontes', '978-85-11739-47-3', 3, 2, 2, 'Estante C - Prateleira 3'),
    ('L0048', 'Harry Potter e a Pedra Filosofal', 'J. K. Rowling', 1997, 'Rocco', '978-85-11776-48-5', 3, 5, 5, 'Estante C - Prateleira 4'),
    ('L0049', 'O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 1943, 'Agir', '978-85-11813-49-4', 3, 2, 2, 'Estante C - Prateleira 1'),
    ('L0050', 'Duna', 'Frank Herbert', 1965, 'Aleph', '978-85-11850-50-5', 3, 1, 1, 'Estante C - Prateleira 2'),
    ('L0051', 'Fundação', 'Isaac Asimov', 1951, 'Aleph', '978-85-11887-51-8', 3, 1, 1, 'Estante C - Prateleira 3'),
    ('L0052', 'Eu, Robô', 'Isaac Asimov', 1950, 'Aleph', '978-85-11924-52-7', 3, 3, 3, 'Estante C - Prateleira 4'),
    ('L0053', 'Frankenstein', 'Mary Shelley', 1818, 'Darkside', '978-85-11961-53-9', 3, 1, 1, 'Estante C - Prateleira 1'),
    ('L0054', 'Drácula', 'Bram Stoker', 1897, 'Darkside', '978-85-11998-54-2', 3, 2, 2, 'Estante C - Prateleira 2'),
    ('L0055', 'Viagem ao Centro da Terra', 'Júlio Verne', 1864, 'Zahar', '978-85-12035-55-0', 3, 5, 5, 'Estante C - Prateleira 3'),
    ('L0056', 'Vinte Mil Léguas Submarinas', 'Júlio Verne', 1870, 'Zahar', '978-85-12072-56-2', 3, 2, 2, 'Estante C - Prateleira 4'),
    ('L0057', 'A Máquina do Tempo', 'H. G. Wells', 1895, 'Suma', '978-85-12109-57-2', 3, 3, 3, 'Estante C - Prateleira 1'),
    ('L0058', 'A Guerra dos Mundos', 'H. G. Wells', 1898, 'Suma', '978-85-12146-58-4', 3, 2, 2, 'Estante C - Prateleira 2'),
    ('L0059', 'Alice no País das Maravilhas', 'Lewis Carroll', 1865, 'Zahar', '978-85-12183-59-6', 3, 5, 5, 'Estante C - Prateleira 3'),
    ('L0060', 'O Código Da Vinci', 'Dan Brown', 2003, 'Arqueiro', '978-85-12220-60-4', 3, 1, 1, 'Estante C - Prateleira 4'),
    ('L0061', 'Um Estudo em Vermelho', 'Arthur Conan Doyle', 1887, 'Zahar', '978-85-12257-61-7', 3, 4, 4, 'Estante C - Prateleira 1'),
    ('L0062', 'Assassinato no Expresso do Oriente', 'Agatha Christie', 1934, 'HarperCollins', '978-85-12294-62-9', 3, 3, 3, 'Estante C - Prateleira 2'),
    ('L0063', 'O Alquimista', 'Paulo Coelho', 1988, 'Rocco', '978-85-12331-63-8', 3, 3, 3, 'Estante C - Prateleira 3'),
    ('L0064', 'O Conde de Monte Cristo', 'Alexandre Dumas', 1844, 'Zahar', '978-85-12368-64-1', 3, 1, 1, 'Estante C - Prateleira 4'),
    ('L0065', 'Percy Jackson e o Ladrão de Raios', 'Rick Riordan', 2005, 'Intrínseca', '978-85-12405-65-0', 3, 3, 3, 'Estante C - Prateleira 1'),
    ('L0066', 'Jogos Vorazes', 'Suzanne Collins', 2008, 'Rocco', '978-85-12442-66-2', 3, 1, 1, 'Estante C - Prateleira 2'),
    ('L0067', 'Extraordinário', 'R. J. Palacio', 2012, 'Intrínseca', '978-85-12479-67-5', 3, 3, 3, 'Estante C - Prateleira 3'),
    ('L0068', 'Coraline', 'Neil Gaiman', 2002, 'Rocco', '978-85-12516-68-4', 3, 2, 2, 'Estante C - Prateleira 4'),
    ('L0069', 'A Menina que Roubava Livros', 'Markus Zusak', 2005, 'Intrínseca', '978-85-12553-69-6', 3, 5, 5, 'Estante C - Prateleira 1'),
    ('L0070', 'O Menino do Pijama Listrado', 'John Boyne', 2006, 'Companhia das Letras', '978-85-12590-70-7', 3, 4, 4, 'Estante C - Prateleira 2'),
    ('L0071', 'Diário de um Banana', 'Jeff Kinney', 2007, 'V&R Editoras', '978-85-12627-71-7', 3, 3, 3, 'Estante C - Prateleira 3'),
    ('L0072', 'Casa-Grande & Senzala', 'Gilberto Freyre', 1933, 'Global', '978-85-12664-72-9', 4, 5, 5, 'Estante D - Prateleira 1'),
    ('L0073', 'Raízes do Brasil', 'Sérgio Buarque de Holanda', 1936, 'Companhia das Letras', '978-85-12701-73-8', 4, 2, 2, 'Estante D - Prateleira 2'),
    ('L0074', 'Os Sertões', 'Euclides da Cunha', 1902, 'Ateliê Editorial', '978-85-12738-74-1', 4, 3, 3, 'Estante D - Prateleira 3'),
    ('L0075', 'Sapiens: Uma Breve História da Humanidade', 'Yuval Noah Harari', 2011, 'L&PM', '978-85-12775-75-3', 4, 2, 2, 'Estante D - Prateleira 4'),
    ('L0076', '1808', 'Laurentino Gomes', 2007, 'Planeta', '978-85-12812-76-2', 4, 4, 4, 'Estante D - Prateleira 1'),
    ('L0077', 'O Diário de Anne Frank', 'Anne Frank', 1947, 'Record', '978-85-12849-77-5', 4, 1, 1, 'Estante D - Prateleira 2'),
    ('L0078', 'Uma Breve História do Tempo', 'Stephen Hawking', 1988, 'Intrínseca', '978-85-12886-78-7', 5, 1, 1, 'Estante E - Prateleira 1'),
    ('L0079', 'Cosmos', 'Carl Sagan', 1980, 'Companhia das Letras', '978-85-12923-79-6', 5, 4, 4, 'Estante E - Prateleira 2'),
    ('L0080', 'A Origem das Espécies', 'Charles Darwin', 1859, 'Martin Claret', '978-85-12960-80-7', 5, 2, 2, 'Estante E - Prateleira 3'),
    ('L0081', 'O Gene Egoísta', 'Richard Dawkins', 1976, 'Companhia das Letras', '978-85-12997-81-0', 5, 5, 5, 'Estante E - Prateleira 4'),
    ('L0082', 'Astrofísica para Apressados', 'Neil deGrasse Tyson', 2017, 'Planeta', '978-85-13034-82-8', 5, 2, 2, 'Estante E - Prateleira 1'),
    ('L0083', 'Pálido Ponto Azul', 'Carl Sagan', 1994, 'Companhia das Letras', '978-85-13071-83-0', 5, 1, 1, 'Estante E - Prateleira 2'),
    ('L0084', 'Código Limpo', 'Robert C. Martin', 2008, 'Alta Books', '978-85-13108-84-0', 6, 5, 5, 'Estante F - Prateleira 1'),
    ('L0085', 'O Programador Pragmático', 'Andrew Hunt e David Thomas', 1999, 'Bookman', '978-85-13145-85-2', 6, 2, 2, 'Estante F - Prateleira 2'),
    ('L0086', 'Arquitetura Limpa', 'Robert C. Martin', 2017, 'Alta Books', '978-85-13182-86-4', 6, 5, 5, 'Estante F - Prateleira 3'),
    ('L0087', 'Padrões de Projeto', 'Erich Gamma et al.', 1994, 'Bookman', '978-85-13219-87-4', 6, 1, 1, 'Estante F - Prateleira 4'),
    ('L0088', 'Refatoração', 'Martin Fowler', 1999, 'Novatec', '978-85-13256-88-6', 6, 3, 3, 'Estante F - Prateleira 1'),
    ('L0089', 'Algoritmos: Teoria e Prática', 'Thomas H. Cormen', 1990, 'Elsevier', '978-85-13293-89-8', 6, 2, 2, 'Estante F - Prateleira 2'),
    ('L0090', 'Python Fluente', 'Luciano Ramalho', 2015, 'Novatec', '978-85-13330-90-6', 6, 3, 3, 'Estante F - Prateleira 3'),
    ('L0091', 'Redes de Computadores', 'Andrew S. Tanenbaum', 1981, 'Pearson', '978-85-13367-91-9', 6, 4, 4, 'Estante F - Prateleira 4'),
    ('L0092', 'Engenharia de Software', 'Ian Sommerville', 1982, 'Pearson', '978-85-13404-92-8', 6, 5, 5, 'Estante F - Prateleira 1'),
    ('L0093', 'O Homem que Calculava', 'Malba Tahan', 1938, 'Record', '978-85-13441-93-0', 7, 2, 2, 'Estante G - Prateleira 1'),
    ('L0094', 'Pedagogia do Oprimido', 'Paulo Freire', 1968, 'Paz e Terra', '978-85-13478-94-3', 7, 2, 2, 'Estante G - Prateleira 2'),
    ('L0095', 'Pedagogia da Autonomia', 'Paulo Freire', 1996, 'Paz e Terra', '978-85-13515-95-2', 7, 2, 2, 'Estante G - Prateleira 3'),
    ('L0096', 'O Mundo de Sofia', 'Jostein Gaarder', 1991, 'Companhia das Letras', '978-85-13552-96-4', 7, 2, 2, 'Estante G - Prateleira 4'),
    ('L0097', 'Pai Rico, Pai Pobre', 'Robert T. Kiyosaki', 1997, 'Alta Books', '978-85-13589-97-7', 8, 2, 2, 'Estante H - Prateleira 1'),
    ('L0098', 'Hábitos Atômicos', 'James Clear', 2018, 'Alta Life', '978-85-13626-98-6', 8, 4, 4, 'Estante H - Prateleira 2'),
    ('L0099', 'O Poder do Hábito', 'Charles Duhigg', 2012, 'Objetiva', '978-85-13663-99-8', 8, 2, 2, 'Estante H - Prateleira 3'),
    ('L0100', 'Como Fazer Amigos e Influenciar Pessoas', 'Dale Carnegie', 1936, 'Companhia Editora Nacional', '978-85-13700-00-6', 8, 4, 4, 'Estante H - Prateleira 4');

INSERT INTO usuarios
    (codigo, nome, cpf, sexo, grau, turno, curso, limite_emprestimos, status)
VALUES
    ('U0001', 'Maria Souza', '101.101.101-01', 'Feminino', 'Primeiro ano', 'Matutino', 'Informática', 3, 'Ativo'),
    ('U0002', 'João Pedro Lima', '102.102.102-02', 'Masculino', 'Primeiro ano', 'Matutino', 'Informática', 3, 'Ativo'),
    ('U0003', 'Ana Clara Ferreira', '103.103.103-03', 'Feminino', 'Segundo ano', 'Vespertino', 'Administração', 3, 'Ativo'),
    ('U0004', 'Carlos Eduardo Silva', '104.104.104-04', 'Masculino', 'Terceiro ano', 'Matutino', 'Eletrotécnica', 3, 'Ativo'),
    ('U0005', 'Beatriz Oliveira', '105.105.105-05', 'Feminino', 'Segundo ano', 'Matutino', 'Enfermagem', 3, 'Ativo'),
    ('U0006', 'Lucas Gabriel Santos', '106.106.106-06', 'Masculino', 'Primeiro ano', 'Vespertino', 'Edificações', 3, 'Ativo'),
    ('U0007', 'Juliana Costa', '107.107.107-07', 'Feminino', 'Terceiro ano', 'Vespertino', 'Informática', 3, 'Ativo'),
    ('U0008', 'Rafael Almeida', '108.108.108-08', 'Masculino', 'Segundo ano', 'Noturno', 'Administração', 3, 'Ativo'),
    ('U0009', 'Camila Rodrigues', '109.109.109-09', 'Feminino', 'Primeiro ano', 'Noturno', 'Enfermagem', 3, 'Ativo'),
    ('U0010', 'Pedro Henrique Gomes', '110.110.110-10', 'Masculino', 'Terceiro ano', 'Matutino', 'Edificações', 3, 'Ativo'),
    ('U0011', 'Larissa Martins', '111.111.111-11', 'Feminino', 'Segundo ano', 'Vespertino', 'Informática', 3, 'Ativo'),
    ('U0012', 'Gustavo Barbosa', '112.112.112-12', 'Masculino', 'Primeiro ano', 'Matutino', 'Eletrotécnica', 3, 'Bloqueado'),
    ('U0013', 'Fernanda Ribeiro', '113.113.113-13', 'Feminino', 'Professora', 'Matutino', 'Língua Portuguesa', 5, 'Ativo'),
    ('U0014', 'Roberto Nascimento', '114.114.114-14', 'Masculino', 'Professor', 'Vespertino', 'Matemática', 5, 'Ativo'),
    ('U0015', 'Patrícia Araújo', '115.115.115-15', 'Feminino', 'Terceiro ano', 'Noturno', 'Administração', 3, 'Ativo');
