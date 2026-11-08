const {
    podeAcederDenuncia,
    podeGerirDenuncia,
    podeAtribuirTecnico,
} = require('../../src/authorization');

const denunciaMaputo = {
    user_id: 10,
    technician_id: 30,
    municipality_id: 1,
    department_id: 100,
};

const cidadaoMaria = { id: 10, role: 'cidadao' };
const cidadaoRita = { id: 11, role: 'cidadao' };
const tecnicoCarlos = { id: 30, role: 'tecnico', municipality_id: 1, department_id: 100 };
const tecnicoPedro = { id: 31, role: 'tecnico', municipality_id: 2, department_id: 200 };
const gestorJoao = { id: 20, role: 'municipio', municipality_id: 1 };
const gestoraAna = { id: 21, role: 'municipio', municipality_id: 2 };
const gestorSemMunicipio = { id: 22, role: 'municipio', municipality_id: null };
const admin = { id: 1, role: 'admin' };

describe('RQ2/RQ3 — autorização de acesso à denúncia', () => {
    test('admin acede a qualquer denúncia', () => {
        expect(podeAcederDenuncia(admin, denunciaMaputo)).toBe(true);
    });

    test('cidadão acede apenas à sua própria denúncia', () => {
        expect(podeAcederDenuncia(cidadaoMaria, denunciaMaputo)).toBe(true);
        expect(podeAcederDenuncia(cidadaoRita, denunciaMaputo)).toBe(false);
    });

    test('técnico acede apenas a denúncias que lhe estão atribuídas', () => {
        expect(podeAcederDenuncia(tecnicoCarlos, denunciaMaputo)).toBe(true);
        expect(podeAcederDenuncia(tecnicoPedro, denunciaMaputo)).toBe(false);
    });

    test('gestor municipal acede apenas ao seu município', () => {
        expect(podeAcederDenuncia(gestorJoao, denunciaMaputo)).toBe(true);
        expect(podeAcederDenuncia(gestoraAna, denunciaMaputo)).toBe(false);
        expect(podeAcederDenuncia(gestorSemMunicipio, denunciaMaputo)).toBe(false);
    });

    test('papel desconhecido ou dados em falta são negados', () => {
        expect(podeAcederDenuncia({ id: 99, role: 'desconhecido' }, denunciaMaputo)).toBe(false);
        expect(podeAcederDenuncia(null, denunciaMaputo)).toBe(false);
        expect(podeAcederDenuncia(admin, null)).toBe(false);
    });
});

describe('RQ2 — gestão municipal da denúncia', () => {
    test('admin pode gerir qualquer denúncia', () => {
        expect(podeGerirDenuncia(admin, denunciaMaputo)).toBe(true);
    });

    test('gestor do mesmo município pode gerir; outro município não', () => {
        expect(podeGerirDenuncia(gestorJoao, denunciaMaputo)).toBe(true);
        expect(podeGerirDenuncia(gestoraAna, denunciaMaputo)).toBe(false);
        expect(podeGerirDenuncia(gestorSemMunicipio, denunciaMaputo)).toBe(false);
    });

    test('cidadão e técnico não podem gerir a denúncia municipal', () => {
        expect(podeGerirDenuncia(cidadaoMaria, denunciaMaputo)).toBe(false);
        expect(podeGerirDenuncia(tecnicoCarlos, denunciaMaputo)).toBe(false);
    });
});

describe('RQ2 — regra de atribuição de técnico', () => {
    test('aceita técnico do mesmo departamento e município', () => {
        expect(podeAtribuirTecnico(gestorJoao, denunciaMaputo, tecnicoCarlos)).toBe(true);
    });

    test.each([
        ['cidadão', cidadaoMaria],
        ['gestor municipal', gestorJoao],
        ['admin', admin],
    ])('rejeita utilizador que não é técnico: %s', (_nome, utilizador) => {
        expect(podeAtribuirTecnico(gestorJoao, denunciaMaputo, utilizador)).toBe(false);
    });

    test('rejeita técnico de outro departamento', () => {
        const tecnicoOutroDepartamento = { ...tecnicoCarlos, department_id: 999 };
        expect(podeAtribuirTecnico(gestorJoao, denunciaMaputo, tecnicoOutroDepartamento)).toBe(false);
    });

    test('rejeita técnico de outro município', () => {
        expect(podeAtribuirTecnico(gestorJoao, denunciaMaputo, tecnicoPedro)).toBe(false);
    });

    test('rejeita gestor de outro município mesmo com técnico compatível', () => {
        expect(podeAtribuirTecnico(gestoraAna, denunciaMaputo, tecnicoCarlos)).toBe(false);
    });

    test('rejeita quando a denúncia ou o técnico não têm departamento', () => {
        expect(podeAtribuirTecnico(gestorJoao, { ...denunciaMaputo, department_id: null }, tecnicoCarlos)).toBe(false);
        expect(podeAtribuirTecnico(gestorJoao, denunciaMaputo, { ...tecnicoCarlos, department_id: null })).toBe(false);
    });
});
