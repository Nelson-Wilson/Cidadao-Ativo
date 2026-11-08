/**
 * Regras de autorização partilhadas pelas rotas.
 *
 * São funções puras para poderem ser testadas sem base de dados e para
 * evitarem divergências entre o painel do cidadão, o painel municipal e as
 * tarefas do técnico.
 */

const PAPEL_ADMIN = 'admin';
const PAPEL_CIDADAO = 'cidadao';
const PAPEL_MUNICIPIO = 'municipio';
const PAPEL_TECNICO = 'tecnico';

function mesmoId(a, b) {
    return a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b);
}

/** Quem pode abrir o detalhe de uma denúncia. */
function podeAcederDenuncia(usuario, denuncia) {
    if (!usuario || !denuncia) return false;

    switch (usuario.role) {
        case PAPEL_ADMIN:
            return true;
        case PAPEL_CIDADAO:
            return mesmoId(denuncia.user_id, usuario.id);
        case PAPEL_TECNICO:
            return mesmoId(denuncia.technician_id, usuario.id);
        case PAPEL_MUNICIPIO:
            return usuario.municipality_id !== null
                && usuario.municipality_id !== undefined
                && mesmoId(denuncia.municipality_id, usuario.municipality_id);
        default:
            return false;
    }
}

/** Quem pode gerir (listar, atribuir, mudar estado) uma denúncia municipal. */
function podeGerirDenuncia(usuario, denuncia) {
    if (!usuario || !denuncia) return false;
    if (usuario.role === PAPEL_ADMIN) return true;

    return usuario.role === PAPEL_MUNICIPIO
        && usuario.municipality_id !== null
        && usuario.municipality_id !== undefined
        && mesmoId(denuncia.municipality_id, usuario.municipality_id);
}

/** Um técnico só pode ser atribuído se for da mesma estrutura da denúncia. */
function podeAtribuirTecnico(usuario, denuncia, tecnico) {
    if (!podeGerirDenuncia(usuario, denuncia) || !tecnico) return false;
    if (tecnico.role !== PAPEL_TECNICO) return false;
    if (denuncia.department_id === null || denuncia.department_id === undefined) return false;
    if (tecnico.department_id === null || tecnico.department_id === undefined) return false;

    return mesmoId(denuncia.department_id, tecnico.department_id)
        && mesmoId(denuncia.municipality_id, tecnico.municipality_id);
}

module.exports = {
    PAPEL_ADMIN,
    PAPEL_CIDADAO,
    PAPEL_MUNICIPIO,
    PAPEL_TECNICO,
    podeAcederDenuncia,
    podeGerirDenuncia,
    podeAtribuirTecnico,
};
