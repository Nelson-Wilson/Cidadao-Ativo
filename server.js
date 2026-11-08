const config = require('./src/config');
const pool = require('./src/db');
const { createApp } = require('./src/app');

/**
 * Arranque do servidor. A criação da app vive em src/app.js para que os testes
 * de integração possam usar createApp() sem abrir uma porta.
 */
function iniciar() {
    const app = createApp();
    const server = app.listen(config.port, () => {
        console.log(`Cidadão Ativo em execução em ${config.appUrl}`);
    });

    // Encerramento Gracioso (Graceful Shutdown)
    function encerrarGraciosamente(sinal) {
        console.log(`\nSinal ${sinal} recebido. A encerrar o servidor graciosamente...`);
        server.close(async () => {
            try {
                await pool.end();
                console.log('Ligações ao MySQL encerradas com sucesso.');
                process.exit(0);
            } catch (err) {
                console.error('Erro ao encerrar ligações MySQL:', err);
                process.exit(1);
            }
        });
    }

    process.on('SIGTERM', () => encerrarGraciosamente('SIGTERM'));
    process.on('SIGINT', () => encerrarGraciosamente('SIGINT'));

    return server;
}

if (require.main === module) {
    iniciar();
}

module.exports = { iniciar };
