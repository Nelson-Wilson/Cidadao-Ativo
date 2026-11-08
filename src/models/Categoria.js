const db = require('../db');

async function todas() {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
    return rows;
}

async function buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    return rows[0] || null;
}

async function buscarPorNome(name) {
    const [rows] = await db.query('SELECT * FROM categories WHERE name = ?', [name]);
    return rows[0] || null;
}

module.exports = { todas, buscarPorId, buscarPorNome };
