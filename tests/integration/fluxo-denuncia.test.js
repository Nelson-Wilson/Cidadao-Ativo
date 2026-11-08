const db = require('../../src/db');
const Denuncia = require('../../src/models/Denuncia');
const { createApp } = require('../../src/app');
const { reiniciarBaseDeDados, criarDenuncia } = require('../helpers/fixtures');
const {
    novoAgente,
    iniciarSessao,
    obterCsrf,
} = require('../helpers/http');
const { instantaneoUploads, removerUploadsNovos } = require('../helpers/uploads');

const app = createApp();
const FOTO = Buffer.from('fotografia-de-teste', 'utf8');
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let fixture;
let uploadsBase;

beforeEach(async () => {
    fixture = await reiniciarBaseDeDados();
    uploadsBase = await instantaneoUploads();
});

afterEach(async () => {
    await esperar(100);
    await removerUploadsNovos(uploadsBase);
});

async function submeterDenuncia(agent, csrf, overrides = {}) {
    const {
        temFoto = true,
        ...dados
    } = {
        id_categoria: fixture.categorias.Buracos,
        descricao: 'Buraco grande na Avenida Julius Nyerere, com risco para os automóveis.',
        latitude: '-25.9692',
        longitude: '32.5732',
        bairro: 'Polana',
        ...overrides,
    };

    let pedido = agent.post('/denuncias');
    if (csrf) pedido = pedido.field('_csrf', csrf);
    for (const [campo, valor] of Object.entries(dados)) {
        if (valor !== undefined) pedido = pedido.field(campo, String(valor));
    }
    if (temFoto) {
        pedido = pedido.attach('photo', FOTO, { filename: 'denuncia.png', contentType: 'image/png' });
    }
    return pedido;
}

async function contar(tabela, onde = '', parametros = []) {
    const [[linha]] = await db.query(`SELECT COUNT(*) AS total FROM \`${tabela}\` ${onde}`, parametros);
    return Number(linha.total);
}

async function seguirRedireccionamento(agent, resposta) {
    return agent.get(resposta.headers.location).expect(200);
}

