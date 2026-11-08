const Categoria = require('../../models/Categoria');
const config = require('../../config');
const { ALLOWED_MIME, lerFicheiro, mimePorCaminho } = require('../../upload');
const AIClient = require('./aiClient');

function estaAtivo() {
    return config.ai.features.photoAnalysis && AIClient.estaConfigurado();
}

/**
 * Constrói um bloco de imagem a partir de:
 * - um objeto `{ buffer, mimetype }` (upload em memória da API);
 * - um caminho local dentro de public/uploads;
 * - um URL público do bucket Supabase configurado.
 *
 * Devolve `null` se a imagem não existir, for demasiado grande ou tiver um
 * formato não suportado — os chamadores tratam isso como "sem análise".
 */
async function blocoImagem(origemFoto) {
    if (origemFoto && typeof origemFoto === 'object' && Buffer.isBuffer(origemFoto.buffer)) {
        const permitido = Object.prototype.hasOwnProperty.call(ALLOWED_MIME, origemFoto.mimetype);
        if (!permitido || origemFoto.buffer.length === 0) return null;

        return {
            type: 'image',
            mimeType: origemFoto.mimetype,
            data: origemFoto.buffer.toString('base64'),
        };
    }

    const mimeType = mimePorCaminho(origemFoto);
    if (!mimeType) return null;

    const buffer = await lerFicheiro(origemFoto);
    if (!buffer) return null;

    return {
        type: 'image',
        mimeType,
        data: buffer.toString('base64'),
    };
}

/** Extrai JSON mesmo quando o modelo o envolve em markdown ou texto adicional. */
function processarJson(texto) {
    if (typeof texto !== 'string') return null;

    const limpo = texto
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

    try {
        return JSON.parse(limpo);
    } catch {
        const inicio = limpo.indexOf('{');
        const fim = limpo.lastIndexOf('}');
        if (inicio === -1 || fim === -1 || fim <= inicio) return null;
        try {
            return JSON.parse(limpo.slice(inicio, fim + 1));
        } catch {
            return null;
        }
    }
}

function normalizarNome(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/** Chama a API de visão com N blocos de imagem + o prompt; devolve texto ou null. */
async function chamarApiVisao(blocosImagem, prompt, tokensMaximos, opcoes = {}) {
    return AIClient.enviarMensagem({
        messages: [{
            role: 'user',
            content: [...blocosImagem, { type: 'text', text: prompt }],
        }],
        maxTokens: tokensMaximos,
        timeoutMs: config.ai.timeoutMs,
        temperature: 0.2,
        json: Boolean(opcoes.json),
    });
}

/**
 * Analisa a fotografia e devolve categoria sugerida, gravidade e raciocínio.
 * @returns {Promise<{categoria: object|null, gravidade: string, confianca: number, raciocinio: string}|null>}
 */
async function analisar(origemFoto, descricao = '') {
    if (!estaAtivo()) return null;

    const bloco = await blocoImagem(origemFoto);
    if (!bloco) return null;

    const categorias = await Categoria.todas();
    const nomesCategorias = categorias.map((c) => c.name);

    const prompt = `Estás a analisar uma fotografia enviada por um cidadão para reportar um `
        + `problema urbano ao Conselho Municipal de Maputo. `
        + (descricao.trim() !== '' ? `O cidadão descreveu o problema assim: "${descricao}". ` : '')
        + `Escolhe a categoria que melhor descreve o problema visível na foto, `
        + `de entre exactamente estas opções: ${nomesCategorias.join(', ')}. `
        + `Avalia também a gravidade aparente (normal ou alta — usa "alta" só se `
        + `parecer perigoso, obstruir uma via, ou representar risco para pessoas). `
        + `Responde APENAS com um objecto JSON válido, sem markdown, neste formato exacto: `
        + `{"category": "<uma das opções>", "severity": "normal" ou "alta", `
        + `"confidence": <número entre 0 e 1>, "reasoning": "<uma frase curta em português>"}. `
        + `Se a foto não mostrar claramente nenhum destes problemas, usa "category": "Outros".`;

    const texto = await chamarApiVisao([bloco], prompt, 800, { json: true });
    if (!texto) return null;

    const processado = processarJson(texto);
    if (!processado || !processado.category) return null;

    const categoria = categorias.find(
        (c) => normalizarNome(c.name) === normalizarNome(processado.category)
    ) || null;

    if (!categoria) return null;

    const confianca = Number(processado.confidence);

    return {
        categoria,
        gravidade: processado.severity === 'alta' ? 'alta' : 'normal',
        confianca: Number.isFinite(confianca) ? Math.min(1, Math.max(0, confianca)) : 0.5,
        raciocinio: typeof processado.reasoning === 'string' ? processado.reasoning.slice(0, 240) : '',
    };
}

/**
 * Compara visualmente duas fotos para detetar se representam a mesma ocorrência física.
 * @returns {Promise<{mesmo: boolean, raciocinio: string}|null>}
 */
async function compararCandidatoDuplicado(caminhoFotoNova, caminhoFotoExistente) {
    if (!estaAtivo()) return null;

    const prompt = 'A primeira imagem é uma denúncia nova que um cidadão está prestes a enviar. '
        + 'A segunda imagem é de uma denúncia já existente, reportada perto do mesmo local e na '
        + 'mesma categoria. Parecem mostrar o mesmo problema físico (o mesmo buraco, o mesmo '
        + 'monte de lixo, etc.), ou são claramente coisas diferentes? '
        + 'Responde APENAS com um objecto JSON válido, sem markdown: '
        + '{"same": true ou false, "reasoning": "<uma frase muito curta em português>"}.';

    const bloco1 = await blocoImagem(caminhoFotoNova);
    const bloco2 = await blocoImagem(caminhoFotoExistente);
    if (!bloco1 || !bloco2) return null;

    const texto = await chamarApiVisao([bloco1, bloco2], prompt, 500, { json: true });
    if (!texto) return null;

    const processado = processarJson(texto);
    if (!processado || processado.same === undefined) return null;

    return {
        mesmo: processado.same === true,
        raciocinio: typeof processado.reasoning === 'string' ? processado.reasoning.slice(0, 240) : '',
    };
}

/**
 * Compara a foto do problema com a foto da resolução do técnico.
 * @returns {Promise<string|null>} Comentário curto ou null
 */
async function compararResolucao(caminhoFotoOriginal, caminhoFotoResolucao, nomeCategoria) {
    if (!estaAtivo()) return null;

    const prompt = `A primeira imagem é o problema original reportado por um cidadão (categoria: `
        + `"${nomeCategoria}"). A segunda imagem foi enviada por um técnico municipal como `
        + `prova de que o problema foi resolvido. Numa frase curta em português, diz se a `
        + `segunda foto parece mesmo mostrar o mesmo local com o problema corrigido, ou se `
        + `há alguma dúvida. Sê directo e breve (máximo 20 palavras).`;

    const bloco1 = await blocoImagem(caminhoFotoOriginal);
    const bloco2 = await blocoImagem(caminhoFotoResolucao);
    if (!bloco1 || !bloco2) return null;

    const texto = await chamarApiVisao([bloco1, bloco2], prompt, 160);
    return texto ? texto.replace(/^["“]|["”]$/g, '').trim() : null;
}

module.exports = { estaAtivo, analisar, compararCandidatoDuplicado, compararResolucao };
