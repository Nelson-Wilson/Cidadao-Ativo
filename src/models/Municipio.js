const db = require('../db');

async function primeiro() {
    const [rows] = await db.query('SELECT * FROM municipalities ORDER BY id LIMIT 1');
    return rows[0] || null;
}

async function buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM municipalities WHERE id = ?', [id]);
    return rows[0] || null;
}

module.exports = { primeiro, buscarPorId };
