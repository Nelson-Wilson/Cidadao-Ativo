const bcrypt = require('bcryptjs');
const db = require('../../src/db');

const TABELAS = [
    'report_confirmations',
    'report_photo_resolutions',
    'report_status_histories',
    'reports',
    'category_department',
    'categories',
    'users',
    'departments',
    'municipalities',
    'user_sessions',
];

/**
 * Limpa os dados de teste sem tocar na base de dados de desenvolvimento.
 * A ordem respeita as foreign keys (filhos primeiro).
 */
async function limparBaseDeDados() {
    for (const tabela of TABELAS) {
        await db.query(`DELETE FROM \`${tabela}\``);
    }
}

/**
 * Fixture mínima dos dois municípios e dos actores dos cenários E4.
 * Devolve os IDs para os testes não dependerem de auto-increment.
 */
async function semearFixture() {
    const [maputo] = await db.query(
        "INSERT INTO municipalities (name, region) VALUES ('Conselho Municipal de Maputo', 'Maputo Cidade')"
    );
    const [matola] = await db.query(
        "INSERT INTO municipalities (name, region) VALUES ('Conselho Municipal da Matola', 'Maputo Província')"
    );

    const [viasMaputo] = await db.query(
        'INSERT INTO departments (name, municipality_id) VALUES (?, ?)',
        ['Departamento de Vias', maputo.insertId]
    );
    const [saneamentoMaputo] = await db.query(
        'INSERT INTO departments (name, municipality_id) VALUES (?, ?)',
        ['Departamento de Saneamento', maputo.insertId]
    );
    const [viasMatola] = await db.query(
        'INSERT INTO departments (name, municipality_id) VALUES (?, ?)',
        ['Departamento de Vias', matola.insertId]
    );

    const categorias = {};
    for (const nome of ['Buracos', 'Lixo', 'Iluminação Pública', 'Água']) {
        const [resultado] = await db.query('INSERT INTO categories (name) VALUES (?)', [nome]);
        categorias[nome] = resultado.insertId;
    }

    const ligacoes = [
        [categorias.Buracos, viasMaputo.insertId],
        [categorias.Lixo, saneamentoMaputo.insertId],
        [categorias['Iluminação Pública'], viasMaputo.insertId],
        [categorias['Água'], saneamentoMaputo.insertId],
    ];
    for (const [categoriaId, departamentoId] of ligacoes) {
        await db.query(
            'INSERT INTO category_department (category_id, department_id) VALUES (?, ?)',
            [categoriaId, departamentoId]
        );
    }

    const passwordHash = await bcrypt.hash('password', 4);

    async function criarUtilizador(nome, email, role, municipalityId = null, departmentId = null) {
        const [resultado] = await db.query(
            `INSERT INTO users (name, email, password, role, municipality_id, department_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nome, email, passwordHash, role, municipalityId, departmentId]
        );
        return resultado.insertId;
    }

    const utilizadores = {
        maria: await criarUtilizador('Maria Cidadã', 'maria@teste.com', 'cidadao'),
        rita: await criarUtilizador('Rita Cidadã', 'rita@teste.com', 'cidadao'),
        joao: await criarUtilizador('João Gestor', 'joao@teste.com', 'municipio', maputo.insertId),
        ana: await criarUtilizador('Ana Gestora', 'ana@teste.com', 'municipio', matola.insertId),
        carlos: await criarUtilizador('Carlos Técnico', 'carlos@teste.com', 'tecnico', maputo.insertId, viasMaputo.insertId),
        pedro: await criarUtilizador('Pedro Técnico', 'pedro@teste.com', 'tecnico', matola.insertId, viasMatola.insertId),
        admin: await criarUtilizador('Administrador', 'admin@teste.com', 'admin'),
    };

    return {
        municipios: { maputo: maputo.insertId, matola: matola.insertId },
        departamentos: {
            viasMaputo: viasMaputo.insertId,
            saneamentoMaputo: saneamentoMaputo.insertId,
            viasMatola: viasMatola.insertId,
        },
        categorias,
        utilizadores,
    };
}

async function reiniciarBaseDeDados() {
    await limparBaseDeDados();
    return semearFixture();
}

/**
 * Cria uma denúncia directamente na BD para testes de autorização/estado.
 * Evita repetir o formulário quando o objectivo não é testar a criação.
 */
async function criarDenuncia({
    userId,
    categoryId,
    status = 'recebida',
    municipalityId = null,
    departmentId = null,
    technicianId = null,
    description = 'Buraco grande na estrada, com risco para os automóveis.',
    bairro = 'Polana',
    latitude = -25.9692,
    longitude = 32.5732,
    photoPath = null,
    priority = 'normal',
} = {}) {
    const [resultado] = await db.query(
        `INSERT INTO reports
            (user_id, category_id, description, photo_path, latitude, longitude,
             neighborhood, status, priority, municipality_id, department_id, technician_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId, categoryId, description, photoPath, latitude, longitude,
            bairro, status, priority, municipalityId, departmentId, technicianId,
        ]
    );

    await db.query(
        `INSERT INTO report_status_histories (report_id, previous_status, new_status, changed_by)
         VALUES (?, NULL, ?, ?)`,
        [resultado.insertId, status, userId]
    );

    return resultado.insertId;
}

module.exports = {
    TABELAS,
    limparBaseDeDados,
    semearFixture,
    reiniciarBaseDeDados,
    criarDenuncia,
};
