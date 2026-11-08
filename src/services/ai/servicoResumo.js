const PALAVRAS_MAXIMAS = 25;

function estaAtivo() {
    return (process.env.AI_FEATURE_SUMMARY ?? 'true') !== 'false';
}

function resumir(descricao) {
    if (!estaAtivo()) return descricao;

    const primeiraFrase = (descricao.split('.')[0] || '').trim();
    const texto = primeiraFrase !== '' ? primeiraFrase : descricao;

    const palavras = texto.trim().split(/\s+/);
    if (palavras.length <= PALAVRAS_MAXIMAS) return texto;

    return palavras.slice(0, PALAVRAS_MAXIMAS).join(' ') + '…';
}

module.exports = { estaAtivo, resumir };
