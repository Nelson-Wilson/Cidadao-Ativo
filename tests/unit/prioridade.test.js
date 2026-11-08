jest.mock('../../src/models/ConfirmacaoDenuncia', () => ({
    contarPorDenuncia: jest.fn(),
}));

const ConfirmacaoDenuncia = require('../../src/models/ConfirmacaoDenuncia');
const config = require('../../src/config');
const { calcular, estaAtivo } = require('../../src/services/ai/servicoPrioridade');

const featureOriginal = config.ai.features.priority;

function denuncia(overrides = {}) {
    return {
        id: 1,
        description: 'Buraco na via pública',
        latitude: -25.8,
        longitude: 32.4,
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

describe('RQ1 — prioridade com salvaguarda de segurança', () => {
    beforeEach(() => {
        config.ai.features.priority = true;
        ConfirmacaoDenuncia.contarPorDenuncia.mockReset();
        ConfirmacaoDenuncia.contarPorDenuncia.mockResolvedValue(0);
    });

    afterAll(() => {
        config.ai.features.priority = featureOriginal;
    });

    test.each([
        'Há risco de vida no local',
        'CABO ELÉTRICO CAÍDO junto à escola',
        'Criança ferida no cruzamento',
        'Incêndio num edifício abandonado',
        'Perigo de desabamento',
    ])('fail-safe: perigo de vida força muito_urgente (%s)', async (descricao) => {
        await expect(calcular(denuncia({ description: descricao }), 'baixa')).resolves.toBe('muito_urgente');
    });

    test('a normalização ignora acentos e maiúsculas', async () => {
        await expect(calcular(denuncia({ description: 'Cabo Eletrico Caido' }), 'normal'))
            .resolves.toBe('muito_urgente');
    });

    test('quando a funcionalidade de prioridade está desactivada, usa a gravidade como fallback', async () => {
        config.ai.features.priority = false;

        await expect(calcular(denuncia(), 'alta')).resolves.toBe('urgente');
        await expect(calcular(denuncia(), 'normal')).resolves.toBe('normal');
        await expect(calcular(denuncia(), 'baixa')).resolves.toBe('normal');
        expect(ConfirmacaoDenuncia.contarPorDenuncia).not.toHaveBeenCalled();
    });

    test('denúncia recente, longe de locais sensíveis e sem confirmações fica baixa', async () => {
        await expect(calcular(denuncia(), 'normal')).resolves.toBe('baixa');
    });

    test('gravidade alta isolada sobe para normal', async () => {
        await expect(calcular(denuncia(), 'alta')).resolves.toBe('normal');
    });

    test('gravidade alta perto de local sensível sobe para urgente', async () => {
        const pertoDoHospital = denuncia({ latitude: -25.9631, longitude: 32.5811 });
        await expect(calcular(pertoDoHospital, 'alta')).resolves.toBe('urgente');
    });

    test('cinco confirmações, gravidade alta e local sensível atingem muito_urgente', async () => {
        ConfirmacaoDenuncia.contarPorDenuncia.mockResolvedValue(5);
        const pertoDoHospital = denuncia({ latitude: -25.9631, longitude: 32.5811 });
        await expect(calcular(pertoDoHospital, 'alta')).resolves.toBe('muito_urgente');
    });

    test('duas confirmações com gravidade alta sobem para urgente', async () => {
        ConfirmacaoDenuncia.contarPorDenuncia.mockResolvedValue(2);
        await expect(calcular(denuncia(), 'alta')).resolves.toBe('urgente');
    });

    test('denúncia aberta há mais de 14 dias recebe peso de antiguidade', async () => {
        const antiga = denuncia({ created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString() });
        await expect(calcular(antiga, 'alta')).resolves.toBe('urgente');
    });

    test('estaAtivo reflecte a flag de configuração', () => {
        expect(estaAtivo()).toBe(true);
        config.ai.features.priority = false;
        expect(estaAtivo()).toBe(false);
    });
});
