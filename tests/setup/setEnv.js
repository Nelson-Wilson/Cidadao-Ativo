/**
 * Ambiente isolado dos testes Jest.
 *
 * Força a base de dados de teste e desactiva as chamadas externas de IA para
 * que a suite seja determinística e não gaste tokens.
 */
process.env.NODE_ENV = 'test';
process.env.DB_DATABASE = 'cidadao_ativo_test';
process.env.SESSION_SECRET = 'segredo-apenas-para-testes';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.APP_URL = 'http://127.0.0.1:3000';
process.env.AI_FEATURE_CLASSIFICATION = 'false';
process.env.AI_FEATURE_DUPLICATES = 'false';
process.env.AI_FEATURE_SUMMARY = 'false';
process.env.AI_FEATURE_PRIORITY = 'false';
process.env.AI_FEATURE_CHATBOT = 'false';
process.env.AI_FEATURE_SMART_DASHBOARD = 'false';
process.env.AI_FEATURE_PHOTO_ANALYSIS = 'false';
process.env.AI_API_KEY = '';

// Os testes de integração usam sempre disco local, mesmo que o .env de
// desenvolvimento já tenha o Supabase configurado.
process.env.STORAGE_DRIVER = 'local';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