describe('Integração M1 -> M2 -> técnico -> M1', () => {
    test('Maria regista, João atribui, Carlos resolve e Maria vê a denúncia fechada', async () => {
        // M1: cidadã autenticada regista denúncia válida.
        const maria = novoAgente(app);
        await iniciarSessao(maria, 'maria@teste.com');
        const csrfMaria = await obterCsrf(maria, '/denuncias/nova');

        const criacao = await submeterDenuncia(maria, csrfMaria);
        expect(criacao.status).toBe(302);
        expect(criacao.headers.location).toBe('/denuncias');

        const [denuncias] = await db.query('SELECT * FROM reports');
        expect(denuncias).toHaveLength(1);
        const denuncia = denuncias[0];

        expect(denuncia.status).toBe('recebida');
        expect(denuncia.user_id).toBe(fixture.utilizadores.maria);
        expect(denuncia.municipality_id).toBe(fixture.municipios.maputo);
        expect(denuncia.department_id).toBe(fixture.departamentos.viasMaputo);
        expect(denuncia.description).toBe('Buraco grande na Avenida Julius Nyerere, com risco para os automóveis.');
        expect(denuncia.neighborhood).toBe('Polana');
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denuncia.id])).toBe(1);

        // M1: a cidadã vê a denúncia na sua área.
        const detalheMaria = await maria.get(`/denuncias/${denuncia.id}`).expect(200);
        expect(detalheMaria.text).toContain('Buraco grande na Avenida Julius Nyerere');

        // M2: o gestor municipal de Maputo vê a denúncia do seu município.
        const joao = novoAgente(app);
        await iniciarSessao(joao, 'joao@teste.com');
        const listaMunicipal = await joao.get('/municipio/denuncias').expect(200);
        expect(listaMunicipal.text).toContain(`#${denuncia.id}`);
        expect(listaMunicipal.text).toContain('Buracos');
        expect(listaMunicipal.text).toContain('Polana');

        const detalheJoao = await joao.get(`/municipio/denuncias/${denuncia.id}`).expect(200);
        expect(detalheJoao.text).toContain('Maria Cidadã');
        const csrfJoao = await obterCsrf(joao, `/municipio/denuncias/${denuncia.id}`);

        // M2: triagem recebida -> em_analise.
        const triagem = await joao
            .post(`/municipio/denuncias/${denuncia.id}/estado`)
            .type('form')
            .send({ _csrf: csrfJoao, status: 'em_analise' })
            .expect(302);
        expect(triagem.headers.location).toBe(`/municipio/denuncias/${denuncia.id}`);

        let [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denuncia.id]);
        expect(atual[0].status).toBe('em_analise');

        // M2: atribuição de Carlos, técnico do mesmo departamento/município.
        await joao
            .post(`/municipio/denuncias/${denuncia.id}/atribuir`)
            .type('form')
            .send({ _csrf: csrfJoao, technician_id: fixture.utilizadores.carlos })
            .expect(302);

        [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denuncia.id]);
        expect(atual[0].status).toBe('atribuida');
        expect(atual[0].technician_id).toBe(fixture.utilizadores.carlos);

        // Técnico: inicia execução.
        const carlos = novoAgente(app);
        await iniciarSessao(carlos, 'carlos@teste.com');
        const tarefas = await carlos.get('/tecnico/tarefas').expect(200);
        expect(tarefas.text).toContain('Buraco grande na Avenida Julius Nyerere');

        const detalheCarlos = await carlos.get(`/tecnico/tarefas/${denuncia.id}`).expect(200);
        const csrfCarlos = await obterCsrf(carlos, `/tecnico/tarefas/${denuncia.id}`);
        expect(detalheCarlos.text).toContain('Iniciar Execução');

        await carlos
            .post(`/tecnico/tarefas/${denuncia.id}/iniciar`)
            .type('form')
            .send({ _csrf: csrfCarlos })
            .expect(302);

        [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denuncia.id]);
        expect(atual[0].status).toBe('em_execucao');

        // Técnico: resolve com fotografia de comprovação.
        await carlos
            .post(`/tecnico/tarefas/${denuncia.id}/resolver`)
            .field('_csrf', csrfCarlos)
            .attach('photo', FOTO, { filename: 'resolucao.png', contentType: 'image/png' })
            .expect(302);

        [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denuncia.id]);
        expect(atual[0].status).toBe('resolvida');
        expect(await contar('report_photo_resolutions', 'WHERE report_id = ?', [denuncia.id])).toBe(1);

        // M2: gestor fecha a denúncia resolvida.
        await joao.get(`/municipio/denuncias/${denuncia.id}`).expect(200);
        const csrfFecho = await obterCsrf(joao, `/municipio/denuncias/${denuncia.id}`);
        await joao
            .post(`/municipio/denuncias/${denuncia.id}/estado`)
            .type('form')
            .send({ _csrf: csrfFecho, status: 'fechada' })
            .expect(302);

        [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denuncia.id]);
        expect(atual[0].status).toBe('fechada');

        // M1: a cidadã vê o estado final e o histórico completo.
        const detalheFinal = await maria.get(`/denuncias/${denuncia.id}`).expect(200);
        expect(detalheFinal.text).toContain('Fechada');
        expect(detalheFinal.text).toContain('Resolvida');
        expect(detalheFinal.text).toContain('Atribuída');
        expect(detalheFinal.text).toContain('Em Análise');
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denuncia.id])).toBe(6);
    });
});

