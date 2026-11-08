const Departamento = require('../models/Departamento');
const Municipio = require('../models/Municipio');

/** Encaminha uma denúncia para o município e departamento responsável. */
async function encaminhar(idCategoria) {
    const departamento = await Departamento.buscarPorCategoriaId(idCategoria);

    if (departamento) {
        return { id_municipio: departamento.municipality_id, id_departamento: departamento.id };
    }

    const municipio = await Municipio.primeiro();
    return { id_municipio: municipio ? municipio.id : null, id_departamento: null };
}

module.exports = { encaminhar };
