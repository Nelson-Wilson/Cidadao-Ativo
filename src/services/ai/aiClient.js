const config = require('../../config');

/**
 * Cliente centralizado para a API Google Gemini (generateContent).
 *
 * Mantém a aplicação desacoplada do fornecedor: os serviços de IA enviam
 * mensagens num formato neutro (texto + imagens) e este módulo traduz para
 * o formato `contents/parts` do Gemini. Em caso de falha devolve `null` para
 * que o chamador possa usar uma contingência determinística.
 */
class AIClient {
    static estaConfigurado() {
        return Boolean(config.ai.apiKey);
    }

    static modeloAtual() {
        return config.ai.model;
    }

    /**
     * Converte o conteúdo neutro de uma mensagem em `parts` do Gemini.
     * Aceita strings, blocos `{ type: 'text' }` e imagens em dois formatos:
     * `{ type: 'image', mimeType, data }` (novo) ou o formato legado
     * Anthropic `{ type: 'image', source: { media_type, data } }`.
     */
    static converterParts(conteudo) {
        if (typeof conteudo === 'string') {
            return conteudo.trim() ? [{ text: conteudo }] : [];
        }

        if (!Array.isArray(conteudo)) return [];

        const parts = [];
        for (const bloco of conteudo) {
            if (!bloco || typeof bloco !== 'object') continue;

            if (bloco.type === 'text' && typeof bloco.text === 'string' && bloco.text.trim()) {
                parts.push({ text: bloco.text });
                continue;
            }

            if (bloco.type === 'image') {
                const mimeType = bloco.mimeType || bloco.source?.media_type;
                const data = bloco.data || bloco.source?.data;
                if (mimeType && data) {
                    parts.push({ inlineData: { mimeType, data } });
                }
            }
        }
        return parts;
    }

    static construirUrl(modelo = config.ai.model) {
        const base = config.ai.apiUrl;
        if (base.includes('{model}')) {
            return base.replace('{model}', encodeURIComponent(modelo));
        }
        if (base.includes(':generateContent')) {
            return base;
        }
        return `${base}/models/${encodeURIComponent(modelo)}:generateContent`;
    }

    static extrairTexto(dados) {
        const candidatos = Array.isArray(dados?.candidates) ? dados.candidates : [];
        const primeiro = candidatos[0];
        const partes = Array.isArray(primeiro?.content?.parts) ? primeiro.content.parts : [];
        return partes
            .filter((parte) => typeof parte?.text === 'string')
            .map((parte) => parte.text)
            .join('')
            .trim();
    }

    /**
     * Envia um pedido de geração de conteúdo.
     *
     * @param {Object} opcoes
     * @param {string} [opcoes.systemPrompt]
     * @param {Array<{role: string, content: string|Array}>} opcoes.messages
     * @param {number} [opcoes.maxTokens=300]
     * @param {number} [opcoes.timeoutMs]
     * @param {number} [opcoes.temperature=0.4]
     * @param {boolean} [opcoes.json=false] Pede resposta JSON ao modelo.
     * @param {number} [opcoes.tentativas=2] Total de tentativas em erros transitórios.
     * @returns {Promise<string|null>}
     */
    static async enviarMensagem({
        systemPrompt,
        messages,
        maxTokens = 300,
        timeoutMs = config.ai.timeoutMs,
        temperature = 0.4,
        json = false,
        tentativas = 2,
    }) {
        if (!config.ai.apiKey) return null;

        const contents = [];
        let instrucaoSistema = systemPrompt || '';

        for (const mensagem of Array.isArray(messages) ? messages : []) {
            if (!mensagem) continue;

            const partes = this.converterParts(mensagem.content);
            if (!partes.length) continue;

            if (mensagem.role === 'system') {
                instrucaoSistema = [instrucaoSistema, mensagem.content].filter(Boolean).join('\n\n');
                continue;
            }

            contents.push({
                role: mensagem.role === 'assistant' || mensagem.role === 'model' ? 'model' : 'user',
                parts: partes,
            });
        }

        if (!contents.length) return null;

        const corpo = {
            contents,
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature,
            },
        };

