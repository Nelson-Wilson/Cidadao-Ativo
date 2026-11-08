require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function seed() {
    console.log('A popular a base de dados...');

    const passwordSeed = process.env.SEED_PASSWORD
        || (process.env.NODE_ENV === 'production' ? '' : 'password');

    if (!passwordSeed || passwordSeed.length < 8) {
        throw new Error(
            'Define SEED_PASSWORD com pelo menos 8 caracteres antes de correr o seed '
            + '(obrigatório em produção).'
        );
    }

    const hashedPassword = await bcrypt.hash(passwordSeed, 10);

    // --- Categorias ---
    const categories = [
        'Buracos', 'Iluminação Pública', 'Lixo', 'Água', 'Esgotos', 'Semáforos',
        'Árvores Caídas', 'Construções Perigosas', 'Animais Abandonados',
        'Vandalismo', 'Segurança', 'Outros',
    ];

    const categoryIds = {};
    for (const name of categories) {
        const [rows] = await db.query('SELECT id FROM categories WHERE name = ?', [name]);
        if (rows.length) {
            categoryIds[name] = rows[0].id;
            continue;
        }
        const [result] = await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
        categoryIds[name] = result.insertId;
    }
    console.log(`  Categorias: ${Object.keys(categoryIds).length}`);

    // --- Município + Departamentos ---
    let [munRows] = await db.query('SELECT id FROM municipalities WHERE name = ?', ['Conselho Municipal de Maputo']);
    let municipalityId;
    if (munRows.length) {
        municipalityId = munRows[0].id;
    } else {
        const [result] = await db.query('INSERT INTO municipalities (name, region) VALUES (?, ?)', ['Conselho Municipal de Maputo', 'Maputo Cidade']);
        municipalityId = result.insertId;
    }
    console.log(`  Município: Conselho Municipal de Maputo (#${municipalityId})`);

    const departmentsMap = {
        'Departamento de Vias': ['Buracos', 'Semáforos', 'Construções Perigosas'],
        'Departamento de Saneamento': ['Lixo', 'Esgotos', 'Água'],
        'Departamento de Iluminação': ['Iluminação Pública'],
        'Departamento de Ambiente e Segurança': ['Árvores Caídas', 'Animais Abandonados', 'Vandalismo', 'Segurança', 'Outros'],
    };

    const departmentIds = {};
    for (const [deptName, catNames] of Object.entries(departmentsMap)) {
        const [rows] = await db.query('SELECT id FROM departments WHERE name = ? AND municipality_id = ?', [deptName, municipalityId]);
        let deptId;
        if (rows.length) {
            deptId = rows[0].id;
        } else {
            const [result] = await db.query('INSERT INTO departments (name, municipality_id) VALUES (?, ?)', [deptName, municipalityId]);
            deptId = result.insertId;
        }
        departmentIds[deptName] = deptId;

        for (const catName of catNames) {
            await db.query('INSERT IGNORE INTO category_department (category_id, department_id) VALUES (?, ?)', [categoryIds[catName], deptId]);
        }
    }
    console.log(`  Departamentos: ${Object.keys(departmentIds).length}`);

    // --- Utilizadores de teste ---
    async function seedUser(name, email, role, municipality_id = null, department_id = null) {
        const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length) return rows[0].id;

        const [result] = await db.query(
            'INSERT INTO users (name, email, password, role, municipality_id, department_id) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role, municipality_id, department_id]
        );
        return result.insertId;
    }

    const viasDeptId = departmentIds['Departamento de Vias'];
    const cidadaoId = await seedUser('Cidadão Teste', 'cidadao@teste.com', 'cidadao');
    await seedUser('Técnico Teste', 'tecnico@teste.com', 'tecnico', municipalityId, viasDeptId);
    await seedUser('Gestor Municipal Teste', 'municipio@teste.com', 'municipio', municipalityId);
    await seedUser('Administrador Teste', 'admin@teste.com', 'admin');

    console.log('  Utilizadores de teste: cidadao@teste.com / tecnico@teste.com / municipio@teste.com / admin@teste.com');
    if (process.env.NODE_ENV !== 'production') {
        console.log('  Password de demonstração: password (define SEED_PASSWORD para a alterar).');
    }

    // --- Denúncias de demonstração ---
    const samples = [
        { category: 'Buracos', bairro: 'Polana' },
        { category: 'Iluminação Pública', bairro: 'Sommerschield' },
        { category: 'Lixo', bairro: 'Malhangalene' },
        { category: 'Esgotos', bairro: 'Coop' },
        { category: 'Água', bairro: 'Alto Maé' },
    ];

    for (const sample of samples) {
        const categoryId = categoryIds[sample.category];

        const [rows] = await db.query(
            'SELECT id FROM reports WHERE user_id = ? AND category_id = ? AND neighborhood = ?',
            [cidadaoId, categoryId, sample.bairro]
        );
        if (rows.length) continue;

        const lat = -25.9692 + (Math.random() * 0.1 - 0.05);
        const lng = 32.5732 + (Math.random() * 0.1 - 0.05);

        const [result] = await db.query(
            `INSERT INTO reports (user_id, category_id, description, latitude, longitude, neighborhood, status, municipality_id, department_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cidadaoId, categoryId,
                `Problema de ${sample.category} reportado no bairro ${sample.bairro}.`,
                lat, lng, sample.bairro, 'recebida', municipalityId,
                categoryId === categoryIds['Buracos'] ? viasDeptId : null,
            ]
        );

        await db.query(
            'INSERT INTO report_status_histories (report_id, previous_status, new_status, changed_by) VALUES (?, NULL, ?, ?)',
            [result.insertId, 'recebida', cidadaoId]
        );
    }
    console.log(`  Denúncias de demonstração: ${samples.length}`);

    console.log('\nConcluído.');
    process.exit(0);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
