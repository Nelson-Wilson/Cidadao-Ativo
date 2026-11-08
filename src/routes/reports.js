const express = require('express');
const router = express.Router();

const Categoria = require('../models/Categoria');
const Denuncia = require('../models/Denuncia');
const Usuario = require('../models/Usuario');
const { exigirPapel, exigirAutenticacao } = require('../auth');
const { verifyCsrfBody } = require('../csrf');
const { makeUploader, guardarFoto, eliminarFicheiro } = require('../upload');
const servicoEncaminhamento = require('../services/servicoEncaminhamentoDenuncia');
const servicoClassificacao = require('../services/ai/servicoClassificacao');
const servicoPrioridade = require('../services/ai/servicoPrioridade');
const servicoAnaliseFoto = require('../services/ai/servicoAnaliseFoto');
const { validarDenuncia } = require('../validation/denuncia');
const { podeAcederDenuncia } = require('../authorization');

const uploadFotoDenuncia = makeUploader('reports');

router.get('/denuncias', exigirPapel(Usuario.PAPEL_CIDADAO), async (req, res) => {
    const pagina = Math.max(1, parseInt(req.query.page) || 1);
    const paginacao = await Denuncia.paginarPorUsuario(req.usuarioAtual.id, pagina);
    res.render('reports/index', { title: 'As minhas denúncias', ...paginacao });
});

router.get('/denuncias/nova', exigirPapel(Usuario.PAPEL_CIDADAO), async (req, res) => {
    const categorias = await Categoria.todas();
    res.render('reports/create', { title: 'Nova denúncia', categories: categorias });
});

router.post('/denuncias', exigirPapel(Usuario.PAPEL_CIDADAO), (req, res, next) => {
    uploadFotoDenuncia.single('photo')(req, res, (err) => {
        if (err) {
            req.flashErrors(['Falha ao enviar a fotografia. Verifica o formato (jpg/png/webp) e o tamanho (máx. 5MB).']);
            return res.redirect('/denuncias/nova');
        }
        next();
    });
}, verifyCsrfBody, async (req, res) => {
    const { id_categoria, descricao = '', latitude, longitude, bairro } = req.body;
    const { erros, valores } = validarDenuncia({
        id_categoria,
        descricao,
        latitude,
        longitude,
        bairro,
        temFoto: Boolean(req.file),
    });

    let categoria = null;
    if (valores.id_categoria) {
        categoria = await Categoria.buscarPorId(valores.id_categoria);
        if (!categoria) erros.push('Escolhe uma categoria válida.');
    }

    if (erros.length) {
        await eliminarFicheiro(req.file?.path);
        req.flashErrors(erros);
        req.flashOld({ id_categoria, descricao, bairro, latitude, longitude });
        return res.redirect('/denuncias/nova');
    }

    const encaminhamento = await servicoEncaminhamento.encaminhar(categoria.id);

    let caminhoFoto;
    try {
        caminhoFoto = await guardarFoto('reports', req.file);
    } catch (erroUpload) {
        console.error('[Upload] Falha ao guardar a fotografia:', erroUpload.message);
        req.flashErrors(['Não foi possível guardar a fotografia. Tenta novamente.']);
        req.flashOld({ id_categoria, descricao, bairro, latitude, longitude });
        return res.redirect('/denuncias/nova');
    }

    let idDenuncia;
    try {
        idDenuncia = await Denuncia.criar({
            id_usuario: req.usuarioAtual.id,
            id_categoria: categoria.id,
            descricao: valores.descricao,
            caminho_foto: caminhoFoto,
            latitude: valores.latitude,
            longitude: valores.longitude,
            bairro: valores.bairro,
            status: Denuncia.STATUS_RECEBIDA,
            id_municipio: encaminhamento.id_municipio,
            id_departamento: encaminhamento.id_departamento,
        });
    } catch (erroCriacao) {
        // Não deixar uma fotografia órfã se a denúncia não foi gravada.
        await eliminarFicheiro(caminhoFoto);
        throw erroCriacao;
    }

    req.flashStatus('Denúncia registada com sucesso. Vai ser encaminhada para a equipa responsável.');
    res.redirect('/denuncias');

    // Desacoplamento assíncrono: corre enriquecimento por IA em segundo plano.
    // Se todas as funcionalidades estiverem desactivadas (ex.: testes), evita
    // trabalho e consultas desnecessárias depois da resposta.
    const iaAtiva = servicoClassificacao.estaAtivo()
        || servicoAnaliseFoto.estaAtivo()
        || servicoPrioridade.estaAtivo();

    if (iaAtiva) {
        setImmediate(async () => {
            try {
                const classificacaoTexto = await servicoClassificacao.classificar(valores.descricao);
                let gravidade = classificacaoTexto.gravidade;

                const analiseFoto = await servicoAnaliseFoto.analisar(caminhoFoto, valores.descricao);
                if (analiseFoto && analiseFoto.gravidade === 'alta') gravidade = 'alta';

                const novaDenuncia = await Denuncia.buscarPorId(idDenuncia);
                if (novaDenuncia) {
                    const prioridade = await servicoPrioridade.calcular(novaDenuncia, gravidade);
                    await Denuncia.atualizarPrioridade(idDenuncia, prioridade);
                }
            } catch (erroSegundoPlano) {
                console.error(`[IA Assíncrona] Erro no processamento da denúncia #${idDenuncia}:`, erroSegundoPlano.message);
            }
        });
    }
});

router.get('/denuncias/:id', exigirAutenticacao, async (req, res) => {
    const denuncia = await Denuncia.buscarComRelacoes(Number(req.params.id));
    if (!denuncia) return res.status(404).send('Denúncia não encontrada.');

    if (!podeAcederDenuncia(req.usuarioAtual, denuncia)) {
        return res.status(403).send('Não tens acesso a esta denúncia.');
    }

    const historico = await Denuncia.historicoStatus(denuncia.id);
    res.render('reports/show', { title: `Denúncia #${denuncia.id}`, report: denuncia, history: historico });
});

module.exports = router;
