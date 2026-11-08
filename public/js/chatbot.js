// Cidadão Ativo — assistente virtual flutuante (Gemini via /api/chatbot).
(function () {
    'use strict';

    var STORAGE_KEY = 'ca-chat-history-v1';
    var MAX_HISTORICO = 24;
    var SAUDACAO = 'Olá! Sou o Assistente Cidadão Ativo. Posso ajudar-te a reportar um problema, acompanhar uma denúncia ou explicar os estados do atendimento. Em que posso ajudar?';

    var SUGESTOES = [
        'Como reportar um problema?',
        'Como acompanhar a minha denúncia?',
        'Quais são os estados possíveis?',
        'O que fazer numa emergência?'
    ];

    function icone(nome, classes) {
        var caminhos = {
            bot: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3.75h7.5A2.25 2.25 0 0118 6v6.75A2.25 2.25 0 0115.75 15h-1.5v3l-3-3h-3A2.25 2.25 0 016 12.75V6a2.25 2.25 0 012.25-2.25z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 7.5h.008v.008H9V7.5zm6 0h.008v.008H15V7.5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 10.5h4.5"/>',
            enviar: '<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>',
            fechar: '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>',
            limpar: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>',
            brilho: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>',
            aviso: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM10.29 3.86L1.82 18a2.25 2.25 0 001.95 3.38h16.46a2.25 2.25 0 001.95-3.38L13.71 3.86a2.25 2.25 0 00-3.42 0z"/>',
            fecharPainel: '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>'
        };
        return '<svg class="' + (classes || 'h-4 w-4') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' + (caminhos[nome] || '') + '</svg>';
    }

    function carregarHistorico() {
        try {
            var guardado = sessionStorage.getItem(STORAGE_KEY);
            if (!guardado) return null;
            var dados = JSON.parse(guardado);
            if (!Array.isArray(dados)) return null;
            return dados
                .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'; })
                .slice(-MAX_HISTORICO);
        } catch (erro) {
            return null;
        }
    }

    function guardarHistorico(mensagens) {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mensagens.slice(-MAX_HISTORICO)));
        } catch (erro) {
            // Sem sessionStorage disponível.
        }
    }

    function textoSeguro(texto) {
        var div = document.createElement('div');
        div.textContent = texto;
        var html = div.innerHTML;
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/(^|\n)[-•]\s+/g, '$1• ');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var root = document.getElementById('chatbot-widget');
        if (!root) return;

        var apiBase = document.querySelector('[data-api-base]')
            ? document.querySelector('[data-api-base]').dataset.apiBase
            : '/api';

        var mensagens = carregarHistorico();
        if (!mensagens || !mensagens.length) {
            mensagens = [{ role: 'assistant', content: SAUDACAO }];
        }

        var aCarregar = false;
        var aberto = false;

        root.innerHTML = [
            '<button type="button" id="chatbot-toggle"',
            ' class="group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/30 transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"',
            ' aria-label="Abrir assistente virtual" aria-expanded="false" aria-controls="chatbot-panel">',
            '<span class="absolute inset-0 rounded-2xl bg-blue-500/30 animate-ping opacity-20"></span>',
            '<span class="relative">' + icone('bot', 'h-6 w-6') + '</span>',
            '<span id="chatbot-toggle-close" class="relative hidden">' + icone('fechar', 'h-6 w-6') + '</span>',
            '<span class="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[8px] font-bold text-white dark:border-slate-950">IA</span>',
            '</button>',

            '<section id="chatbot-panel" role="dialog" aria-modal="false" aria-labelledby="chatbot-title"',
            ' class="fixed bottom-24 right-4 z-50 hidden h-[min(78vh,34rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:right-5 sm:w-[24rem]">',

            '  <header class="flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 px-4 py-3.5 text-white">',
            '    <div class="flex min-w-0 items-center gap-3">',
            '      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm">' + icone('bot', 'h-5 w-5') + '</span>',
            '      <div class="min-w-0">',
            '        <h2 id="chatbot-title" class="flex items-center gap-1.5 text-sm font-bold">Assistente Cidadão <span class="text-amber-300">' + icone('brilho', 'h-3.5 w-3.5') + '</span></h2>',
            '        <p class="flex items-center gap-1.5 text-[11px] text-blue-100/80"><span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>Gemini · online</p>',
            '      </div>',
            '    </div>',
            '    <div class="flex items-center gap-0.5">',
            '      <button type="button" id="chatbot-clear" class="rounded-lg p-2 text-blue-100/80 transition hover:bg-white/10 hover:text-white" aria-label="Limpar conversa" title="Limpar conversa">' + icone('limpar', 'h-4 w-4') + '</button>',
            '      <button type="button" id="chatbot-close" class="rounded-lg p-2 text-blue-100/80 transition hover:bg-white/10 hover:text-white" aria-label="Fechar assistente">' + icone('fechar', 'h-4 w-4') + '</button>',
            '    </div>',
            '  </header>',

            '  <div id="chatbot-messages" class="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950" aria-live="polite" aria-relevant="additions"></div>',

            '  <div id="chatbot-suggestions" class="border-t border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"></div>',

            '  <form id="chatbot-form" class="border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">',
            '    <div class="flex items-end gap-2">',
            '      <label class="sr-only" for="chatbot-input">Escreve a tua pergunta</label>',
            '      <input id="chatbot-input" type="text" maxlength="600" autocomplete="off" placeholder="Escreve a tua pergunta…"',
            '        class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />',
            '      <button type="submit" id="chatbot-send" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Enviar mensagem">' + icone('enviar', 'h-4 w-4') + '</button>',
            '    </div>',
            '    <p class="mt-2 flex items-center gap-1 text-[10px] leading-snug text-slate-400 dark:text-slate-500">' + icone('aviso', 'h-3 w-3') + ' Assistente com IA. Em emergência, liga 198 ou 112.</p>',
            '  </form>',
            '</section>'
        ].join('');

        var toggle = document.getElementById('chatbot-toggle');
        var toggleClose = document.getElementById('chatbot-toggle-close');
        var painel = document.getElementById('chatbot-panel');
        var lista = document.getElementById('chatbot-messages');
        var sugestoes = document.getElementById('chatbot-suggestions');
        var form = document.getElementById('chatbot-form');
        var input = document.getElementById('chatbot-input');
        var enviar = document.getElementById('chatbot-send');
        var limpar = document.getElementById('chatbot-clear');
        var fechar = document.getElementById('chatbot-close');

        function criarBolha(mensagem) {
            var artigo = document.createElement('article');
            artigo.className = 'flex items-start gap-2.5 ' + (mensagem.role === 'user' ? 'justify-end' : 'justify-start');

            if (mensagem.role === 'assistant') {
                var avatar = document.createElement('div');
                avatar.className = 'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300';
                avatar.innerHTML = icone('bot', 'h-3.5 w-3.5');
                artigo.appendChild(avatar);
            }

            var bolha = document.createElement('div');
            bolha.className = mensagem.role === 'user'
                ? 'max-w-[85%] rounded-2xl rounded-tr-md bg-blue-600 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm'
                : 'max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
            if (mensagem.role === 'assistant') {
                bolha.innerHTML = textoSeguro(mensagem.content);
            } else {
                bolha.textContent = mensagem.content;
            }
            artigo.appendChild(bolha);

            if (mensagem.role === 'user') {
                var avatarUser = document.createElement('div');
                avatarUser.className = 'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                avatarUser.textContent = 'TU';
                artigo.appendChild(avatarUser);
            }

            return artigo;
        }

        function renderizarMensagens() {
            lista.innerHTML = '';
            mensagens.forEach(function (mensagem) {
                lista.appendChild(criarBolha(mensagem));
            });
            lista.scrollTop = lista.scrollHeight;

            var apenasSaudacao = mensagens.length <= 1;
            sugestoes.innerHTML = '';
            if (apenasSaudacao) {
                var rotulo = document.createElement('p');
                rotulo.className = 'px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500';
                rotulo.textContent = 'Perguntas rápidas';
                sugestoes.appendChild(rotulo);

                var caixa = document.createElement('div');
                caixa.className = 'flex flex-wrap gap-1.5';
                SUGESTOES.forEach(function (pergunta) {
                    var botao = document.createElement('button');
                    botao.type = 'button';
                    botao.className = 'rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-[11px] font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300';
                    botao.textContent = pergunta;
                    botao.addEventListener('click', function () { enviarMensagem(pergunta); });
                    caixa.appendChild(botao);
                });
                sugestoes.appendChild(caixa);
            }
        }

        function mostrarIndicador() {
            var indicador = document.createElement('div');
            indicador.id = 'chatbot-typing';
            indicador.className = 'flex items-center gap-2.5 pl-9 text-slate-400 dark:text-slate-500';
            indicador.innerHTML = '<span class="flex items-center gap-1 text-blue-500"><span class="ca-typing-dot"></span><span class="ca-typing-dot"></span><span class="ca-typing-dot"></span></span><span class="text-[11px]">O assistente está a pensar…</span>';
            lista.appendChild(indicador);
            lista.scrollTop = lista.scrollHeight;
        }

        function removerIndicador() {
            var indicador = document.getElementById('chatbot-typing');
            if (indicador) indicador.remove();
        }

        function definirCarregando(estado) {
            aCarregar = estado;
            input.disabled = estado;
            enviar.disabled = estado;
            input.classList.toggle('opacity-60', estado);
        }

        async function enviarMensagem(texto) {
            var pergunta = String(texto || '').trim();
            if (!pergunta || aCarregar) return;

            mensagens.push({ role: 'user', content: pergunta });
            guardarHistorico(mensagens);
            renderizarMensagens();
            input.value = '';
            definirCarregando(true);
            mostrarIndicador();

            var controlador = new AbortController();
            var timeout = setTimeout(function () { controlador.abort(); }, 30000);

            try {
                var resposta = await fetch(apiBase + '/chatbot', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        message: pergunta,
                        history: mensagens.slice(-9, -1).map(function (m) {
                            return { role: m.role, content: m.content };
                        }),
                    }),
                    signal: controlador.signal,
                });

                var dados = await resposta.json().catch(function () { return null; });
                removerIndicador();

                if (!resposta.ok) {
                    throw new Error(dados && dados.message ? dados.message : 'Falha no assistente');
                }

                var respostaTexto = dados && dados.data && dados.data.reply
                    ? dados.data.reply
                    : 'Não consegui responder agora. Tenta reformular a pergunta.';

                mensagens.push({ role: 'assistant', content: respostaTexto });
            } catch (erro) {
                removerIndicador();
                var mensagemErro = erro && erro.name === 'AbortError'
                    ? 'O assistente demorou demasiado a responder. Tenta novamente dentro de instantes.'
                    : (erro && erro.message && erro.message.indexOf('Muitos pedidos') !== -1
                        ? erro.message
                        : 'Não consegui ligar ao assistente. Verifica a tua ligação e tenta novamente.');
                mensagens.push({ role: 'assistant', content: mensagemErro });
            } finally {
                clearTimeout(timeout);
                definirCarregando(false);
                guardarHistorico(mensagens);
                renderizarMensagens();
                input.focus();
            }
        }

        function abrir() {
            aberto = true;
            painel.classList.remove('hidden');
            painel.classList.add('flex', 'ca-animate-in');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Fechar assistente virtual');
            toggle.querySelector('span.relative:not(#chatbot-toggle-close)').classList.add('hidden');
            toggleClose.classList.remove('hidden');
            renderizarMensagens();
            setTimeout(function () { input.focus(); }, 80);
        }

        function fecharPainel() {
            aberto = false;
            painel.classList.add('hidden');
            painel.classList.remove('flex', 'ca-animate-in');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Abrir assistente virtual');
            toggle.querySelector('span.relative:not(#chatbot-toggle-close)').classList.remove('hidden');
            toggleClose.classList.add('hidden');
        }

        toggle.addEventListener('click', function () {
            if (aberto) fecharPainel();
            else abrir();
        });

        fechar.addEventListener('click', fecharPainel);
        document.addEventListener('keydown', function (evento) {
            if (evento.key === 'Escape' && aberto) fecharPainel();
        });

        document.querySelectorAll('[data-chatbot-open]').forEach(function (botao) {
            botao.addEventListener('click', function (evento) {
                evento.preventDefault();
                abrir();
            });
        });

        limpar.addEventListener('click', function () {
            if (aCarregar) return;
            mensagens = [{ role: 'assistant', content: SAUDACAO }];
            guardarHistorico(mensagens);
            renderizarMensagens();
            input.focus();
        });

        form.addEventListener('submit', function (evento) {
            evento.preventDefault();
            enviarMensagem(input.value);
        });

        renderizarMensagens();
    });
})();
