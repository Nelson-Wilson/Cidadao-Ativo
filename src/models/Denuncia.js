const db = require('../db');
const {
    STATUS_RECEBIDA,
    STATUS_EM_ANALISE,
    STATUS_ATRIBUIDA,
    STATUS_EM_EXECUCAO,
    STATUS_RESOLVIDA,
    STATUS_FECHADA,
    STATUS_REJEITADA,
    STATUSES,
    TRANSITIONS,
    podeMudarStatus,
} = require('../domain/estadosDenuncia');

const PRIORIDADE_BAIXA = 'baixa';
const PRIORIDADE_NORMAL = 'normal';
const PRIORIDADE_URGENTE = 'urgente';
const PRIORIDADE_MUITO_URGENTE = 'muito_urgente';

/**
 * Aplica a transição e regista o histórico; lança excepção se inválida.
 * O SELECT ... FOR UPDATE serializa transições concorrentes sobre a mesma
 * denúncia, evitando históricos duplicados ou estados incoerentes.
 */
async function mudarStatus(idDenuncia, novoStatus, alteradoPorUsuarioId) {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const [linhas] = await conexao.query('SELECT * FROM reports WHERE id = ? FOR UPDATE', [idDenuncia]);
        const denuncia = linhas[0];
        if (!denuncia) throw new Error(`Denúncia #${idDenuncia} não encontrada.`);
        if (!podeMudarStatus(denuncia.status, novoStatus)) {
            throw new Error(`Transição inválida de [${denuncia.status}] para [${novoStatus}].`);
        }

        await conexao.query('UPDATE reports SET status = ? WHERE id = ?', [novoStatus, idDenuncia]);
        await conexao.query(
            `INSERT INTO report_status_histories (report_id, previous_status, new_status, changed_by)
             VALUES (?, ?, ?, ?)`,
            [idDenuncia, denuncia.status, novoStatus, alteradoPorUsuarioId]
        );
        await conexao.commit();
        return { anterior: denuncia.status, novo: novoStatus };
    } catch (err) {
        await conexao.rollback();
        throw err;
    } finally {
        conexao.release();
    }
}

/**
 * Regista uma nova denúncia e o respectivo histórico inicial atomicamente numa transacção.
 * @param {Object} dados
 * @returns {Promise<number>} ID da denúncia criada
 */
async function criar(dados) {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();

        const [resultado] = await conexao.query(
            `INSERT INTO reports
                (user_id, category_id, description, photo_path, latitude, longitude,
                 neighborhood, status, priority, municipality_id, department_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                dados.id_usuario, dados.id_categoria, dados.descricao, dados.caminho_foto || null,
                dados.latitude, dados.longitude, dados.bairro || null,
                dados.status || STATUS_RECEBIDA, dados.prioridade || PRIORIDADE_NORMAL,
                dados.id_municipio || null, dados.id_departamento || null,
            ]
        );
        const idDenuncia = resultado.insertId;

        await conexao.query(
            `INSERT INTO report_status_histories (report_id, previous_status, new_status, changed_by)
             VALUES (?, NULL, ?, ?)`,
            [idDenuncia, dados.status || STATUS_RECEBIDA, dados.id_usuario]
        );

        await conexao.commit();
        return idDenuncia;
    } catch (err) {
        await conexao.rollback();
        throw err;
    } finally {
        conexao.release();
    }
}

async function buscarPorId(id) {
    const [linhas] = await db.query('SELECT * FROM reports WHERE id = ?', [id]);
    return linhas[0] || null;
}

async function buscarComRelacoes(id) {
    const [linhas] = await db.query(
        `SELECT r.*,
                c.name AS category_name,
                m.name AS municipality_name,
                d.name AS department_name,
                u.name AS citizen_name,
                t.name AS technician_name
         FROM reports r
         LEFT JOIN categories c ON c.id = r.category_id
         LEFT JOIN municipalities m ON m.id = r.municipality_id
         LEFT JOIN departments d ON d.id = r.department_id
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN users t ON t.id = r.technician_id
         WHERE r.id = ?`,
        [id]
    );
    return linhas[0] || null;
}

async function historicoStatus(idDenuncia) {
    const [linhas] = await db.query(
        `SELECT h.*, u.name AS changed_by_name
         FROM report_status_histories h
         LEFT JOIN users u ON u.id = h.changed_by
         WHERE h.report_id = ?
         ORDER BY h.created_at ASC`,
        [idDenuncia]
    );
    return linhas;
}

async function paginarPorUsuario(idUsuario, pagina = 1, porPagina = 10) {
    const deslocamento = (pagina - 1) * porPagina;
    const [itens] = await db.query(
        `SELECT r.*, c.name AS category_name
         FROM reports r
         LEFT JOIN categories c ON c.id = r.category_id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
        [idUsuario, porPagina, deslocamento]
    );
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM reports WHERE user_id = ?', [idUsuario]);
    return { itens, total, pagina, porPagina };
}

