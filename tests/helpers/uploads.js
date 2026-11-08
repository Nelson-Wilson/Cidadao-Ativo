const fs = require('fs/promises');
const path = require('path');

const DIRETORIOS = [
    path.join(__dirname, '..', '..', 'public', 'uploads', 'reports'),
    path.join(__dirname, '..', '..', 'public', 'uploads', 'resolutions'),
];

async function listarFicheiros() {
    const ficheiros = new Set();
    for (const diretorio of DIRETORIOS) {
        try {
            const entradas = await fs.readdir(diretorio);
            for (const entrada of entradas) {
                ficheiros.add(path.join(diretorio, entrada));
            }
        } catch {
            // O diretório pode ainda não existir.
        }
    }
    return ficheiros;
}

async function instantaneoUploads() {
    return listarFicheiros();
}

/** Remove apenas os ficheiros criados durante o teste, preservando os do utilizador. */
async function removerUploadsNovos(instantaneo) {
    const atuais = await listarFicheiros();
    for (const ficheiro of atuais) {
        if (!instantaneo.has(ficheiro)) {
            await fs.unlink(ficheiro).catch(() => {});
        }
    }
}

module.exports = { instantaneoUploads, removerUploadsNovos };
