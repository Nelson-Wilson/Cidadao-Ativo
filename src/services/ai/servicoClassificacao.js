const Categoria = require('../../models/Categoria');

const PALAVRAS_CHAVE = {
    'Buracos': ['buraco', 'cratera', 'asfalto', 'via danificada', 'estrada'],
    'Iluminação Pública': ['candeeiro', 'poste', 'iluminacao', 'lampada', 'luz apagada', 'escuro'],
    'Lixo': ['lixo', 'lixeira', 'entulho', 'residuos', 'saco de lixo'],
    'Água': ['agua', 'fuga de agua', 'rotura', 'torneira', 'canalizacao'],
    'Esgotos': ['esgoto', 'saneamento', 'fossa', 'aguas residuais', 'mau cheiro'],
    'Semáforos': ['semaforo', 'sinal de transito', 'cruzamento'],
    'Árvores Caídas': ['arvore caida', 'arvore', 'ramo caido', 'tronco'],
    'Construções Perigosas': ['construcao', 'edificio', 'parede a cair', 'desmoronamento', 'obra abandonada'],
    'Animais Abandonados': ['animal', 'cao', 'cachorro', 'gato abandonado', 'animais soltos'],
    'Vandalismo': ['vandalismo', 'grafitti', 'pichacao', 'destruido de proposito'],
    'Segurança': ['assalto', 'inseguranca', 'roubo', 'violencia'],
};

const PALAVRAS_GRAVES = ['perigoso', 'grave', 'urgente', 'risco de vida', 'crianca', 'criancas', 'acidente'];

function estaAtivo() {
    return (process.env.AI_FEATURE_CLASSIFICATION ?? 'true') !== 'false';
}

function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // remove acentos
}

/** @returns {Promise<{categoria: object|null, confianca: number, gravidade: string}>} */
async function classificar(descricao) {
    if (!estaAtivo()) {
        return { categoria: null, confianca: 0, gravidade: 'normal' };
    }

    const normalizado = normalizar(descricao);

    let melhorCategoria = null;
    let melhorPontuacao = 0;

    for (const [nomeCategoria, palavrasChave] of Object.entries(PALAVRAS_CHAVE)) {
        let ocorrencias = 0;
        for (const palavra of palavrasChave) {
            if (normalizado.includes(palavra)) ocorrencias++;
        }
        if (ocorrencias > melhorPontuacao) {
            melhorPontuacao = ocorrencias;
            melhorCategoria = nomeCategoria;
        }
    }

    const categoria = melhorCategoria ? await Categoria.buscarPorNome(melhorCategoria) : null;
    const confianca = melhorPontuacao > 0 ? Math.min(1, melhorPontuacao / 3) : 0;

    let gravidade = 'normal';
    for (const palavra of PALAVRAS_GRAVES) {
        if (normalizado.includes(palavra)) { gravidade = 'alta'; break; }
    }

    return { categoria, confianca: Math.round(confianca * 100) / 100, gravidade };
}

module.exports = { estaAtivo, classificar };
