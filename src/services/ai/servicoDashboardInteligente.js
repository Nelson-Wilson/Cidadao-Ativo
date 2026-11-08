function estaAtivo() {
    return (process.env.AI_FEATURE_SMART_DASHBOARD ?? 'true') !== 'false';
}

function resumir(estatisticas, categoriasPrincipais, bairrosPrincipais) {
    if (!estaAtivo()) return '';
    if (Number(estatisticas.total) === 0) return 'Ainda não há denúncias suficientes para gerar um resumo.';

    const frases = [];
    const categoriaPrincipal = categoriasPrincipais[0];
    const bairroPrincipal = bairrosPrincipais[0];

    if (categoriaPrincipal && bairroPrincipal) {
        frases.push(`Este período, "${categoriaPrincipal.name}" foi a categoria mais reportada (${categoriaPrincipal.total} ocorrências), com maior concentração no bairro ${bairroPrincipal.neighborhood}.`);
    } else if (categoriaPrincipal) {
        frases.push(`Este período, "${categoriaPrincipal.name}" foi a categoria mais reportada, com ${categoriaPrincipal.total} ocorrências.`);
    }

    if (Number(estatisticas.pendentes) > 0) {
        const percentual = Math.round((Number(estatisticas.pendentes) / Number(estatisticas.total)) * 100);
        frases.push(`${percentual}% das denúncias ainda estão pendentes de análise ou atribuição.`);
    }

    if (estatisticas.tempo_medio_horas !== null) {
        const dias = Math.round((estatisticas.tempo_medio_horas / 24) * 10) / 10;
        frases.push(`O tempo médio de resolução ronda os ${dias} dias.`);
    }

    return frases.join(' ');
}

module.exports = { estaAtivo, resumir };
