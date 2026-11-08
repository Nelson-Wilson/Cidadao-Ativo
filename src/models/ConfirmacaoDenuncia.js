const db = require('../db');

async function criar(idDenuncia, idUsuario) {
    await db.query(
        'INSERT IGNORE INTO report_confirmations (report_id, user_id) VALUES (?, ?)',
        [idDenuncia, idUsuario]
    );
}

async function contarPorDenuncia(idDenuncia) {
    const [[{ total }]] = await db.query(
        'SELECT COUNT(*) AS total FROM report_confirmations WHERE report_id = ?',
        [idDenuncia]
    );
    return total;
}

module.exports = { criar, contarPorDenuncia };
