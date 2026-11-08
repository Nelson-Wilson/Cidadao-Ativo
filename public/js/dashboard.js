// Cidadão Ativo — mapa de calor do dashboard municipal.
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var el = document.getElementById('heatmap');
        if (!el || typeof L === 'undefined') return;

        var pontos = [];
        try {
            var bruto = el.dataset.points ? JSON.parse(el.dataset.points) : [];
            if (Array.isArray(bruto)) {
                pontos = bruto.filter(function (ponto) {
                    return Array.isArray(ponto)
                        && Number.isFinite(ponto[0])
                        && Number.isFinite(ponto[1]);
                });
            }
        } catch (erro) {
            pontos = [];
        }

        var map = L.map(el, { scrollWheelZoom: false }).setView([-25.9692, 32.5732], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        if (!pontos.length) {
            var aviso = document.getElementById('heatmap-empty');
            if (aviso) aviso.classList.remove('hidden');
            return;
        }

        if (typeof L.heatLayer === 'function') {
            L.heatLayer(pontos, {
                radius: 28,
                blur: 18,
                maxZoom: 17,
                minOpacity: 0.35,
                gradient: {
                    0.2: '#3b82f6',
                    0.45: '#22c55e',
                    0.7: '#f59e0b',
                    1: '#ef4444',
                },
            }).addTo(map);
        } else {
            // Fallback: círculos simples se o plugin de heatmap não carregar.
            pontos.forEach(function (ponto) {
                L.circle([ponto[0], ponto[1]], {
                    radius: 180,
                    color: '#ef4444',
                    fillColor: '#f97316',
                    fillOpacity: 0.25,
                    weight: 1,
                }).addTo(map);
            });
        }

        if (pontos.length === 1) {
            map.setView([pontos[0][0], pontos[0][1]], 14);
        } else {
            map.fitBounds(L.latLngBounds(pontos.map(function (p) { return [p[0], p[1]]; })), {
                padding: [32, 32],
                maxZoom: 14,
            });
        }
    });
})();
