const {
    STATUSES,
    TRANSITIONS,
    podeMudarStatus,
} = require('../../src/domain/estadosDenuncia');

describe('RQ3 — máquina de estados da denúncia', () => {
    test('define exactamente os sete estados do domínio', () => {
        expect(STATUSES).toEqual([
            'recebida',
            'em_analise',
            'atribuida',
            'em_execucao',
            'resolvida',
            'fechada',
            'rejeitada',
        ]);
    });

    test.each([
        ['recebida', 'em_analise'],
        ['em_analise', 'atribuida'],
        ['em_analise', 'rejeitada'],
        ['atribuida', 'em_execucao'],
        ['em_execucao', 'resolvida'],
        ['resolvida', 'fechada'],
    ])('aceita a transição válida %s -> %s', (de, para) => {
        expect(podeMudarStatus(de, para)).toBe(true);
    });

    test('rejeita todos os pares que não estão na tabela de transições', () => {
        const paresValidos = new Set();
        for (const [de, destinos] of Object.entries(TRANSITIONS)) {
            for (const para of destinos) {
                paresValidos.add(`${de}->${para}`);
            }
        }

        for (const de of STATUSES) {
            for (const para of STATUSES) {
                if (!paresValidos.has(`${de}->${para}`)) {
                    expect(podeMudarStatus(de, para)).toBe(false);
                }
            }
        }
    });

    test('estados finais não têm transições de saída', () => {
        expect(TRANSITIONS.fechada).toEqual([]);
        expect(TRANSITIONS.rejeitada).toEqual([]);
        for (const estado of STATUSES) {
            expect(podeMudarStatus('fechada', estado)).toBe(false);
            expect(podeMudarStatus('rejeitada', estado)).toBe(false);
        }
    });

    test('não permite transição para o mesmo estado nem estados desconhecidos', () => {
        for (const estado of STATUSES) {
            expect(podeMudarStatus(estado, estado)).toBe(false);
        }
        expect(podeMudarStatus('inventado', 'recebida')).toBe(false);
        expect(podeMudarStatus('recebida', 'inventado')).toBe(false);
    });
});
