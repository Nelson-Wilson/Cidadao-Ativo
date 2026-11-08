require('dotenv').config();

const fs = require('fs');

/**
 * Configuração centralizada da aplicação Cidadão Ativo.
 * Valida variáveis de ambiente para garantir execução fiável e segura.
 */
const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

const sessionSecret = process.env.SESSION_SECRET || 'troca-isto-por-uma-string-aleatoria-longa';
const segredosFracos = new Set([
    'troca-isto-por-uma-string-aleatoria-longa',
    'muda-isto',
    'segredo',
    'secret',
]);

if (isProduction && (segredosFracos.has(sessionSecret) || sessionSecret.length < 32)) {
    throw new Error(
        '[SEGURANÇA] SESSION_SECRET ausente ou demasiado fraco. '
        + 'Gera uma chave com pelo menos 32 caracteres antes de arrancar em produção.'
    );
}

if (isProduction && !process.env.DB_PASSWORD) {
    console.warn('[SEGURANÇA] DB_PASSWORD vazio em produção. Confirma se o serviço MySQL o permite.');
}

if (isProduction && !/^https:\/\//.test(process.env.APP_URL || '')) {
    console.warn('[SEGURANÇA] APP_URL não usa HTTPS. Cookies seguros e links absolutos podem falhar.');
}

function lerCaSsl() {
    if (!process.env.DB_SSL_CA) return undefined;
    try {
        return fs.readFileSync(process.env.DB_SSL_CA, 'utf8');
    } catch (erro) {
        console.warn(`[Config] Não foi possível ler DB_SSL_CA: ${erro.message}`);
        return undefined;
    }
}

function interpretarTrustProxy(valor) {
    if (valor === undefined || valor === '') return isProduction ? 1 : false;
    if (valor === 'true') return 1;
    if (valor === 'false') return false;
    const numero = Number(valor);
    return Number.isInteger(numero) && numero >= 0 ? numero : valor;
}

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || null;

// Gemini 3+ pensa por defeito. LOW reduz latência e evita que os tokens de
// raciocínio consumam o maxOutputTokens das respostas curtas da aplicação.
// Deixa AI_THINKING_LEVEL vazio para não enviar thinkingConfig.
const niveisThinking = new Set(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']);
const thinkingLevelConfigurado = (process.env.AI_THINKING_LEVEL ?? 'LOW').trim().toUpperCase();
const thinkingLevel = thinkingLevelConfigurado === '' || niveisThinking.has(thinkingLevelConfigurado)
    ? thinkingLevelConfigurado
    : 'LOW';

if (isProduction && !geminiApiKey) {
    console.warn(
        '[IA] GEMINI_API_KEY não configurada. O chatbot usará respostas de contingência '
        + 'e a análise de fotografias ficará desativada.'
    );
}

// Armazenamento de fotografias: disco local em desenvolvimento, Supabase
// Storage em produção (o disco do Render free é efémero).
const storageDriver = (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();
if (!['local', 'supabase'].includes(storageDriver)) {
    throw new Error(`[Storage] STORAGE_DRIVER inválido: "${storageDriver}". Usa "local" ou "supabase".`);
}

const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseBucket = (process.env.SUPABASE_STORAGE_BUCKET || 'cidadao-ativo').trim();

if (storageDriver === 'supabase' && (!/^https:\/\//.test(supabaseUrl) || !supabaseKey)) {
    throw new Error(
        '[Storage] STORAGE_DRIVER=supabase exige SUPABASE_URL (https) e SUPABASE_SERVICE_ROLE_KEY.'
    );
}

if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(supabaseBucket)) {
    throw new Error('[Storage] SUPABASE_STORAGE_BUCKET deve usar apenas minúsculas, números e hífenes.');
}

if (isProduction && storageDriver === 'local') {
    console.warn(
        '[Storage] disco local em produção é efémero; as fotografias perdem-se '
        + 'em cada deploy. Configura STORAGE_DRIVER=supabase.'
    );
}

const config = {
    env,
    isProduction,
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
    sessionSecret,
    trustProxy: interpretarTrustProxy(process.env.TRUST_PROXY),
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        database: process.env.DB_DATABASE || 'cidadao_ativo',
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
        dateStrings: true,
        ssl: process.env.DB_SSL === 'true'
            ? {
                rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
                ca: lerCaSsl(),
            }
            : undefined,
    },
    storage: {
        driver: storageDriver,
        supabaseUrl,
        supabaseKey,
        bucket: supabaseBucket,
    },
    ai: {
        provider: 'gemini',
        apiKey: geminiApiKey,
        apiUrl: (process.env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
        model: process.env.AI_MODEL || 'gemini-3.6-flash',
        fallbackModel: process.env.AI_MODEL_FALLBACK || 'gemini-3.5-flash-lite',
        thinkingLevel,
        timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '20000', 10),
        features: {
            classification: (process.env.AI_FEATURE_CLASSIFICATION ?? 'true') !== 'false',
            duplicates: (process.env.AI_FEATURE_DUPLICATES ?? 'true') !== 'false',
            summary: (process.env.AI_FEATURE_SUMMARY ?? 'true') !== 'false',
            priority: (process.env.AI_FEATURE_PRIORITY ?? 'true') !== 'false',
            chatbot: (process.env.AI_FEATURE_CHATBOT ?? 'true') !== 'false',
            smartDashboard: (process.env.AI_FEATURE_SMART_DASHBOARD ?? 'true') !== 'false',
            photoAnalysis: (process.env.AI_FEATURE_PHOTO_ANALYSIS ?? 'true') !== 'false',
        },
        duplicateRadiusKm: parseFloat(process.env.AI_DUPLICATE_RADIUS_KM || '0.3'),
    },
};

module.exports = config;
