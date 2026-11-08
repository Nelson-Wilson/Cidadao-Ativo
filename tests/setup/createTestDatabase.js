const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const TEST_DB = 'cidadao_ativo_test';

/**
 * Recria a base de dados de teste a partir de database/schema.sql.
 * Nunca toca em cidadao_ativo: o nome está fixo e é validado antes do DROP.
 */
async function criarBaseDeDadosTeste() {
    if (!TEST_DB.endsWith('_test')) {
        throw new Error(`Recusa de segurança: "${TEST_DB}" não parece uma base de dados de teste.`);
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
    });

    try {
        await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
        await connection.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await connection.query(`USE \`${TEST_DB}\``);

        const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
        await connection.query(schema);
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    criarBaseDeDadosTeste()
        .then(() => console.log(`Base de dados de teste "${TEST_DB}" criada.`))
        .catch((err) => {
            console.error('Falha ao criar a base de dados de teste:', err);
            process.exit(1);
        });
}

module.exports = { TEST_DB, criarBaseDeDadosTeste };
