/**
 * Máquina de estados da denúncia — regra de negócio pura.
 *
 * Fica num módulo de domínio sem dependências de Express/MySQL para poder ser
 * testada de forma unitária e para garantir que a API, o painel municipal e o
 * painel do técnico usam exactamente a mesma tabela de transições.
 */

const STATUS_RECEBIDA = 'recebida';
const STATUS_EM_ANALISE = 'em_analise';
const STATUS_ATRIBUIDA = 'atribuida';
const STATUS_EM_EXECUCAO = 'em_execucao';
const STATUS_RESOLVIDA = 'resolvida';
const STATUS_FECHADA = 'fechada';
const STATUS_REJEITADA = 'rejeitada';

const STATUSES = Object.freeze([
    STATUS_RECEBIDA,
    STATUS_EM_ANALISE,
    STATUS_ATRIBUIDA,
    STATUS_EM_EXECUCAO,
    STATUS_RESOLVIDA,
    STATUS_FECHADA,
    STATUS_REJEITADA,
]);

/**
 * Transições permitidas. Qualquer par ausente é inválido.
 * recebida -> em_analise -> (atribuida | rejeitada) -> em_execucao
 * -> resolvida -> fechada.
 */
const TRANSITIONS = Object.freeze({
    [STATUS_RECEBIDA]: Object.freeze([STATUS_EM_ANALISE]),
    [STATUS_EM_ANALISE]: Object.freeze([STATUS_ATRIBUIDA, STATUS_REJEITADA]),
    [STATUS_ATRIBUIDA]: Object.freeze([STATUS_EM_EXECUCAO]),
    [STATUS_EM_EXECUCAO]: Object.freeze([STATUS_RESOLVIDA]),
    [STATUS_RESOLVIDA]: Object.freeze([STATUS_FECHADA]),
    [STATUS_FECHADA]: Object.freeze([]),
    [STATUS_REJEITADA]: Object.freeze([]),
});

function podeMudarStatus(de, para) {
    return (TRANSITIONS[de] || []).includes(para);
}

module.exports = {
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
};
