const request = require('supertest');

function extrairCsrf(html) {
    const match = String(html).match(/name="_csrf"\s+value="([^"]+)"/);
    if (!match) {
        throw new Error('Token CSRF não encontrado na página.');
    }
    return match[1];
}

async function obterCsrf(agent, caminho) {
    const resposta = await agent.get(caminho).expect(200);
    return extrairCsrf(resposta.text);
}

/**
 * Autentica um agente Supertest através do formulário real, mantendo cookies
 * e sessão. Isto testa também o contrato de login, não só as rotas de negócio.
 */
async function iniciarSessao(agent, email, senha = 'password') {
    const csrf = await obterCsrf(agent, '/login');
    await agent
        .post('/login')
        .type('form')
        .send({ _csrf: csrf, email, senha })
        .expect(302)
        .expect('Location', '/dashboard');
    return agent;
}

function novoAgente(app) {
    return request.agent(app);
}

module.exports = { extrairCsrf, obterCsrf, iniciarSessao, novoAgente };
