const express = require('express');
const router = express.Router();
const Categoria = require('../models/Categoria');
const Usuario = require('../models/Usuario');
const { exigirAutenticacao } = require('../auth');

router.get('/', async (req, res) => {
    const categorias = await Categoria.todas();
    res.render('map/index', { title: 'Mapa de ocorrências', categories: categorias });
});

router.get('/dashboard', exigirAutenticacao, (req, res) => {
    const papel = req.usuarioAtual.role;
    if (papel === Usuario.PAPEL_MUNICIPIO || papel === Usuario.PAPEL_ADMIN) return res.redirect('/municipio/dashboard');
    if (papel === Usuario.PAPEL_TECNICO) return res.redirect('/tecnico/tarefas');
    return res.redirect('/denuncias');
});

module.exports = router;
