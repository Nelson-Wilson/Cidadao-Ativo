const Denuncia = require('../../models/Denuncia');

const LIMITE_PONTUACAO = 0.45;

function estaAtivo() {
    return (process.env.AI_FEATURE_DUPLICATES ?? 'true') !== 'false';
}

function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Semelhança de texto (0..1). O PHP tem similar_text() embutido; em Node
 * usamos o coeficiente de Dice sobre bigramas de caracteres — dá um
 * resultado equivalente em espírito (0 = nada parecido, 1 = idêntico).
 */
function semelhancaTexto(a, b) {
    const bigramas = (s) => {
        const lista = [];
        for (let i = 0; i < s.length - 1; i++) lista.push(s.slice(i, i + 2));
        return lista;
    };

    const bigramasA = bigramas(normalizar(a));
    const bigramasB = bigramas(normalizar(b));

    if (bigramasA.length === 0 || bigramasB.length === 0) return 0;

    const cesta = [...bigramasB];
    let correspondencias = 0;
    for (const bg of bigramasA) {
        const index = cesta.indexOf(bg);
        if (index !== -1) { correspondencias++; cesta.splice(index, 1); }
    }

    return (2 * correspondencias) / (bigramasA.length + bigramasB.length);
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const raioTerraKm = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return raioTerraKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** @returns {Promise<Array<{denuncia: object, distancia_km: number, semelhanca_texto: number, pontuacao: number}>>} */
async function procurarPossiveisDuplicados(idCategoria, lat, lng, descricao) {
    if (!estaAtivo()) return [];

    const raioKm = parseFloat(process.env.AI_DUPLICATE_RADIUS_KM || '0.3');
    const latDelta = raioKm / 111.0;
    const lngDelta = raioKm / (111.0 * Math.max(Math.cos(lat * Math.PI / 180), 0.1));

    const candidatos = await Denuncia.candidatosParaVerificacaoDuplicados(idCategoria, lat, lng, latDelta, lngDelta);

    const resultados = [];
    for (const denuncia of candidatos) {
        const distanciaKm = haversineKm(lat, lng, parseFloat(denuncia.latitude), parseFloat(denuncia.longitude));
        if (distanciaKm > raioKm) continue;

        const semelhanca = semelhancaTexto(descricao, denuncia.description);
        const pontuacaoDistancia = 1 - (distanciaKm / raioKm);
        const pontuacao = (0.6 * pontuacaoDistancia) + (0.4 * semelhanca);

        if (pontuacao < LIMITE_PONTUACAO) continue;

        resultados.push({
            denuncia,
            distancia_km: Math.round(distanciaKm * 1000) / 1000,
            semelhanca_texto: Math.round(semelhanca * 100) / 100,
            pontuacao: Math.round(pontuacao * 100) / 100,
        });
    }

    resultados.sort((a, b) => b.pontuacao - a.pontuacao);
    return resultados.slice(0, 5);
}

module.exports = { estaAtivo, procurarPossiveisDuplicados };
