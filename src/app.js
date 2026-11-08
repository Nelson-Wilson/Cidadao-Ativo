// Deve ser carregado antes das rotas: no Express 4, sem este patch os erros
// lançados em handlers async não chegam ao middleware de erro.
require('express-async-errors');

const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const config = require('./config');
const pool = require('./db');
const { carregarUsuario } = require('./auth');
const flashMiddleware = require('./flash');
const { csrfMiddleware } = require('./csrf');
const { exposeToViews } = require('./viewHelpers');

const origemSupabase = (() => {
    if (!config.storage.supabaseUrl) return null;
    try {
        return new URL(config.storage.supabaseUrl).origin;
    } catch {
        return null;
    }
})();

/**
 * Constrói a aplicação Express sem a colocar à escuta.
 *
 * Isto permite que os testes de integração usem o Supertest sobre a mesma app
 * que corre em produção, sem abrir uma porta nem partilhar o store de sessões
 * MySQL (em NODE_ENV=test usamos MemoryStore).
 *
 * @param {{ sessionStore?: import('express-session').Store }} [opcoes]
 * @returns {import('express').Express}
 */
function createApp({ sessionStore } = {}) {
    const app = express();

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '..', 'views'));
    app.disable('x-powered-by');

    // Atrás de um proxy reverso (Render, Railway, Fly, Nginx), confiar no
    // primeiro salto permite obter o IP real e marcar cookies como seguros.
    app.set('trust proxy', config.trustProxy);

    // Cabeçalhos de segurança. A CSP bloqueia scripts inline; todo o
    // JavaScript da aplicação vive em ficheiros próprios em /public/js.
    app.use(helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'", 'data:'],
                imgSrc: [
                    "'self'",
                    'data:',
                    'blob:',
                    'https://*.tile.openstreetmap.org',
                    'https://tile.openstreetmap.org',
                    'https://server.arcgisonline.com',
                    'https://*.basemaps.cartocdn.com',
                    ...(origemSupabase ? [origemSupabase] : []),
                ],
                connectSrc: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: config.isProduction ? [] : null,
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));

    // Compressão Gzip/Brotli para reduzir latência e consumo de dados móveis
    app.use(compression());

    // Parse de corpos de requisição
    app.use(express.urlencoded({ extended: true, limit: '2mb' }));
    app.use(express.json({ limit: '2mb' }));

    // Ficheiros estáticos com cabeçalhos de segurança básicos
    app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads'), {
        maxAge: '1d',
        setHeaders: (res) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
        },
    }));

    // Bibliotecas de terceiros servidas localmente (sem CDN em runtime).
    app.use('/vendor', express.static(path.join(__dirname, '..', 'public', 'vendor'), {
        maxAge: config.isProduction ? '30d' : 0,
        immutable: config.isProduction,
    }));

    app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProduction ? '1d' : 0 }));

    const store = sessionStore || (config.env === 'test'
        ? new session.MemoryStore()
        : new MySQLStore({
            clearExpired: true,
            checkExpirationInterval: 900000, // 15 minutos
            expiration: 1000 * 60 * 60 * 24 * 7, // 7 dias
            createDatabaseTable: true,
            schema: { tableName: 'user_sessions' },
        }, pool));

    app.use(session({
        key: 'cidadao_ativo_sid',
        secret: config.sessionSecret,
        store,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: config.isProduction,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
        },
    }));

    app.use(carregarUsuario);
    app.use(flashMiddleware);
    app.use(csrfMiddleware);
    app.use(exposeToViews);

    // Endpoint de verificação de integridade operacional (Healthcheck)
    app.get('/health', async (req, res) => {
        try {
            await pool.query('SELECT 1');
            res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
        } catch (err) {
            res.status(503).json({ status: 'error', message: 'Falha na ligação à base de dados.' });
        }
    });

    // --- Rotas da Aplicação ---
    app.use(require('./routes/map'));
    app.use(require('./routes/auth'));
    app.use(require('./routes/reports'));
    app.use(require('./routes/municipio'));
    app.use(require('./routes/tecnico'));
    app.use(require('./routes/api'));

    // --- Rota 404 (Página não encontrada) ---
    app.use((req, res) => {
        res.status(404).render('404', { title: 'Página não encontrada', layout: false });
    });

    // --- Middleware Global de Tratamento de Erros (Express 4) ---
    app.use((err, req, res, next) => {
        const status = Number(err.status || err.statusCode) || 500;
        const erroDoCliente = status >= 400 && status < 500;

        if (erroDoCliente) {
            console.warn(`[PEDIDO INVÁLIDO] ${req.method} ${req.url}: ${err.message}`);
        } else {
            console.error(`[ERRO NÃO TRATADO] ${req.method} ${req.url}:`, err);
        }

        if (res.headersSent) {
            return next(err);
        }

        const mensagem = erroDoCliente
            ? 'O pedido é inválido ou está incompleto.'
            : 'Ocorreu um erro interno no servidor.';

        if (req.originalUrl.startsWith('/api') || req.xhr) {
            return res.status(status).json({ status: 'error', message: mensagem });
        }

        if (erroDoCliente) {
            return res.status(status).send(mensagem);
        }
        res.status(500).send('Ocorreu um erro ao processar o teu pedido. Por favor, tenta novamente mais tarde.');
    });

    return app;
}

module.exports = { createApp };
