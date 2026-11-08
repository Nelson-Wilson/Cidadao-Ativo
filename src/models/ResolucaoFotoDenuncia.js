const db = require('../db');

async function criar(idDenuncia, caminhoFoto, idTecnico) {
    await db.query(
        'INSERT INTO report_photo_resolutions (report_id, photo_path, technician_id) VALUES (?, ?, ?)',
        [idDenuncia, caminhoFoto, idTecnico]
    );
}

async function porDenuncia(idDenuncia) {
    const [linhas] = await db.query(
        'SELECT * FROM report_photo_resolutions WHERE report_id = ? ORDER BY created_at DESC',
        [idDenuncia]
    );
    return linhas;
}

module.exports = { criar, porDenuncia };
