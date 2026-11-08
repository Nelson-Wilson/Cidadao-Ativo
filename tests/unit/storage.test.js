/**
 * Testa a abstração de armazenamento: disco local e Supabase Storage.
 * Nenhum pedido real é feito — `fetch` é substituído.
 */
describe('Upload — drivers de armazenamento', () => {
    const fetchOriginal = global.fetch;
    const envOriginal = { ...process.env };

    function configurarSupabase() {
        process.env.STORAGE_DRIVER = 'supabase';
        process.env.SUPABASE_URL = 'https://projeto.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secreta';
        process.env.SUPABASE_STORAGE_BUCKET = 'cidadao-ativo';
    }

    beforeEach(() => {
        jest.resetModules();
        process.env.STORAGE_DRIVER = 'local';
        process.env.SUPABASE_URL = '';
        process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    });

    afterEach(() => {
        global.fetch = fetchOriginal;
        process.env = { ...envOriginal };
        jest.resetModules();
        jest.restoreAllMocks();
    });

    test('driver local devolve caminho relativo e URL com APP_URL', async () => {
        const upload = require('../../src/upload');

        const caminho = await upload.guardarFoto('reports', {
            mimetype: 'image/png',
            filename: 'abc123.png',
        });

        expect(caminho).toBe('uploads/reports/abc123.png');
        expect(upload.urlPublica(caminho)).toBe('http://127.0.0.1:3000/uploads/reports/abc123.png');
    });

    test('driver local recusa caminhos fora de public/uploads', async () => {
        const upload = require('../../src/upload');

        expect(await upload.lerFicheiro('../../.env')).toBeNull();
        expect(await upload.lerFicheiro('C:\\Windows\\win.ini')).toBeNull();
    });

    test('driver Supabase envia a imagem e devolve URL público', async () => {
        configurarSupabase();
        global.fetch = jest.fn(async () => new Response('{}', { status: 200 }));

        const upload = require('../../src/upload');
        const caminho = await upload.guardarFoto('reports', {
            mimetype: 'image/jpeg',
            buffer: Buffer.from('foto'),
        });

        expect(caminho).toMatch(
            /^https:\/\/projeto\.supabase\.co\/storage\/v1\/object\/public\/cidadao-ativo\/reports\/[a-f0-9]{32}\.jpg$/
        );
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const [url, opcoes] = global.fetch.mock.calls[0];
        expect(url).toContain('/storage/v1/object/cidadao-ativo/reports/');
        expect(opcoes.method).toBe('POST');
        expect(opcoes.headers.Authorization).toBe('Bearer service-role-secreta');
        expect(opcoes.headers.apikey).toBe('service-role-secreta');
        expect(opcoes.body.toString()).toBe('foto');
    });

    test('driver Supabase só lê imagens do próprio bucket', async () => {
        configurarSupabase();
        global.fetch = jest.fn(async () => new Response(Buffer.from('foto'), { status: 200 }));

        const upload = require('../../src/upload');

        expect(await upload.lerFicheiro('https://atacante.test/foto.jpg')).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();

        const buffer = await upload.lerFicheiro(
            'https://projeto.supabase.co/storage/v1/object/public/cidadao-ativo/reports/a.jpg'
        );
        expect(buffer.toString()).toBe('foto');
    });

    test('driver Supabase apaga o objeto correto', async () => {
        configurarSupabase();
        global.fetch = jest.fn(async () => new Response(null, { status: 200 }));

        const upload = require('../../src/upload');
        await upload.eliminarFicheiro(
            'https://projeto.supabase.co/storage/v1/object/public/cidadao-ativo/resolutions/b.png'
        );

        const [url, opcoes] = global.fetch.mock.calls[0];
        expect(url).toContain('/storage/v1/object/cidadao-ativo/resolutions/b.png');
        expect(opcoes.method).toBe('DELETE');
        expect(opcoes.headers.Authorization).toBe('Bearer service-role-secreta');
    });

    test('falha do Supabase impede gravar o caminho na base de dados', async () => {
        configurarSupabase();
        global.fetch = jest.fn(async () => new Response('sem permissão', { status: 403 }));

        const upload = require('../../src/upload');

        await expect(upload.guardarFoto('reports', {
            mimetype: 'image/webp',
            buffer: Buffer.from('foto'),
        })).rejects.toThrow('Supabase Storage 403');
    });
});
