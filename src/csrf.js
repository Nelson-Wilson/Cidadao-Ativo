const crypto = require('crypto');
const fsPromises = require('fs/promises');

function csrfMiddleware(req, res, next) {
    if (req.session && !req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session?.csrfToken || '';
    next();
}

/** Compara dois tokens em tempo constante para mitigar timing attacks. */
function tokensIguais(tokenA, tokenB) {
    if (typeof tokenA !== 'string' || typeof tokenB !== 'string') {
        return false;
    }
    const bufA = Buffer.from(tokenA);
    const bufB = Buffer.from(tokenB);
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

/** Para formulários HTML normais — lê de req.body._csrf. */
function verifyCsrfBody(req, res, next) {
    const tokenSessao = req.session?.csrfToken;
    const tokenRecebido = req.body?._csrf;

    if (!tokenSessao || !tokensIguais(tokenRecebido, tokenSessao)) {
        // O multer já pode ter escrito o ficheiro antes desta verificação.
        // Não deixar uploads órfãos quando o pedido é rejeitado por CSRF.
        if (req.file?.path) {
            fsPromises.unlink(req.file.path).catch(() => {});
        }
        return res.status(419).send('Sessão expirada ou token CSRF inválido. Volta atrás e tenta novamente.');
    }
    next();
}

/** Para chamadas fetch/AJAX (JSON ou multipart) — lê do cabeçalho X-CSRF-Token. */
function verifyCsrfHeader(req, res, next) {
    const tokenSessao = req.session?.csrfToken;
    const tokenRecebido = req.headers['x-csrf-token'];

    if (!tokenSessao || !tokensIguais(tokenRecebido, tokenSessao)) {
        return res.status(419).json({ status: 'error', message: 'Sessão expirada ou token CSRF inválido. Recarrega a página.' });
    }
    next();
}

module.exports = { csrfMiddleware, verifyCsrfBody, verifyCsrfHeader };
