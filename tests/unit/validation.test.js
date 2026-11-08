const { validarDenuncia, LIMITES } = require('../../src/validation/denuncia');

function denunciaValida(overrides = {}) {
    return {
        id_categoria: '3',
        descricao: '  Buraco grande na via principal  ',
        latitude: '-25.9692',
        longitude: '32.5732',
        bairro: '  Polana  ',
        temFoto: true,
        ...overrides,
    };
}

describe('RQ1 — validação do registo de denúncia', () => {
    test('aceita dados válidos e normaliza espaços', () => {
        const { erros, valores } = validarDenuncia(denunciaValida());

        expect(erros).toEqual([]);
        expect(valores).toEqual({
            id_categoria: 3,
            descricao: 'Buraco grande na via principal',
            latitude: -25.9692,
            longitude: 32.5732,
            bairro: 'Polana',
        });
    });

    test('rejeita descrição com 9 caracteres (fronteira inferior inválida)', () => {
        const { erros } = validarDenuncia(denunciaValida({ descricao: '123456789' }));
        expect(erros).toContain(`A descrição deve ter pelo menos ${LIMITES.descricaoMin} caracteres.`);
    });

    test('aceita descrição com exactamente 10 caracteres (fronteira inferior válida)', () => {
        const { erros } = validarDenuncia(denunciaValida({ descricao: '1234567890' }));
        expect(erros).toEqual([]);
    });

    test('aceita descrição com exactamente 5000 caracteres e rejeita 5001', () => {
        expect(validarDenuncia(denunciaValida({ descricao: 'a'.repeat(5000) })).erros).toEqual([]);

        const { erros } = validarDenuncia(denunciaValida({ descricao: 'a'.repeat(5001) }));
        expect(erros).toContain(`A descrição não pode exceder ${LIMITES.descricaoMax} caracteres.`);
    });

    test.each([
        [undefined],
        [''],
        ['0'],
        ['-1'],
        ['abc'],
        ['3.5'],
    ])('rejeita categoria inválida: %p', (idCategoria) => {
        const { erros, valores } = validarDenuncia(denunciaValida({ id_categoria: idCategoria }));
        expect(erros).toContain('Escolhe uma categoria válida.');
        expect(valores.id_categoria).toBeNull();
    });

    test('rejeita GPS ausente ou não numérico', () => {
        const semGps = validarDenuncia(denunciaValida({ latitude: '', longitude: '' }));
        expect(semGps.erros).toContain('Não foi possível obter a localização. Activa o GPS ou marca no mapa.');

        const gpsInvalido = validarDenuncia(denunciaValida({ latitude: 'abc', longitude: 'xyz' }));
        expect(gpsInvalido.erros).toContain('Não foi possível obter a localização. Activa o GPS ou marca no mapa.');
    });

    test.each([
        ['-90', '180'],
        ['90', '-180'],
    ])('aceita coordenadas nos limites: lat=%s lng=%s', (latitude, longitude) => {
        const { erros } = validarDenuncia(denunciaValida({ latitude, longitude }));
        expect(erros).toEqual([]);
    });

    test.each([
        ['90.0001', '32'],
        ['-90.0001', '32'],
        ['0', '180.0001'],
        ['0', '-180.0001'],
    ])('rejeita coordenadas fora dos limites: lat=%s lng=%s', (latitude, longitude) => {
        const { erros } = validarDenuncia(denunciaValida({ latitude, longitude }));
        expect(erros).toContain('As coordenadas GPS estão fora dos limites válidos.');
    });

    test('rejeita denúncia sem fotografia', () => {
        const { erros } = validarDenuncia(denunciaValida({ temFoto: false }));
        expect(erros).toContain('Anexa uma fotografia do problema.');
    });

    test('aceita bairro vazio e rejeita 121 caracteres', () => {
        expect(validarDenuncia(denunciaValida({ bairro: '' })).erros).toEqual([]);

        const { erros } = validarDenuncia(denunciaValida({ bairro: 'b'.repeat(121) }));
        expect(erros).toContain(`O bairro ou ponto de referência não pode exceder ${LIMITES.bairroMax} caracteres.`);
    });

    test('aceita bairro com exactamente 120 caracteres', () => {
        const { erros, valores } = validarDenuncia(denunciaValida({ bairro: 'b'.repeat(120) }));
        expect(erros).toEqual([]);
        expect(valores.bairro).toHaveLength(120);
    });

    test('descrição só com espaços é rejeitada', () => {
        const { erros } = validarDenuncia(denunciaValida({ descricao: '          ' }));
        expect(erros).toContain(`A descrição deve ter pelo menos ${LIMITES.descricaoMin} caracteres.`);
    });
});
