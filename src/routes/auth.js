const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Usuario = require('../models/Usuario');
const { tentarAutenticar } = require('../auth');
const { verifyCsrfBody } = require('../csrf');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    // Em testes o limite é elevado para não interferir com vários logins;
    // em produção mantém-se o valor seguro por omissão.
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10), // Máximo 10 tentativas por IP em 15 minutos
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        req.flashErrors(['Demasiadas tentativas de autenticação. Por favor, aguarda 15 minutos antes de tentar novamente.']);
        res.redirect('/login');
    },
});

router.get('/login', (req, res) => {
    res.render('auth/login', { title: 'Entrar' });
});

router.post('/login', authLimiter, verifyCsrfBody, async (req, res) => {
    const email = (req.body.email || '').trim();
    const senha = req.body.senha || req.body.password || '';

    if (!email || !senha) {
        req.flashErrors(['Preenche o email e a password.']);
        req.flashOld({ email });
        return res.redirect('/login');
    }

    const usuario = await tentarAutenticar(email, senha);
    if (!usuario) {
        req.flashErrors(['Credenciais inválidas.']);
        req.flashOld({ email });
        return res.redirect('/login');
    }

    req.session.regenerate((err) => {
        if (err) return res.status(500).send('Erro ao iniciar sessão.');
        req.session.userId = usuario.id;
        res.redirect('/dashboard');
    });
});

router.get('/registar', (req, res) => {
    res.render('auth/register', { title: 'Registar' });
});

router.post('/registar', authLimiter, verifyCsrfBody, async (req, res) => {
    const nome = (req.body.nome || req.body.name || '').trim();
    const email = (req.body.email || '').trim();
    const senha = req.body.senha || req.body.password || '';
    const confirmacao_senha = req.body.confirmacao_senha || req.body.password_confirmation || '';
    const erros = [];

    if (!nome.trim()) erros.push('Indica o teu nome.');
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) erros.push('Email inválido.');
    if (await Usuario.emailExiste(email.trim())) erros.push('Já existe uma conta com este email.');
    if (senha.length < 8) erros.push('A password deve ter pelo menos 8 caracteres.');
    if (senha !== confirmacao_senha) erros.push('As passwords não coincidem.');

    if (erros.length) {
        req.flashErrors(erros);
        req.flashOld({ nome, email });
        return res.redirect('/registar');
    }

    const idUsuario = await Usuario.criar({ nome: nome.trim(), email: email.trim(), senha, papel: Usuario.PAPEL_CIDADAO });

    req.session.regenerate((err) => {
        if (err) return res.status(500).send('Erro ao iniciar sessão.');
        req.session.userId = idUsuario;
        res.redirect('/dashboard');
    });
});

router.post('/logout', verifyCsrfBody, (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
