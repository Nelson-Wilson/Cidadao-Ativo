const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const fsPromises = require('fs/promises');

const config = require('./config');

const ALLOWED_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');

/**
 * Upload e armazenamento de fotografias.
 *
 * Em desenvolvimento usa disco local (`public/uploads`). Em produção usa o
 * Supabase Storage, porque o disco do Render free é efémero. As funções
 * públicas aceitam tanto um caminho relativo local como o URL público do
 * Supabase, para que a migração não obrigue a mudar os controladores.
 */
function usaSupabase() {
    return config.storage.driver === 'supabase';
}

function nomeFicheiro(mimetype) {
    const extensao = ALLOWED_MIME[mimetype] || '.jpg';
    return crypto.randomBytes(16).toString('hex') + extensao;
}

function passarFiltro(req, file, cb) {
    cb(null, Object.prototype.hasOwnProperty.call(ALLOWED_MIME, file.mimetype));
}

function diretorioDe(subdir) {
    const destino = path.join(UPLOADS_DIR, subdir);
    if (!fs.existsSync(destino)) {
        fs.mkdirSync(destino, { recursive: true });
    }
    return destino;
}

function makeUploader(subdir) {
    if (usaSupabase()) {
        return multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: MAX_BYTES, files: 1 },
            fileFilter: passarFiltro,
        });
    }

    return multer({
        storage: multer.diskStorage({
            destination: diretorioDe(subdir),
            filename: (req, file, cb) => cb(null, nomeFicheiro(file.mimetype)),
        }),
        limits: { fileSize: MAX_BYTES, files: 1 },
        fileFilter: passarFiltro,
    });
}

/** Caminho relativo gravado na base de dados quando o driver é local. */
function relativePath(subdir, file) {
    return `uploads/${subdir}/${file.filename}`;
}

/** Resolve um caminho local e garante que fica dentro de public/uploads. */
function caminhoAbsolutoLocal(caminho) {
    const base = path.resolve(UPLOADS_DIR);
    const resolvido = path.resolve(
        path.isAbsolute(caminho) ? caminho : path.join(__dirname, '..', 'public', caminho)
    );

    if (resolvido !== base && !resolvido.startsWith(base + path.sep)) {
        return null;
    }
    return resolvido;
}

function urlPublicaSupabase(objeto) {
    return `${config.storage.supabaseUrl}/storage/v1/object/public/${config.storage.bucket}/${objeto}`;
}

function urlObjetoSupabase(objeto) {
    return `${config.storage.supabaseUrl}/storage/v1/object/${config.storage.bucket}/${objeto}`;
}

/** Extrai o nome do objeto a partir do URL público, rejeitando domínios alheios. */
function objetoAPartirDeUrl(caminho) {
    if (!config.storage.supabaseUrl) return null;

    const prefixo = `${config.storage.supabaseUrl}/storage/v1/object/public/${config.storage.bucket}/`;
    if (!caminho.startsWith(prefixo)) return null;

    const objeto = caminho.slice(prefixo.length);
    if (!objeto || objeto.includes('..') || objeto.startsWith('/')) return null;
    return objeto;
}

async function enviarParaSupabase(objeto, file) {
    const resposta = await fetch(urlObjetoSupabase(objeto), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.storage.supabaseKey}`,
            apikey: config.storage.supabaseKey,
            'Content-Type': file.mimetype,
            'x-upsert': 'false',
            'cache-control': 'max-age=31536000',
        },
        body: file.buffer,
        signal: AbortSignal.timeout(15000),
    });

    if (!resposta.ok) {
        const detalhe = await resposta.text().catch(() => '');
        throw new Error(`Supabase Storage ${resposta.status}: ${detalhe.slice(0, 200)}`);
    }
}

/**
 * Guarda a fotografia e devolve o valor a gravar em `photo_path`:
 * caminho relativo no driver local ou URL público no Supabase.
 */
async function guardarFoto(subdir, file) {
    if (!file) return null;

    if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIME, file.mimetype)) {
        throw new Error('Formato de imagem não suportado.');
    }

    if (!usaSupabase()) {
        return relativePath(subdir, file);
    }

    const objeto = `${subdir}/${nomeFicheiro(file.mimetype)}`;
    await enviarParaSupabase(objeto, file);
    return urlPublicaSupabase(objeto);
}

/** Lê uma fotografia local ou remota (apenas do bucket configurado). */
async function lerFicheiro(caminho) {
    if (!caminho) return null;

    if (/^https?:\/\//i.test(caminho)) {
        if (!objetoAPartirDeUrl(caminho)) return null;
        try {
            const resposta = await fetch(caminho, { signal: AbortSignal.timeout(10000) });
            if (!resposta.ok) return null;

            const tamanho = Number(resposta.headers.get('content-length') || 0);
            if (tamanho > MAX_BYTES) return null;

            const buffer = Buffer.from(await resposta.arrayBuffer());
            return buffer.length <= MAX_BYTES ? buffer : null;
        } catch {
            return null;
        }
    }

    const absoluto = caminhoAbsolutoLocal(caminho);
    if (!absoluto) return null;

    try {
        return await fsPromises.readFile(absoluto);
    } catch {
        return null;
    }
}

/** Remove uma fotografia local ou do Supabase sem lançar erros. */
async function eliminarFicheiro(caminho) {
    if (!caminho) return;

    if (/^https?:\/\//i.test(caminho)) {
        const objeto = objetoAPartirDeUrl(caminho);
        if (!objeto || !config.storage.supabaseKey) return;

        try {
            await fetch(urlObjetoSupabase(objeto), {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${config.storage.supabaseKey}`,
                    apikey: config.storage.supabaseKey,
                },
                signal: AbortSignal.timeout(10000),
            });
        } catch {
            // Objeto órfão é preferível a falhar o pedido do utilizador.
        }
        return;
    }

    const absoluto = caminhoAbsolutoLocal(caminho);
    if (!absoluto) return;

    await fsPromises.unlink(absoluto).catch(() => {});
}

/** Converte o valor guardado na BD em URL absoluta para as views. */
function urlPublica(caminho) {
    if (!caminho) return null;
    if (/^https?:\/\//i.test(caminho)) return caminho;
    return `${config.appUrl}/${String(caminho).replace(/^\//, '')}`;
}

/** MIME a partir da extensão, ignorando query string/hash. */
function mimePorCaminho(caminho) {
    const semQuery = String(caminho || '').split(/[?#]/)[0];
    const extensao = path.extname(semQuery).toLowerCase();
    if (extensao === '.jpg' || extensao === '.jpeg') return 'image/jpeg';
    if (extensao === '.png') return 'image/png';
    if (extensao === '.webp') return 'image/webp';
    return null;
}

module.exports = {
    ALLOWED_MIME,
    MAX_BYTES,
    makeUploader,
    guardarFoto,
    relativePath,
    eliminarFicheiro,
    lerFicheiro,
    urlPublica,
    mimePorCaminho,
};