async function paraMapa({ idCategoria, status, bairro } = {}) {
    let sql = `SELECT r.id, r.description, r.photo_path, r.latitude, r.longitude,
                      r.neighborhood, r.status, r.created_at, c.name AS category_name
               FROM reports r
               LEFT JOIN categories c ON c.id = r.category_id
               WHERE 1 = 1`;
    const parametros = [];
    if (idCategoria) { sql += ' AND r.category_id = ?'; parametros.push(idCategoria); }
    if (status) { sql += ' AND r.status = ?'; parametros.push(status); }
    if (bairro) { sql += ' AND r.neighborhood LIKE ?'; parametros.push(`%${bairro}%`); }
    sql += ' ORDER BY r.created_at DESC LIMIT 500';

    const [linhas] = await db.query(sql, parametros);
    return linhas;
}

async function paginarParaMunicipio({ idMunicipio, idCategoria, status, bairro, pagina = 1, porPagina = 15 }) {
    const deslocamento = (pagina - 1) * porPagina;
    let onde = 'WHERE 1 = 1';
    const parametros = [];
    if (idMunicipio) { onde += ' AND r.municipality_id = ?'; parametros.push(idMunicipio); }
    if (idCategoria) { onde += ' AND r.category_id = ?'; parametros.push(idCategoria); }
    if (status) { onde += ' AND r.status = ?'; parametros.push(status); }
    if (bairro) { onde += ' AND r.neighborhood LIKE ?'; parametros.push(`%${bairro}%`); }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM reports r ${onde}`, parametros);

    const [itens] = await db.query(
        `SELECT r.*, c.name AS category_name, t.name AS technician_name
         FROM reports r
         LEFT JOIN categories c ON c.id = r.category_id
         LEFT JOIN users t ON t.id = r.technician_id
         ${onde}
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
        [...parametros, porPagina, deslocamento]
    );

    return { itens, total, pagina, porPagina };
}

async function porTecnicoEStatus(idTecnico, listaStatus) {
    const marcadores = listaStatus.map(() => '?').join(',');
    const [linhas] = await db.query(
        `SELECT r.*, c.name AS category_name
         FROM reports r
         LEFT JOIN categories c ON c.id = r.category_id
         WHERE r.technician_id = ? AND r.status IN (${marcadores})
         ORDER BY r.created_at DESC`,
        [idTecnico, ...listaStatus]
    );
    return linhas;
}

/**
 * Atribui um técnico e passa a denúncia de em_analise para atribuida,
 * tudo na mesma transacção. Impede atribuições em estados inválidos.
 */
