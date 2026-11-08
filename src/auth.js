const Usuario = require('./models/Usuario');

/** Middleware: coloca req.usuarioAtual (ou null) disponível em todas as rotas. */
async function carregarUsuario(req, res, next) {
    if (req.session?.userId) {
        req.usuarioAtual = await Usuario.buscarPorId(req.session.userId);
    } else {
        req.usuarioAtual = null;
    }
    res.locals.usuarioAtual = req.usuarioAtual; // disponível directamente nas views EJS
    next();
}

/** Verifica se o pedido é para API ou AJAX */
function ehPedidoApi(req) {
    return req.originalUrl.startsWith('/api') || req.xhr || req.headers.accept?.includes('application/json');
}

/** Middleware: exige sessão iniciada. */
function exigirAutenticacao(req, res, next) {
    if (!req.usuarioAtual) {
        if (ehPedidoApi(req)) {
            return res.status(401).json({ status: 'error', message: 'Autenticação necessária.' });
        }
        return res.redirect('/login');
    }
    next();
}

/** Middleware factory: exige um dos papéis indicados. */
function exigirPapel(...papeis) {
    return (req, res, next) => {
        if (!req.usuarioAtual) {
            if (ehPedidoApi(req)) {
                return res.status(401).json({ status: 'error', message: 'Autenticação necessária.' });
            }
            return res.redirect('/login');
        }
        if (!papeis.includes(req.usuarioAtual.role)) {
            if (ehPedidoApi(req)) {
                return res.status(403).json({ status: 'error', message: 'Não tens permissão para aceder a este recurso.' });
            }
            return res.status(403).send('Não tens permissão para aceder a esta página.');
        }
        next();
    };
}

async function tentarAutenticar(email, senha) {
    const usuario = await Usuario.buscarPorEmail(email);
    if (!usuario) return null;
    const valido = await Usuario.verificarSenha(usuario, senha);
    return valido ? usuario : null;
}

module.exports = { carregarUsuario, exigirAutenticacao, exigirPapel, tentarAutenticar };
