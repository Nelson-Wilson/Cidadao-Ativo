const ConfirmacaoDenuncia = require('../../models/ConfirmacaoDenuncia');
const config = require('../../config');

const LOCAIS_SENSIVEIS = [
    { nome: 'Hospital Central de Maputo', lat: -25.9631, lng: 32.5811 },
    { nome: 'Escola Josina Machel', lat: -25.9663, lng: 32.5892 },
    { nome: 'Avenida Julius Nyerere', lat: -25.9707, lng: 32.6013 },
];

/** Palavras indicadoras de perigo físico grave ou risco de vida (ISO 25010:2023 Safety fail-safe). */
const PALAVRAS_PERIGO_VIDA = [
    'risco de vida', 'morte', 'eletrocutado', 'cabo caido', 'cabo eletrico', 'choque',
    'fogo', 'incendio', 'desabamento', 'desmoronar', 'crianca ferida', 'acidente grave',
];

function estaAtivo() {
    return config.ai.features.priority;
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const raioTerraKm = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return raioTerraKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcula a prioridade da denúncia: baixa | normal | urgente | muito_urgente.
 * Possui mecanismo de segurança fail-safe para riscos de vida imediatos.
 * @param {Object} denuncia
 * @param {string} [gravidade='normal']
 * @returns {Promise<string>}
 */
async function calcular(denuncia, gravidade = 'normal') {
    // 1. Salvaguarda de Segurança (Safety Fail-Safe): Prioridade máxima determinística
    const descricaoNormalizada = (denuncia.description || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const perigoImediato = PALAVRAS_PERIGO_VIDA.some((termo) => descricaoNormalizada.includes(termo));
    if (perigoImediato) {
        return 'muito_urgente';
    }

    if (!estaAtivo()) {
        return gravidade === 'alta' ? 'urgente' : 'normal';
    }

    let pontuacao = 0;
    if (gravidade === 'alta') pontuacao += 3;

    const lat = parseFloat(denuncia.latitude);
    const lng = parseFloat(denuncia.longitude);

    if (!isNaN(lat) && !isNaN(lng)) {
        for (const loc of LOCAIS_SENSIVEIS) {
            const distanciaKm = haversineKm(lat, lng, loc.lat, loc.lng);
            if (distanciaKm <= 0.5) { pontuacao += 3; break; }
            if (distanciaKm <= 1.0) { pontuacao += 1; }
        }
    }

    if (denuncia.created_at) {
        const horasAberto = (Date.now() - new Date(denuncia.created_at).getTime()) / 36e5;
        if (horasAberto > 24 * 14) pontuacao += 3;
        else if (horasAberto > 24 * 7) pontuacao += 2;
        else if (horasAberto > 24 * 2) pontuacao += 1;
    }

    const confirmacoes = await ConfirmacaoDenuncia.contarPorDenuncia(denuncia.id);
    if (confirmacoes >= 5) pontuacao += 3;
    else if (confirmacoes >= 2) pontuacao += 1;

    if (pontuacao >= 7) return 'muito_urgente';
    if (pontuacao >= 4) return 'urgente';
    if (pontuacao >= 2) return 'normal';
    return 'baixa';
}

module.exports = { estaAtivo, calcular };
