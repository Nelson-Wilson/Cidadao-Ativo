/**
 * Testa a orquestração do AIClient: modelo principal, fallback e thinking.
 * Nenhum pedido real é feito — `fetch` é sempre substituído.
 */
describe('AIClient — fallback de modelo', () => {
    const fetchOriginal = global.fetch;
    const envOriginal = { ...process.env };

    function respostaOk(texto) {
        return {
            ok: true,
            status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }),
        };
    }

    function respostaErro(status) {
        return { ok: false, status, text: async () => 'erro simulado' };
    }

    beforeEach(() => {
        jest.resetModules();
        process.env.GEMINI_API_KEY = 'chave-de-teste';
        process.env.AI_API_KEY = '';
        process.env.AI_API_URL = 'https://exemplo.test/v1beta';
        process.env.AI_MODEL = 'gemini-3.8-flash';
        process.env.AI_MODEL_FALLBACK = 'gemini-3.5-flash-lite';
        process.env.AI_THINKING_LEVEL = 'LOW';
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        global.fetch = fetchOriginal;
        process.env = { ...envOriginal };
        jest.resetModules();
        jest.restoreAllMocks();
    });

    test('usa o fallback quando o modelo principal devolve 503', async () => {
        const chamadas = [];
        global.fetch = jest.fn(async (url, opcoes) => {
            chamadas.push({ url: String(url), opcoes });
            return String(url).includes('gemini-3.8-flash')
                ? respostaErro(503)
                : respostaOk('OK do fallback');
        });

        const AIClient = require('../../src/services/ai/aiClient');
        const texto = await AIClient.enviarMensagem({
            messages: [{ role: 'user', content: 'Olá' }],
        });

        expect(texto).toBe('OK do fallback');
        expect(chamadas).toHaveLength(2);
        expect(chamadas[0].url).toContain('gemini-3.8-flash');
        expect(chamadas[1].url).toContain('gemini-3.5-flash-lite');

        const corpo = JSON.parse(chamadas[1].opcoes.body);
        expect(corpo.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    });

    test('usa o fallback quando o modelo principal expira', async () => {
        const chamadas = [];
        global.fetch = jest.fn(async (url) => {
            chamadas.push(String(url));
            if (String(url).includes('gemini-3.8-flash')) {
                const erro = new Error('tempo esgotado');
                erro.name = 'TimeoutError';
                throw erro;
            }
            return respostaOk('OK após timeout');
        });

        const AIClient = require('../../src/services/ai/aiClient');
        const texto = await AIClient.enviarMensagem({
            messages: [{ role: 'user', content: 'Olá' }],
        });

        expect(texto).toBe('OK após timeout');
        expect(chamadas).toHaveLength(2);
    });

    test('não chama o fallback quando o principal responde', async () => {
        const chamadas = [];
        global.fetch = jest.fn(async (url) => {
            chamadas.push(String(url));
            return respostaOk('OK do principal');
        });

        const AIClient = require('../../src/services/ai/aiClient');
        const texto = await AIClient.enviarMensagem({
            messages: [{ role: 'user', content: 'Olá' }],
        });

        expect(texto).toBe('OK do principal');
        expect(chamadas).toHaveLength(1);
        expect(chamadas[0]).toContain('gemini-3.8-flash');
    });

    test('não envia thinkingConfig para modelos anteriores ao Gemini 3', async () => {
        process.env.AI_MODEL = 'gemini-2.5-flash-lite';
        process.env.AI_MODEL_FALLBACK = '';
        const chamadas = [];
        global.fetch = jest.fn(async (url, opcoes) => {
            chamadas.push({ url: String(url), opcoes });
            return respostaOk('OK');
        });

        const AIClient = require('../../src/services/ai/aiClient');
        const texto = await AIClient.enviarMensagem({
            messages: [{ role: 'user', content: 'Olá' }],
        });

        expect(texto).toBe('OK');
        const corpo = JSON.parse(chamadas[0].opcoes.body);
        expect(corpo.generationConfig.thinkingConfig).toBeUndefined();
    });
});