describe('RQ1 — validação do formulário no servidor', () => {
    test('dados inválidos não criam denúncia e devolvem erro claro', async () => {
        const maria = novoAgente(app);
        await iniciarSessao(maria, 'maria@teste.com');
        const csrf = await obterCsrf(maria, '/denuncias/nova');

        const curta = await submeterDenuncia(maria, csrf, { descricao: '123456789' });
        expect(curta.status).toBe(302);
        expect(curta.headers.location).toBe('/denuncias/nova');
        const paginaCurta = await seguirRedireccionamento(maria, curta);
        expect(paginaCurta.text).toContain('A descrição deve ter pelo menos 10 caracteres.');

        const semFoto = await submeterDenuncia(maria, csrf, { temFoto: false });
        expect(semFoto.status).toBe(302);
        expect(semFoto.headers.location).toBe('/denuncias/nova');
        const paginaSemFoto = await seguirRedireccionamento(maria, semFoto);
        expect(paginaSemFoto.text).toContain('Anexa uma fotografia do problema.');

        const categoriaInexistente = await submeterDenuncia(maria, csrf, { id_categoria: 999999 });
        expect(categoriaInexistente.status).toBe(302);
        const paginaCategoria = await seguirRedireccionamento(maria, categoriaInexistente);
        expect(paginaCategoria.text).toContain('Escolhe uma categoria válida.');

        const gpsFora = await submeterDenuncia(maria, csrf, { latitude: '91', longitude: '32.5732' });
        expect(gpsFora.status).toBe(302);
        const paginaGps = await seguirRedireccionamento(maria, gpsFora);
        expect(paginaGps.text).toContain('As coordenadas GPS estão fora dos limites válidos.');

        expect(await contar('reports')).toBe(0);

        // Nenhum upload inválido fica órfão no disco.
        await esperar(200);
        const atuais = await instantaneoUploads();
        expect([...atuais].filter((ficheiro) => !uploadsBase.has(ficheiro))).toEqual([]);
    });

    test('pedido sem token CSRF é rejeitado com 419 e não cria denúncia', async () => {
        const maria = novoAgente(app);
        await iniciarSessao(maria, 'maria@teste.com');

        const resposta = await submeterDenuncia(maria, null);
        expect(resposta.status).toBe(419);
        expect(await contar('reports')).toBe(0);

        await esperar(200);
        const atuais = await instantaneoUploads();
        expect([...atuais].filter((ficheiro) => !uploadsBase.has(ficheiro))).toEqual([]);
    });
});

describe('RQ2/RQ3 — isolamento entre municípios e papéis', () => {
    test('Ana (Matola) não acede nem altera denúncia de Maputo', async () => {
        const denunciaMaputo = await criarDenuncia({
            userId: fixture.utilizadores.maria,
            categoryId: fixture.categorias.Buracos,
            status: 'em_analise',
            municipalityId: fixture.municipios.maputo,
            departmentId: fixture.departamentos.viasMaputo,
            description: 'Denúncia privada do município de Maputo.',
            bairro: 'Bairro Maputo',
        });
        const denunciaMatola = await criarDenuncia({
            userId: fixture.utilizadores.maria,
            categoryId: fixture.categorias.Buracos,
            status: 'em_analise',
            municipalityId: fixture.municipios.matola,
            departmentId: fixture.departamentos.viasMatola,
            description: 'Denúncia visível apenas para a Matola.',
            bairro: 'Bairro Matola',
        });

        const ana = novoAgente(app);
        await iniciarSessao(ana, 'ana@teste.com');

        const lista = await ana.get('/municipio/denuncias').expect(200);
        expect(lista.text).toContain('Bairro Matola');
        expect(lista.text).not.toContain('Bairro Maputo');

        await ana.get(`/municipio/denuncias/${denunciaMaputo}`).expect(403);

        const detalheMatola = await ana.get(`/municipio/denuncias/${denunciaMatola}`).expect(200);
        expect(detalheMatola.text).toContain('Denúncia visível apenas para a Matola.');
        expect(detalheMatola.text).toContain('Bairro Matola');
        const csrfAna = await obterCsrf(ana, `/municipio/denuncias/${denunciaMatola}`);

        await ana
            .post(`/municipio/denuncias/${denunciaMaputo}/estado`)
            .type('form')
            .send({ _csrf: csrfAna, status: 'atribuida' })
            .expect(403);

        await ana
            .post(`/municipio/denuncias/${denunciaMaputo}/atribuir`)
            .type('form')
            .send({ _csrf: csrfAna, technician_id: fixture.utilizadores.carlos })
            .expect(403);

        const [[maputo]] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaMaputo]);
        expect(maputo.status).toBe('em_analise');
        expect(maputo.technician_id).toBeNull();
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denunciaMaputo])).toBe(1);
    });

    test('cidadão, técnico não atribuído e gestor não acedem a recursos alheios', async () => {
        const denunciaMaputo = await criarDenuncia({
            userId: fixture.utilizadores.maria,
            categoryId: fixture.categorias.Buracos,
            status: 'atribuida',
            municipalityId: fixture.municipios.maputo,
            departmentId: fixture.departamentos.viasMaputo,
            technicianId: fixture.utilizadores.carlos,
            description: 'Denúncia atribuída ao Carlos.',
        });

        const rita = novoAgente(app);
        await iniciarSessao(rita, 'rita@teste.com');
        await rita.get(`/denuncias/${denunciaMaputo}`).expect(403);

        const maria = novoAgente(app);
        await iniciarSessao(maria, 'maria@teste.com');
        await maria.get(`/municipio/denuncias/${denunciaMaputo}`).expect(403);

        const pedro = novoAgente(app);
        await iniciarSessao(pedro, 'pedro@teste.com');
        await pedro.get(`/tecnico/tarefas/${denunciaMaputo}`).expect(403);

        const carlos = novoAgente(app);
        await iniciarSessao(carlos, 'carlos@teste.com');
        const tarefaCarlos = await carlos.get(`/tecnico/tarefas/${denunciaMaputo}`).expect(200);
        expect(tarefaCarlos.text).toContain('Denúncia atribuída ao Carlos.');
    });
});

