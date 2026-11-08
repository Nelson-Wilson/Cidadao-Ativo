/**
 * Mensagens "flash" (só duram um pedido) e valores "old" (para repopular
 * formulários depois de um erro de validação) — tudo guardado na sessão.
 */
function flashMiddleware(req, res, next) {
    res.locals.status = req.session.flashStatus || null;
    res.locals.errors = req.session.flashErrors || [];
    res.locals.old = req.session.flashOld || {};

    delete req.session.flashStatus;
    delete req.session.flashErrors;
    delete req.session.flashOld;

    req.flashStatus = (message) => { req.session.flashStatus = message; };
    req.flashErrors = (errors) => { req.session.flashErrors = errors; };
    req.flashOld = (data) => { req.session.flashOld = data; };

    next();
}

module.exports = flashMiddleware;