async function atribuirTecnico(idDenuncia, idTecnico, alteradoPorUsuarioId) {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const [linhas] = await conexao.query('SELECT * FROM reports WHERE id = ? FOR UPDATE', [idDenuncia]);
        const denuncia = linhas[0];
        if (!denuncia) throw new Error(`Denúncia #${idDenuncia} não encontrada.`);
        if (denuncia.status !== STATUS_EM_ANALISE) {
            throw new Error('Só é possível atribuir denúncias que estejam em análise.');
        }

        await conexao.query('UPDATE reports SET technician_id = ? WHERE id = ?', [idTecnico, idDenuncia]);
        await conexao.query('UPDATE reports SET status = ? WHERE id = ?', [STATUS_ATRIBUIDA, idDenuncia]);
        await conexao.query(
            `INSERT INTO report_status_histories (report_id, previous_status, new_status, changed_by)
             VALUES (?, ?, ?, ?)`,
            [idDenuncia, denuncia.status, STATUS_ATRIBUIDA, alteradoPorUsuarioId]
        );
        await conexao.commit();
        return { anterior: denuncia.status, novo: STATUS_ATRIBUIDA };
    } catch (err) {
        await conexao.rollback();
        throw err;
    } finally {
        conexao.release();
    }
}

/**
 * Regista a foto de resolução e passa a denúncia de em_execucao para
 * resolvida atomicamente. Evita fotos órfãs quando a transição falha.
 */
async function resolver(idDenuncia, caminhoFoto, idTecnico) {
    const conexao = await db.getConnection();
    try {
        await conexao.beginTransaction();
        const [linhas] = await conexao.query('SELECT * FROM reports WHERE id = ? FOR UPDATE', [idDenuncia]);
        const denuncia = linhas[0];
        if (!denuncia) throw new Error(`Denúncia #${idDenuncia} não encontrada.`);
        if (!mesmoId(denuncia.technician_id, idTecnico)) {
            throw new Error('Esta denúncia não está atribuída a este técnico.');
        }
        if (denuncia.status !== STATUS_EM_EXECUCAO) {
            throw new Error('Só é possível resolver denúncias que estejam em execução.');
        }

        await conexao.query(
            `INSERT INTO report_photo_resolutions (report_id, photo_path, technician_id)
             VALUES (?, ?, ?)`,
            [idDenuncia, caminhoFoto, idTecnico]
        );
        await conexao.query('UPDATE reports SET status = ? WHERE id = ?', [STATUS_RESOLVIDA, idDenuncia]);
        await conexao.query(
            `INSERT INTO report_status_histories (report_id, previous_status, new_status, changed_by)
             VALUES (?, ?, ?, ?)`,
            [idDenuncia, denuncia.status, STATUS_RESOLVIDA, idTecnico]
        );
        await conexao.commit();
        return { anterior: denuncia.status, novo: STATUS_RESOLVIDA };
    } catch (err) {
        await conexao.rollback();
        throw err;
    } finally {
        conexao.release();
    }
}

function mesmoId(a, b) {
    return a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b);
}

async function atualizarPrioridade(idDenuncia, prioridade) {
    await db.query('UPDATE reports SET priority = ? WHERE id = ?', [prioridade, idDenuncia]);
}

async function estatisticasParaMunicipio(idMunicipio) {
    const onde = idMunicipio ? 'WHERE municipality_id = ?' : '';
    const parametros = idMunicipio ? [idMunicipio] : [];

    const escalar = async (sql, p) => {
        const [[linha]] = await db.query(sql, p);
        return Number(Object.values(linha)[0]);
    };

    const total = await escalar(`SELECT COUNT(*) FROM reports ${onde}`, parametros);
    const ondeHoje = idMunicipio ? `${onde} AND DATE(created_at) = CURDATE()` : 'WHERE DATE(created_at) = CURDATE()';
    const hoje = await escalar(`SELECT COUNT(*) FROM reports ${ondeHoje}`, parametros);
    const ondePendentes = (idMunicipio ? `${onde} AND` : 'WHERE') + " status IN ('recebida', 'em_analise')";
    const pendentes = await escalar(`SELECT COUNT(*) FROM reports ${ondePendentes}`, parametros);
    const ondeExec = (idMunicipio ? `${onde} AND` : 'WHERE') + " status = 'em_execucao'";
    const emExecucao = await escalar(`SELECT COUNT(*) FROM reports ${ondeExec}`, parametros);
    const ondeResolvidas = (idMunicipio ? `${onde} AND` : 'WHERE') + " status IN ('resolvida', 'fechada')";
    const resolvidas = await escalar(`SELECT COUNT(*) FROM reports ${ondeResolvidas}`, parametros);

    const tempoSql = `SELECT AVG(TIMESTAMPDIFF(HOUR, r.created_at, h.created_at)) AS media
                       FROM reports r
                       INNER JOIN report_status_histories h ON h.report_id = r.id AND h.new_status = 'resolvida'`
        + (idMunicipio ? ' WHERE r.municipality_id = ?' : '');
    const [[{ media }]] = await db.query(tempoSql, parametros);

    return {
        total, hoje, pendentes, em_execucao: emExecucao, resolvidas,
        tempo_medio_horas: media !== null ? Math.round(Number(media) * 10) / 10 : null,
    };
}

