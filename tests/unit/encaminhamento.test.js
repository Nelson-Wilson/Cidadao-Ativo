jest.mock('../../src/models/Departamento', () => ({
    buscarPorCategoriaId: jest.fn(),
}));
jest.mock('../../src/models/Municipio', () => ({
    primeiro: jest.fn(),
}));

const Departamento = require('../../src/models/Departamento');
const Municipio = require('../../src/models/Municipio');
const servicoEncaminhamento = require('../../src/services/servicoEncaminhamentoDenuncia');

describe('RQ1 — encaminhamento da denúncia para o município/departamento', () => {
    beforeEach(() => {
        Departamento.buscarPorCategoriaId.mockReset();
        Municipio.primeiro.mockReset();
    });

    test('usa o departamento responsável pela categoria quando existe', async () => {
        Departamento.buscarPorCategoriaId.mockResolvedValue({ id: 10, municipality_id: 1 });

        await expect(servicoEncaminhamento.encaminhar(3)).resolves.toEqual({
            id_municipio: 1,
            id_departamento: 10,
        });
        expect(Departamento.buscarPorCategoriaId).toHaveBeenCalledWith(3);
        expect(Municipio.primeiro).not.toHaveBeenCalled();
    });

    test('sem departamento, encaminha para o primeiro município sem departamento', async () => {
        Departamento.buscarPorCategoriaId.mockResolvedValue(null);
        Municipio.primeiro.mockResolvedValue({ id: 1, name: 'Maputo' });

        await expect(servicoEncaminhamento.encaminhar(99)).resolves.toEqual({
            id_municipio: 1,
            id_departamento: null,
        });
    });

    test('sem departamento e sem município, devolve null em ambos', async () => {
        Departamento.buscarPorCategoriaId.mockResolvedValue(null);
        Municipio.primeiro.mockResolvedValue(null);

        await expect(servicoEncaminhamento.encaminhar(99)).resolves.toEqual({
            id_municipio: null,
            id_departamento: null,
        });
    });
});
