/** Configuração dos testes unitários: rápidos, sem base de dados e sem rede. */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
    setupFiles: ['<rootDir>/tests/setup/setEnv.js'],
    clearMocks: true,
    restoreMocks: true,
    collectCoverageFrom: [
        'src/domain/**/*.js',
        'src/validation/**/*.js',
        'src/authorization.js',
        'src/services/servicoEncaminhamentoDenuncia.js',
        'src/services/ai/servicoPrioridade.js',
    ],
    coverageDirectory: '<rootDir>/coverage/unit',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coverageThreshold: {
        global: {
            statements: 80,
            branches: 75,
            functions: 80,
            lines: 80,
        },
    },
};