describe('RQ2 — regras de atribuição de técnico', () => {
    test('rejeita cidadão, técnico de outro município e técnico inexistente; aceita técnico válido', async () => {
        const denunciaId = await criarDenuncia({
            userId: fixture.utilizadores.maria,
            categoryId: fixture.categorias.Buracos,
            status: 'em_analise',
            municipalityId: fixture.municipios.maputo,
            departmentId: fixture.departamentos.viasMaputo,
        });

        const joao = novoAgente(app);
        await iniciarSessao(joao, 'joao@teste.com');
        await joao.get(`/municipio/denuncias/${denunciaId}`).expect(200);
        const csrf = await obterCsrf(joao, `/municipio/denuncias/${denunciaId}`);

        const tentarAtribuir = async (technicianId) => {
            const resposta = await joao
                .post(`/municipio/denuncias/${denunciaId}/atribuir`)
                .type('form')
                .send({ _csrf: csrf, technician_id: technicianId })
                .expect(302);
            return seguirRedireccionamento(joao, resposta);
        };

        const paginaCidadao = await tentarAtribuir(fixture.utilizadores.maria);
        expect(paginaCidadao.text).toContain('Escolhe um técnico válido');

        const paginaOutroMunicipio = await tentarAtribuir(fixture.utilizadores.pedro);
        expect(paginaOutroMunicipio.text).toContain('Escolhe um técnico válido');

        const paginaInexistente = await tentarAtribuir(999999);
        expect(paginaInexistente.text).toContain('Escolhe um técnico válido');

        let [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(atual[0].status).toBe('em_analise');
        expect(atual[0].technician_id).toBeNull();
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denunciaId])).toBe(1);

        const paginaSucesso = await tentarAtribuir(fixture.utilizadores.carlos);
        expect(paginaSucesso.text).toContain('Técnico atribuído com sucesso.');

        [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(atual[0].status).toBe('atribuida');
        expect(atual[0].technician_id).toBe(fixture.utilizadores.carlos);
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denunciaId])).toBe(2);

        // Reatribuir uma denúncia já atribuída é rejeitado sem novo histórico.
        const paginaRepetida = await tentarAtribuir(fixture.utilizadores.carlos);
        expect(paginaRepetida.text).toContain('Só é possível atribuir denúncias que estejam em análise.');
        [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(atual[0].status).toBe('atribuida');
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denunciaId])).toBe(2);
    });
});

