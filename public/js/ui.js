// Cidadão Ativo — interações globais da interface (tema, menu, toasts).
(function () {
    'use strict';

    function atualizarMetaTema(escuro) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', escuro ? '#020617' : '#ffffff');
    }

    function aplicarTema(escuro) {
        document.documentElement.classList.toggle('dark', escuro);
        try {
            localStorage.setItem('ca-theme', escuro ? 'dark' : 'light');
        } catch (erro) {
            // Sem persistência disponível.
        }
        document.querySelectorAll('[data-theme-toggle]').forEach(function (botao) {
            botao.setAttribute('aria-pressed', String(escuro));
            botao.setAttribute('aria-label', escuro ? 'Ativar tema claro' : 'Ativar tema escuro');
            botao.setAttribute('title', escuro ? 'Tema claro' : 'Tema escuro');
        });
        atualizarMetaTema(escuro);
    }

    function configurarTema() {
        var escuroInicial = document.documentElement.classList.contains('dark');
        document.querySelectorAll('[data-theme-toggle]').forEach(function (botao) {
            botao.addEventListener('click', function () {
                aplicarTema(!document.documentElement.classList.contains('dark'));
            });
        });
        aplicarTema(escuroInicial);
    }

    function configurarMenuMovel() {
        var botao = document.querySelector('[data-mobile-menu-toggle]');
        var painel = document.querySelector('[data-mobile-menu]');
        if (!botao || !painel) return;

        function fechar() {
            painel.classList.add('hidden');
            botao.setAttribute('aria-expanded', 'false');
        }

        botao.addEventListener('click', function () {
            var aberto = !painel.classList.contains('hidden');
            painel.classList.toggle('hidden', aberto);
            botao.setAttribute('aria-expanded', String(!aberto));
        });

        painel.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', fechar);
        });

        document.addEventListener('keydown', function (evento) {
            if (evento.key === 'Escape') fechar();
        });
    }

    function configurarDetalhes() {
        document.querySelectorAll('details[data-dropdown]').forEach(function (detalhe) {
            detalhe.addEventListener('toggle', function () {
                if (!detalhe.open) return;
                document.querySelectorAll('details[data-dropdown][open]').forEach(function (outro) {
                    if (outro !== detalhe) outro.open = false;
                });
            });
        });

        document.addEventListener('click', function (evento) {
            document.querySelectorAll('details[data-dropdown][open]').forEach(function (detalhe) {
                if (!detalhe.contains(evento.target)) detalhe.open = false;
            });
        });
    }

    function configurarToasts() {
        document.querySelectorAll('[data-toast]').forEach(function (toast) {
            var fechar = function () {
                toast.classList.add('opacity-0', 'translate-y-1');
                setTimeout(function () { toast.remove(); }, 220);
            };

            toast.querySelectorAll('[data-dismiss]').forEach(function (botao) {
                botao.addEventListener('click', fechar);
            });

            if (toast.dataset.autoDismiss !== 'false') {
                setTimeout(fechar, Number(toast.dataset.duration || 7000));
            }
        });
    }

    function configurarConfirmacoes() {
        document.querySelectorAll('form[data-confirm]').forEach(function (formulario) {
            formulario.addEventListener('submit', function (evento) {
                if (!window.confirm(formulario.dataset.confirm)) {
                    evento.preventDefault();
                }
            });
        });
    }

    function configurarAutoSubmit() {
        document.querySelectorAll('[data-auto-submit]').forEach(function (campo) {
            campo.addEventListener('change', function () {
                if (campo.form) campo.form.submit();
            });
        });
    }

    function configurarCopiar() {
        document.querySelectorAll('[data-copy]').forEach(function (botao) {
            botao.addEventListener('click', async function () {
                var texto = botao.dataset.copy || '';
                try {
                    await navigator.clipboard.writeText(texto);
                    var original = botao.getAttribute('aria-label') || '';
                    botao.setAttribute('aria-label', 'Copiado');
                    botao.classList.add('text-emerald-600');
                    setTimeout(function () {
                        botao.setAttribute('aria-label', original);
                        botao.classList.remove('text-emerald-600');
                    }, 1600);
                } catch (erro) {
                    // Clipboard indisponível; não bloquear a interface.
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        configurarTema();
        configurarMenuMovel();
        configurarDetalhes();
        configurarToasts();
        configurarConfirmacoes();
        configurarAutoSubmit();
        configurarCopiar();
    });
})();
