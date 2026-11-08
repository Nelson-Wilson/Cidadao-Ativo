// Cidadão Ativo — mapa de localização e assistência por IA no formulário de denúncia.
(function () {
    'use strict';

    function obterApiBase() {
        var alvo = document.querySelector('[data-api-base]');
        return (alvo && alvo.dataset.apiBase) || '/api';
    }

    function csrfToken() {
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : '';
    }

    function alternar(elemento, visivel) {
        if (elemento) elemento.classList.toggle('hidden', !visivel);
    }

    // --- Localização: GPS + pino arrastável ---------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        var mapEl = document.getElementById('location-picker');
        if (!mapEl || typeof L === 'undefined') return;

        var latInput = document.getElementById('latitude');
        var lngInput = document.getElementById('longitude');
        var statusEl = document.getElementById('location-status');
        var defaultCenter = [-25.9692, 32.5732];

        var map = L.map(mapEl, { scrollWheelZoom: false }).setView(defaultCenter, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        var marker = null;

        function escreverStatus(texto) {
            if (statusEl) statusEl.textContent = texto;
        }

        function setLocation(lat, lng, zoom) {
            latInput.value = Number(lat).toFixed(7);
            lngInput.value = Number(lng).toFixed(7);

            if (marker) {
                marker.setLatLng([lat, lng]);
            } else {
                marker = L.marker([lat, lng], { draggable: true }).addTo(map);
                marker.on('dragend', function () {
                    var pos = marker.getLatLng();
                    setLocation(pos.lat, pos.lng, map.getZoom());
                    escreverStatus('Local ajustado manualmente. Confirma se o pino está no sítio certo.');
                    latInput.dispatchEvent(new Event('change'));
                });
            }

            map.setView([lat, lng], zoom || map.getZoom());
        }

        map.on('click', function (evento) {
            setLocation(evento.latlng.lat, evento.latlng.lng, map.getZoom());
            escreverStatus('Local escolhido no mapa. Podes arrastar o pino para afinar.');
            latInput.dispatchEvent(new Event('change'));
        });

        var latitudeInicial = parseFloat(latInput.value);
        var longitudeInicial = parseFloat(lngInput.value);
        var temPosicaoGuardada = Number.isFinite(latitudeInicial) && Number.isFinite(longitudeInicial);

        if (temPosicaoGuardada) {
            setLocation(latitudeInicial, longitudeInicial, 15);
            escreverStatus('Localização anterior recuperada. Podes ajustar o pino se necessário.');
            return;
        }

        if (!navigator.geolocation) {
            setLocation(defaultCenter[0], defaultCenter[1], 12);
            escreverStatus('O navegador não suporta geolocalização. Marca o local onde ocorreu o problema.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            function (posicao) {
                setLocation(posicao.coords.latitude, posicao.coords.longitude, 16);
                escreverStatus('Localização GPS obtida. Arrasta o pino se o ponto não estiver exato.');
                latInput.dispatchEvent(new Event('change'));
            },
            function () {
                setLocation(defaultCenter[0], defaultCenter[1], 12);
                escreverStatus('Sem acesso ao GPS. Clica no mapa para marcar o local.');
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    });

    // --- IA: sugestão de categoria, duplicados e análise da fotografia ------
    document.addEventListener('DOMContentLoaded', function () {
        var descriptionEl = document.getElementById('description');
        if (!descriptionEl) return;

        var categoryEl = document.getElementById('category_id');
        var latInput = document.getElementById('latitude');
        var lngInput = document.getElementById('longitude');
        var suggestionEl = document.getElementById('ai-suggestion');
        var duplicateWarning = document.getElementById('duplicate-warning');
        var duplicateList = document.getElementById('duplicate-list');
        var photoInput = document.getElementById('photo');
        var previewEl = document.getElementById('photo-preview');
        var photoNote = document.getElementById('photo-ai-note');
        var photoAnalyzing = document.getElementById('photo-analyzing');

        var apiBase = obterApiBase();
        var token = csrfToken();
        var debounceTimer = null;
        var sugestaoAtual = null;
        var previewUrl = null;

        function postJson(url, body) {
            return fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-Token': token,
                },
                body: JSON.stringify(body),
            }).then(function (resposta) {
                return resposta.ok ? resposta.json() : null;
            }).catch(function () {
                return null;
            });
        }

        function postForm(url, formData) {
            return fetch(url, {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-CSRF-Token': token },
                body: formData,
            }).then(function (resposta) {
                return resposta.ok ? resposta.json() : null;
            }).catch(function () {
                return null;
            });
        }

        async function runClassification() {
            var descricao = descriptionEl.value.trim();
            if (descricao.length < 10) {
                alternar(suggestionEl, false);
                return;
            }

            var resultado = await postJson(apiBase + '/ai/classify', { description: descricao });
            var dados = resultado && resultado.data;
            if (!dados || !dados.category_name) {
                alternar(suggestionEl, false);
                return;
            }

            sugestaoAtual = dados;
            suggestionEl.textContent = 'Sugestão da IA: “' + dados.category_name + '”'
                + (dados.severity === 'alta' ? ' — parece um caso mais grave' : '')
                + '. Clica para aplicar.';
            alternar(suggestionEl, true);
        }

        function criarItemDuplicado(match) {
            var item = document.createElement('div');
            item.className = 'flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-2.5 dark:border-amber-800 dark:bg-slate-900';

            if (match.photo_url) {
                var img = document.createElement('img');
                img.src = match.photo_url;
                img.alt = '';
                img.loading = 'lazy';
                img.className = 'h-12 w-12 shrink-0 rounded-lg object-cover';
                item.appendChild(img);
            }

            var corpo = document.createElement('div');
            corpo.className = 'min-w-0 flex-1';

            var descricao = document.createElement('p');
            descricao.className = 'text-[11px] leading-snug text-slate-700 dark:text-slate-200';
            descricao.textContent = match.description || 'Ocorrência sem descrição.';
            corpo.appendChild(descricao);

            var meta = document.createElement('p');
            meta.className = 'mt-0.5 text-[10px] text-slate-400 dark:text-slate-500';
            meta.textContent = (match.distance_km || 0) + ' km · '
                + (match.confirmations_count || 0) + ' confirmação(ões)';
            corpo.appendChild(meta);

            if (match.ai_same === true || match.ai_same === false) {
                var nota = document.createElement('p');
                nota.className = match.ai_same
                    ? 'mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300'
                    : 'mt-1 text-[10px] text-slate-500 dark:text-slate-400';
                nota.textContent = (match.ai_same ? 'A IA confirma: parece o mesmo problema' : 'A IA acha que pode ser diferente')
                    + (match.ai_reasoning ? ' — ' + match.ai_reasoning : '');
                corpo.appendChild(nota);
            }

            item.appendChild(corpo);

            var botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'shrink-0 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60';
            botao.textContent = 'É este';
            botao.addEventListener('click', async function () {
                botao.disabled = true;
                botao.textContent = 'A confirmar…';
                var confirmacao = await postJson(apiBase + '/ai/duplicates/' + match.report_id + '/confirm', {});
                botao.textContent = confirmacao ? 'Confirmado ✓' : 'Tenta novamente';
                botao.disabled = Boolean(confirmacao);
            });
            item.appendChild(botao);

            return item;
        }

        async function runDuplicateCheck() {
            var descricao = descriptionEl.value.trim();
            var categoria = categoryEl ? categoryEl.value : '';
            var lat = latInput ? latInput.value : '';
            var lng = lngInput ? lngInput.value : '';

            if (descricao.length < 10 || !categoria || !lat || !lng) {
                alternar(duplicateWarning, false);
                return;
            }

            var formData = new FormData();
            formData.append('description', descricao);
            formData.append('category_id', categoria);
            formData.append('latitude', lat);
            formData.append('longitude', lng);

            var ficheiro = photoInput && photoInput.files ? photoInput.files[0] : null;
            if (ficheiro) formData.append('photo', ficheiro);

            var resultado = await postForm(apiBase + '/ai/duplicates', formData);
            var matches = resultado && Array.isArray(resultado.data) ? resultado.data : [];

            if (!matches.length) {
                alternar(duplicateWarning, false);
                return;
            }

            duplicateList.innerHTML = '';
            matches.forEach(function (match) {
                duplicateList.appendChild(criarItemDuplicado(match));
            });
            alternar(duplicateWarning, true);
        }

        function debounce(fn, ms) {
            return function () {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(fn, ms);
            };
        }

        var verificarTudo = debounce(function () {
            runClassification();
            runDuplicateCheck();
        }, 700);

        descriptionEl.addEventListener('input', verificarTudo);
        if (categoryEl) categoryEl.addEventListener('change', verificarTudo);
        if (latInput) latInput.addEventListener('change', verificarTudo);

        if (suggestionEl) {
            suggestionEl.addEventListener('click', function () {
                if (!sugestaoAtual || !sugestaoAtual.category_id || !categoryEl) return;
                categoryEl.value = String(sugestaoAtual.category_id);
                alternar(suggestionEl, false);
                verificarTudo();
            });
        }

        // --- Análise da fotografia assim que é escolhida -------------------
        if (photoInput) {
            photoInput.addEventListener('change', async function () {
                var ficheiro = photoInput.files ? photoInput.files[0] : null;

                if (previewEl) {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    if (ficheiro) {
                        previewUrl = URL.createObjectURL(ficheiro);
                        previewEl.src = previewUrl;
                        alternar(previewEl, true);
                    } else {
                        previewUrl = null;
                        previewEl.removeAttribute('src');
                        alternar(previewEl, false);
                    }
                }

                if (!ficheiro) return;

                alternar(photoNote, false);
                alternar(photoAnalyzing, true);

                var formData = new FormData();
                formData.append('photo', ficheiro);
                formData.append('description', descriptionEl.value.trim());

                var resultado = await postForm(apiBase + '/ai/analyze-photo', formData);
                var dados = resultado && resultado.data;

                alternar(photoAnalyzing, false);

                if (!dados || !dados.category_id) return;

                if (categoryEl) categoryEl.value = String(dados.category_id);

                if (photoNote) {
                    photoNote.textContent = 'A IA identificou “' + dados.category_name + '” na fotografia.'
                        + (dados.severity === 'alta' ? ' Parece um caso mais grave.' : '')
                        + ' Podes corrigir se não for isso.';
                    alternar(photoNote, true);
                }

                runDuplicateCheck();
            });
        }
    });

    // --- Prevenção de duplo envio ------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        var form = document.querySelector('form[action$="/denuncias"]');
        if (!form) return;

        form.addEventListener('submit', function () {
            var botao = form.querySelector('button[type="submit"]');
            if (!botao || botao.disabled) return;
            botao.disabled = true;
            botao.dataset.original = botao.textContent;
            botao.textContent = 'A enviar denúncia…';
            botao.classList.add('opacity-60', 'cursor-not-allowed');
        });
    });
})();