describe('RQ3 — transições de estado', () => {
    test('rejeita transições inválidas e CSRF em falta; aceita apenas a sequência válida', async () => {
        const denunciaId = await criarDenuncia({
            userId: fixture.utilizadores.maria,
            categoryId: fixture.categorias.Buracos,
            status: 'recebida',
            municipalityId: fixture.municipios.maputo,
            departmentId: fixture.departamentos.viasMaputo,
        });

        const joao = novoAgente(app);
        await iniciarSessao(joao, 'joao@teste.com');
        await joao.get(`/municipio/denuncias/${denunciaId}`).expect(200);
        const csrf = await obterCsrf(joao, `/municipio/denuncias/${denunciaId}`);

        const tentarEstado = async (status) => {
            const resposta = await joao
                .post(`/municipio/denuncias/${denunciaId}/estado`)
                .type('form')
                .send({ _csrf: csrf, status })
                .expect(302);
            return seguirRedireccionamento(joao, resposta);
        };

        const paginaInvalida = await tentarEstado('fechada');
        expect(paginaInvalida.text).toContain('Transição inválida de [recebida] para [fechada].');

        const respostaEstadoInexistente = await joao
            .post(`/municipio/denuncias/${denunciaId}/estado`)
            .type('form')
            .send({ _csrf: csrf, status: 'inventado' })
            .expect(422);
        expect(respostaEstadoInexistente.text).toContain('Estado inválido.');

        let [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(atual[0].status).toBe('recebida');
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denunciaId])).toBe(1);

        const paginaValida = await tentarEstado('em_analise');
        expect(paginaValida.text).toContain('Estado da denúncia actualizado.');

        [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(atual[0].status).toBe('em_analise');
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denunciaId])).toBe(2);

        const paginaRepetida = await tentarEstado('em_analise');
        expect(paginaRepetida.text).toContain('Transição inválida de [em_analise] para [em_analise].');

        const paginaRejeitada = await tentarEstado('rejeitada');
        expect(paginaRejeitada.text).toContain('Estado da denúncia actualizado.');

        [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(atual[0].status).toBe('rejeitada');
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denunciaId])).toBe(3);

        const paginaFinal = await tentarEstado('fechada');
        expect(paginaFinal.text).toContain('Transição inválida de [rejeitada] para [fechada].');

        // Sem CSRF: 419 e nenhuma alteração.
        await joao
            .post(`/municipio/denuncias/${denunciaId}/estado`)
            .type('form')
            .send({ status: 'fechada' })
            .expect(419);
        [atual] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(atual[0].status).toBe('rejeitada');
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denunciaId])).toBe(3);
    });

    test('duas transições concorrentes: apenas uma vence e o histórico não duplica', async () => {
        const denunciaId = await criarDenuncia({
            userId: fixture.utilizadores.maria,
            categoryId: fixture.categorias.Buracos,
            status: 'recebida',
            municipalityId: fixture.municipios.maputo,
            departmentId: fixture.departamentos.viasMaputo,
        });

        const resultados = await Promise.allSettled([
            Denuncia.mudarStatus(denunciaId, Denuncia.STATUS_EM_ANALISE, fixture.utilizadores.joao),
            Denuncia.mudarStatus(denunciaId, Denuncia.STATUS_EM_ANALISE, fixture.utilizadores.joao),
        ]);

        const estados = resultados.map((resultado) => resultado.status).sort();
        expect(estados).toEqual(['fulfilled', 'rejected']);

        const [[atual]] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(atual.status).toBe('em_analise');
        expect(await contar('report_status_histories', 'WHERE report_id = ?', [denunciaId])).toBe(2);
    });
});

describe('RQ3 — resolução atómica e limpeza de fotografia', () => {
    test('resolver num estado inválido não cria foto de resolução nem altera o estado', async () => {
        const denunciaId = await criarDenuncia({
            userId: fixture.utilizadores.maria,
            categoryId: fixture.categorias.Buracos,
            status: 'atribuida',
            municipalityId: fixture.municipios.maputo,
            departmentId: fixture.departamentos.viasMaputo,
            technicianId: fixture.utilizadores.carlos,
        });

        await expect(
            Denuncia.resolver(denunciaId, 'uploads/resolutions/inexistente.png', fixture.utilizadores.carlos)
        ).rejects.toThrow('Só é possível resolver denúncias que estejam em execução.');

        const [[atual]] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(atual.status).toBe('atribuida');
        expect(await contar('report_photo_resolutions', 'WHERE report_id = ?', [denunciaId])).toBe(0);

        const carlos = novoAgente(app);
        await iniciarSessao(carlos, 'carlos@teste.com');
        await carlos.get(`/tecnico/tarefas/${denunciaId}`).expect(200);
        const csrf = await obterCsrf(carlos, `/tecnico/tarefas/${denunciaId}`);

        const resposta = await carlos
            .post(`/tecnico/tarefas/${denunciaId}/resolver`)
            .field('_csrf', csrf)
            .attach('photo', FOTO, { filename: 'resolucao.png', contentType: 'image/png' })
            .expect(302);

        const pagina = await seguirRedireccionamento(carlos, resposta);
        expect(pagina.text).toContain('Só é possível resolver denúncias que estejam em execução.');

        const [[depois]] = await db.query('SELECT * FROM reports WHERE id = ?', [denunciaId]);
        expect(depois.status).toBe('atribuida');
        expect(await contar('report_photo_resolutions', 'WHERE report_id = ?', [denunciaId])).toBe(0);

        await esperar(200);
        const atuais = await instantaneoUploads();
        expect([...atuais].filter((ficheiro) => !uploadsBase.has(ficheiro))).toEqual([]);
    });
});
