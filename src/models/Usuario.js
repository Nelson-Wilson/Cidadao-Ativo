const db = require('../db');
const bcrypt = require('bcryptjs');

const PAPEL_CIDADAO = 'cidadao';
const PAPEL_TECNICO = 'tecnico';
const PAPEL_MUNICIPIO = 'municipio';
const PAPEL_ADMIN = 'admin';

async function buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
}

async function buscarPorEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
}

async function emailExiste(email) {
    return (await buscarPorEmail(email)) !== null;
}

async function criar({ nome, email, senha, papel = PAPEL_CIDADAO, id_municipio = null, id_departamento = null }) {
    const hashed = await bcrypt.hash(senha, 10);
    const [result] = await db.query(
        `INSERT INTO users (name, email, password, role, municipality_id, department_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nome, email, hashed, papel, id_municipio, id_departamento]
    );
    return result.insertId;
}

async function verificarSenha(usuario, senha) {
    return bcrypt.compare(senha, usuario.password);
}

async function buscarTecnicosPorDepartamento(id_departamento) {
    const [rows] = await db.query(
        'SELECT * FROM users WHERE role = ? AND department_id = ? ORDER BY name',
        [PAPEL_TECNICO, id_departamento]
    );
    return rows;
}

module.exports = {
    PAPEL_CIDADAO, PAPEL_TECNICO, PAPEL_MUNICIPIO, PAPEL_ADMIN,
    buscarPorId, buscarPorEmail, emailExiste, criar, verificarSenha, buscarTecnicosPorDepartamento,
};