async function categoriasPrincipais(idMunicipio, limite = 5) {
    const onde = idMunicipio ? 'WHERE r.municipality_id = ?' : '';
    const parametros = idMunicipio ? [idMunicipio] : [];
    const [linhas] = await db.query(
        `SELECT c.name, COUNT(*) AS total
         FROM reports r INNER JOIN categories c ON c.id = r.category_id
         ${onde} GROUP BY c.name ORDER BY total DESC LIMIT ${Number(limite)}`,
        parametros
    );
    return linhas;
}

async function bairrosPrincipais(idMunicipio, limite = 5) {
    const onde = idMunicipio ? 'WHERE r.municipality_id = ? AND r.neighborhood IS NOT NULL' : 'WHERE r.neighborhood IS NOT NULL';
    const parametros = idMunicipio ? [idMunicipio] : [];
    const [linhas] = await db.query(
        `SELECT r.neighborhood, COUNT(*) AS total
         FROM reports r ${onde} GROUP BY r.neighborhood ORDER BY total DESC LIMIT ${Number(limite)}`,
        parametros
    );
    return linhas;
}

async function pontosCalor(idMunicipio, limite = 1000) {
    const onde = idMunicipio ? 'WHERE municipality_id = ?' : '';
    const parametros = idMunicipio ? [idMunicipio] : [];
    const [linhas] = await db.query(
        `SELECT latitude, longitude FROM reports ${onde} LIMIT ${Number(limite)}`,
        parametros
    );
    return linhas;
}

/** Candidatos a duplicado — mesma categoria, bounding box por lat/lng. */
async function candidatosParaVerificacaoDuplicados(idCategoria, lat, lng, deltaLat, deltaLng) {
    const [linhas] = await db.query(
        `SELECT r.*,
                (SELECT COUNT(*) FROM report_confirmations rc WHERE rc.report_id = r.id) AS confirmations_count
         FROM reports r
         WHERE r.category_id = ?
           AND r.status NOT IN ('fechada', 'rejeitada')
           AND r.latitude BETWEEN ? AND ?
           AND r.longitude BETWEEN ? AND ?`,
        [idCategoria, lat - deltaLat, lat + deltaLat, lng - deltaLng, lng + deltaLng]
    );
    return linhas;
}

module.exports = {
    STATUS_RECEBIDA, STATUS_EM_ANALISE, STATUS_ATRIBUIDA, STATUS_EM_EXECUCAO,
    STATUS_RESOLVIDA, STATUS_FECHADA, STATUS_REJEITADA, STATUSES, TRANSITIONS,
    PRIORIDADE_BAIXA, PRIORIDADE_NORMAL, PRIORIDADE_URGENTE, PRIORIDADE_MUITO_URGENTE,
    podeMudarStatus, mudarStatus, criar, buscarPorId, buscarComRelacoes, historicoStatus,
    paginarPorUsuario, paraMapa, paginarParaMunicipio, porTecnicoEStatus,
    atribuirTecnico, resolver, atualizarPrioridade, estatisticasParaMunicipio, categoriasPrincipais,
    bairrosPrincipais, pontosCalor, candidatosParaVerificacaoDuplicados,
};
