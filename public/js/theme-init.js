// Cidadão Ativo — aplica o tema antes da primeira pintura para evitar "flash".
(function () {
    try {
        var guardado = localStorage.getItem('ca-theme');
        var prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (guardado === 'dark' || (!guardado && prefereEscuro)) {
            document.documentElement.classList.add('dark');
        }
    } catch (erro) {
        // localStorage pode estar bloqueado (modo privado); segue com o tema claro.
    }
})();
