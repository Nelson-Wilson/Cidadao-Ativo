const db = require('../db');

async function buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM departments WHERE id = ?', [id]);
    return rows[0] || null;
}

/** Departamento responsável por uma categoria (via pivô category_department). */
async function buscarPorCategoriaId(categoryId) {
    const [rows] = await db.query(
        `SELECT d.* FROM departments d
         INNER JOIN category_department cd ON cd.department_id = d.id
         WHERE cd.category_id = ?
         LIMIT 1`,
        [categoryId]
    );
    return rows[0] || null;
}

module.exports = { buscarPorId, buscarPorCategoriaId };
