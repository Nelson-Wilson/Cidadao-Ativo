/**
 * Validação de domínio da denúncia.
 *
 * Mantida fora da rota para ser testável de forma unitária e para servir de
 * contrato único entre o formulário e o backend. O formulário usa os mesmos
 * nomes de campos: id_categoria, descricao, latitude, longitude e bairro.
 */

const LIMITES = Object.freeze({
    descricaoMin: 10,
    descricaoMax: 5000,
    bairroMax: 120,
    latitudeMin: -90,
    latitudeMax: 90,
    longitudeMin: -180,
    longitudeMax: 180,
});

function estaVazio(valor) {
    return valor === undefined || valor === null || String(valor).trim() === '';
}

function validarDenuncia({ id_categoria, descricao, latitude, longitude, bairro, temFoto }) {
    const erros = [];

    const categoriaId = Number(id_categoria);
    if (estaVazio(id_categoria) || !Number.isInteger(categoriaId) || categoriaId <= 0) {
        erros.push('Escolhe uma categoria válida.');
    }

    const texto = typeof descricao === 'string' ? descricao.trim() : '';
    if (texto.length < LIMITES.descricaoMin) {
        erros.push(`A descrição deve ter pelo menos ${LIMITES.descricaoMin} caracteres.`);
    }
    if (texto.length > LIMITES.descricaoMax) {
        erros.push(`A descrição não pode exceder ${LIMITES.descricaoMax} caracteres.`);
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (estaVazio(latitude) || estaVazio(longitude) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        erros.push('Não foi possível obter a localização. Activa o GPS ou marca no mapa.');
    } else if (
        lat < LIMITES.latitudeMin || lat > LIMITES.latitudeMax
        || lng < LIMITES.longitudeMin || lng > LIMITES.longitudeMax
    ) {
        erros.push('As coordenadas GPS estão fora dos limites válidos.');
    }

    const bairroTexto = typeof bairro === 'string' ? bairro.trim() : '';
    if (bairroTexto.length > LIMITES.bairroMax) {
        erros.push(`O bairro ou ponto de referência não pode exceder ${LIMITES.bairroMax} caracteres.`);
    }

    if (!temFoto) {
        erros.push('Anexa uma fotografia do problema.');
    }

    return {
        erros,
        valores: {
            id_categoria: Number.isInteger(categoriaId) && categoriaId > 0 ? categoriaId : null,
            descricao: texto,
            latitude: Number.isFinite(lat) ? lat : null,
            longitude: Number.isFinite(lng) ? lng : null,
            bairro: bairroTexto || null,
        },
    };
}

module.exports = { LIMITES, validarDenuncia };