        if (json) {
            corpo.generationConfig.responseMimeType = 'application/json';
        }

        if (instrucaoSistema.trim()) {
            corpo.systemInstruction = { parts: [{ text: instrucaoSistema.trim() }] };
        }

        // Ordem de modelos: principal + fallback. O fallback cobre 404/429/503
        // e timeouts, mantendo o assistente utilizável quando um modelo free
        // está sobrecarregado.
        const modelos = [...new Set(
            [config.ai.model, config.ai.fallbackModel].filter(Boolean)
        )];
        const totalTentativas = Math.max(1, Math.min(Number(tentativas) || 1, 3));

        for (let indiceModelo = 0; indiceModelo < modelos.length; indiceModelo += 1) {
            const modelo = modelos[indiceModelo];
            const url = this.construirUrl(modelo);
            const temFallback = indiceModelo < modelos.length - 1;

            const corpoModelo = {
                ...corpo,
                generationConfig: { ...corpo.generationConfig },
            };

            // Thinking só existe em Gemini 3+; em modelos anteriores o
            // parâmetro provocaria erro.
            if (config.ai.thinkingLevel && /^gemini-[34]/.test(modelo)) {
                corpoModelo.generationConfig.thinkingConfig = { thinkingLevel: config.ai.thinkingLevel };
            }

            for (let tentativa = 1; tentativa <= totalTentativas; tentativa += 1) {
                try {
                    const resposta = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': config.ai.apiKey,
                        },
                        signal: AbortSignal.timeout(timeoutMs),
                        body: JSON.stringify(corpoModelo),
                    });

                    if (!resposta.ok) {
                        const erroTexto = await resposta.text().catch(() => '');
                        const transitorio = [429, 500, 502, 503, 504].includes(resposta.status);
                        const modeloIndisponivel = [404, 429, 503].includes(resposta.status);

                        console.error(
                            `[AIClient Gemini HTTP ${resposta.status}] (${modelo}) `
                            + erroTexto.slice(0, 500)
                        );

                        if (modeloIndisponivel && temFallback) {
                            console.warn(
                                `[AIClient Gemini] ${modelo} indisponível; a tentar ${modelos[indiceModelo + 1]}.`
                            );
                            break;
                        }

                        if (transitorio && tentativa < totalTentativas) {
                            await new Promise((resolver) => setTimeout(resolver, 700 * tentativa));
                            continue;
                        }
                        return null;
                    }

                    const dados = await resposta.json();

                    if (dados?.promptFeedback?.blockReason) {
                        console.warn(`[AIClient Gemini] Pedido bloqueado: ${dados.promptFeedback.blockReason}`);
                        return null;
                    }

                    const texto = this.extrairTexto(dados);
                    if (!texto) {
                        const motivo = dados?.candidates?.[0]?.finishReason || 'sem conteúdo';
                        console.warn(`[AIClient Gemini] Resposta vazia em ${modelo} (${motivo}).`);
                        if (temFallback) break;
                        return null;
                    }

                    return texto;
                } catch (err) {
                    const transitorio = err?.name === 'TimeoutError' || err?.name === 'AbortError';
                    console.error(`[AIClient Gemini Falha de Comunicação] (${modelo}): ${err.message}`);

                    if (transitorio && temFallback) {
                        console.warn(
                            `[AIClient Gemini] ${modelo} expirou; a tentar ${modelos[indiceModelo + 1]}.`
                        );
                        break;
                    }

                    if (transitorio && tentativa < totalTentativas) {
                        await new Promise((resolver) => setTimeout(resolver, 700 * tentativa));
                        continue;
                    }
                    return null;
                }
            }
        }

        return null;
    }
}

module.exports = AIClient;
