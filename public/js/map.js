// Cidadão Ativo — mapa público de ocorrências (Leaflet + /api/reports).
(function () {
    'use strict';

    var STATUS_META = {
        recebida: { color: '#94a3b8', label: 'Recebida' },
        em_analise: { color: '#f59e0b', label: 'Em análise' },
        atribuida: { color: '#8b5cf6', label: 'Atribuída' },
        em_execucao: { color: '#0ea5e9', label: 'Em execução' },
        resolvida: { color: '#10b981', label: 'Resolvida' },
        fechada: { color: '#059669', label: 'Fechada' },
        rejeitada: { color: '#e11d48', label: 'Rejeitada' },
    };

    function metaEstado(status) {
        return STATUS_META[status] || { color: '#64748b', label: String(status || '').replace(/_/g, ' ') };
    }

    function obterApiBase() {
        var alvo = document.querySelector('[data-api-base]');
        return (alvo && alvo.dataset.apiBase) || '/api';
    }

    function urlImagemSegura(caminho) {
        if (!caminho) return null;
        try {
            var url = new URL(caminho, window.location.origin);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
            return url.href;
        } catch (erro) {
            return null;
        }
    }

    function formatarData(valor) {
        if (!valor) return '';
        var texto = String(valor).split(' ')[0];
        var partes = texto.split('-');
        return partes.length === 3 ? partes[2] + '/' + partes[1] + '/' + partes[0] : texto;
    }

    function criarPopup(report) {
        var meta = metaEstado(report.status);
        var caixa = document.createElement('div');
        caixa.className = 'w-56 space-y-1.5';

        var foto = urlImagemSegura(report.photo_url);
        if (foto) {
            var img = document.createElement('img');
            img.src = foto;
            img.alt = report.category || 'Ocorrência';
            img.loading = 'lazy';
            img.className = 'mb-2 h-28 w-full rounded-lg object-cover';
            caixa.appendChild(img);
        }

        var titulo = document.createElement('p');
        titulo.className = 'text-sm font-bold text-slate-900 dark:text-slate-100';
        titulo.textContent = report.category || 'Sem categoria';
        caixa.appendChild(titulo);

        var estado = document.createElement('span');
        estado.className = 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
        var ponto = document.createElement('span');
        ponto.className = 'h-1.5 w-1.5 rounded-full';
        ponto.style.background = meta.color;
        estado.appendChild(ponto);
        estado.appendChild(document.createTextNode(meta.label));
        caixa.appendChild(estado);

        if (report.description) {
            var descricao = document.createElement('p');
            descricao.className = 'pt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400';
            descricao.textContent = report.description;
            caixa.appendChild(descricao);
        }

        var rodape = document.createElement('p');
        rodape.className = 'pt-1 text-[10px] text-slate-400 dark:text-slate-500';
        rodape.textContent = [report.neighborhood || null, formatarData(report.created_at)]
            .filter(Boolean)
            .join(' · ');
        caixa.appendChild(rodape);

        return caixa;
    }

    function criarCartao(report, aoSelecionar) {
        var meta = metaEstado(report.status);

        var botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/30';
        botao.setAttribute('aria-label', 'Ver ' + (report.category || 'ocorrência') + ' no mapa');

        var foto = urlImagemSegura(report.photo_url);
        if (foto) {
            var img = document.createElement('img');
            img.src = foto;
            img.alt = '';
            img.loading = 'lazy';
            img.className = 'h-12 w-12 shrink-0 rounded-lg object-cover';
            botao.appendChild(img);
        } else {
            var marcador = document.createElement('span');
            marcador.className = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500';
            marcador.innerHTML = '<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
            botao.appendChild(marcador);
        }

        var corpo = document.createElement('span');
        corpo.className = 'min-w-0 flex-1';

        var topo = document.createElement('span');
        topo.className = 'flex items-center justify-between gap-2';
        var nome = document.createElement('span');
        nome.className = 'truncate text-xs font-bold text-slate-800 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300';
        nome.textContent = report.category || 'Sem categoria';
        topo.appendChild(nome);
        var ponto = document.createElement('span');
        ponto.className = 'h-2 w-2 shrink-0 rounded-full';
        ponto.style.background = meta.color;
        ponto.title = meta.label;
        topo.appendChild(ponto);
        corpo.appendChild(topo);

        var descricao = document.createElement('span');
        descricao.className = 'mt-0.5 line-clamp-2 block text-[11px] leading-snug text-slate-500 dark:text-slate-400';
        descricao.textContent = report.description || 'Sem descrição.';
        corpo.appendChild(descricao);

        var rodape = document.createElement('span');
        rodape.className = 'mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500';
        rodape.textContent = [meta.label, report.neighborhood || 'Maputo', formatarData(report.created_at)]
            .filter(Boolean)
            .join(' · ');
        corpo.appendChild(rodape);

        botao.appendChild(corpo);
        botao.addEventListener('click', aoSelecionar);
        return botao;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var mapEl = document.getElementById('reports-map');
        if (!mapEl || typeof L === 'undefined') return;

        var map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: true }).setView([-25.9692, 32.5732], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        var markersLayer = L.layerGroup().addTo(map);
        var categorySelect = document.getElementById('filter-category');
        var statusSelect = document.getElementById('filter-status');
        var listEl = document.getElementById('reports-list');
        var emptyEl = document.getElementById('reports-empty');
        var loadingEl = document.getElementById('reports-loading');
        var errorEl = document.getElementById('reports-error');
        var apiBase = obterApiBase();
        var controlador = null;

        function atualizarContadores(denuncias) {
            var total = denuncias.length;
            var resolvidas = denuncias.filter(function (d) {
                return d.status === 'resolvida' || d.status === 'fechada';
            }).length;
            var emCurso = denuncias.filter(function (d) {
                return d.status === 'atribuida' || d.status === 'em_execucao';
            }).length;

            document.querySelectorAll('[data-map-total]').forEach(function (el) { el.textContent = String(total); });
            document.querySelectorAll('[data-map-resolved]').forEach(function (el) { el.textContent = String(resolvidas); });
            document.querySelectorAll('[data-map-active]').forEach(function (el) { el.textContent = String(emCurso); });
        }

        function mostrarEstado(nome) {
            if (loadingEl) loadingEl.classList.toggle('hidden', nome !== 'loading');
            if (emptyEl) emptyEl.classList.toggle('hidden', nome !== 'empty');
            if (errorEl) errorEl.classList.toggle('hidden', nome !== 'error');
        }

        async function carregarDenuncias() {
            var params = new URLSearchParams();
            if (categorySelect && categorySelect.value) params.set('id_categoria', categorySelect.value);
            if (statusSelect && statusSelect.value) params.set('status', statusSelect.value);

            if (controlador) controlador.abort();
            controlador = new AbortController();
            mostrarEstado('loading');
            if (listEl) listEl.innerHTML = '';

            try {
                var resposta = await fetch(apiBase + '/reports?' + params.toString(), {
                    headers: { Accept: 'application/json' },
                    signal: controlador.signal,
                });
                if (!resposta.ok) throw new Error('Falha ao obter ocorrências');

                var corpo = await resposta.json();
                var denuncias = Array.isArray(corpo.data) ? corpo.data : [];

                markersLayer.clearLayers();
                if (listEl) listEl.innerHTML = '';

                denuncias.forEach(function (report) {
                    if (!Number.isFinite(report.latitude) || !Number.isFinite(report.longitude)) return;

                    var meta = metaEstado(report.status);
                    var marcador = L.marker([report.latitude, report.longitude], {
                        icon: L.divIcon({
                            className: 'ca-map-marker',
                            html: '<span style="background:' + meta.color + '"></span>',
                            iconSize: [18, 18],
                            iconAnchor: [9, 9],
                            popupAnchor: [0, -10],
                        }),
                        title: report.category || 'Ocorrência',
                        alt: report.category || 'Ocorrência',
                    });

                    marcador.bindPopup(criarPopup(report), { maxWidth: 260, minWidth: 200 });
                    marcador.addTo(markersLayer);

                    if (listEl) {
                        listEl.appendChild(criarCartao(report, function () {
                            map.setView([report.latitude, report.longitude], 16);
                            marcador.openPopup();
                        }));
                    }
                });

                atualizarContadores(denuncias);
                mostrarEstado(denuncias.length ? 'map' : 'empty');
            } catch (erro) {
                if (erro && erro.name === 'AbortError') return;
                console.error('Erro ao carregar ocorrências para o mapa:', erro);
                mostrarEstado('error');
            }
        }

        var recenterBtn = document.getElementById('btn-recenter');
        if (recenterBtn) {
            recenterBtn.addEventListener('click', function () {
                map.setView([-25.9692, 32.5732], 13);
            });
        }

        if (categorySelect) categorySelect.addEventListener('change', carregarDenuncias);
        if (statusSelect) statusSelect.addEventListener('change', carregarDenuncias);

        carregarDenuncias();
    });
})();
