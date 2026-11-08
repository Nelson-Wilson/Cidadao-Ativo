const { criarBaseDeDadosTeste } = require('./createTestDatabase');

module.exports = async () => {
    await criarBaseDeDadosTeste();
};
