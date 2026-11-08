/**
 * Configuração dos testes de integração: app Express + MySQL real de teste.
 * A base `cidadao_ativo_test` é recriada pelo globalSetup.
 */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
    setupFiles: ['<rootDir>/tests/setup/setEnv.js'],
    globalSetup: '<rootDir>/tests/setup/globalSetup.js',
    setupFilesAfterEnv: ['<rootDir>/tests/setup/afterEnv.js'],
    testTimeout: 30000,
    maxWorkers: 1,
    clearMocks: true,
    restoreMocks: true,
};
