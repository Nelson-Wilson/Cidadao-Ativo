const STATUS_LABELS = {
    recebida: 'Recebida',
    em_analise: 'Em análise',
    atribuida: 'Atribuída',
    em_execucao: 'Em execução',
    resolvida: 'Resolvida',
    fechada: 'Fechada',
    rejeitada: 'Rejeitada',
};

const PRIORITY_LABELS = {
    baixa: 'Baixa',
    normal: 'Normal',
    urgente: 'Urgente',
    muito_urgente: 'Muito urgente',
};

const ROLE_LABELS = {
    cidadao: 'Cidadão',
    tecnico: 'Técnico',
    municipio: 'Município',
    admin: 'Administrador',
};

const CATEGORY_ICONS = {
    'Buracos': '🕳️',
    'Iluminação Pública': '💡',
    'Lixo': '🗑️',
    'Água': '💧',
    'Esgotos': '🚿',
    'Semáforos': '🚦',
    'Árvores Caídas': '🌳',
    'Construções Perigosas': '🏚️',
    'Animais Abandonados': '🐾',
    'Vandalismo': '🎨',
    'Segurança': '🛡️',
    'Outros': '📍',
};

const CATEGORY_TONES = {
    'Buracos': 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
    'Iluminação Pública': 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-300',
    'Lixo': 'bg-lime-50 text-lime-600 dark:bg-lime-950/50 dark:text-lime-300',
    'Água': 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
    'Esgotos': 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300',
    'Semáforos': 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
    'Árvores Caídas': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    'Construções Perigosas': 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
    'Animais Abandonados': 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/50 dark:text-fuchsia-300',
    'Vandalismo': 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300',
    'Segurança': 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300',
    'Outros': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function statusLabel(status) {
    return STATUS_LABELS[status] || String(status || '').replace(/_/g, ' ');
}

function statusClasses(status) {
    const map = {
        recebida: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        em_analise: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
        atribuida: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
        em_execucao: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
        resolvida: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        fechada: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        rejeitada: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    };
    return map[status] || map.recebida;
}

function statusDotClasses(status) {
    const map = {
        recebida: 'bg-slate-400',
        em_analise: 'bg-amber-500',
        atribuida: 'bg-violet-500',
        em_execucao: 'bg-sky-500',
        resolvida: 'bg-emerald-500',
        fechada: 'bg-emerald-600',
        rejeitada: 'bg-rose-500',
    };
    return map[status] || map.recebida;
}

function statusProgress(status) {
    const map = {
        recebida: 10,
        em_analise: 30,
        atribuida: 50,
        em_execucao: 70,
        resolvida: 100,
        fechada: 100,
        rejeitada: 100,
    };
    return map[status] ?? 10;
}

function priorityLabel(priority) {
    return PRIORITY_LABELS[priority] || String(priority || '').replace(/_/g, ' ');
}

function priorityClasses(priority) {
    if (priority === 'muito_urgente' || priority === 'urgente') {
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
    }
    if (priority === 'baixa') {
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
}

function categoryIcon(name) {
    return CATEGORY_ICONS[name] || '📍';
}

function categoryTone(name) {
    return CATEGORY_TONES[name] || CATEGORY_TONES.Outros;
}

function roleLabel(role) {
    return ROLE_LABELS[role] || role || 'Utilizador';
}

function initials(name) {
    const partes = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return 'CA';
    const primeira = partes[0][0] || '';
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primeira + ultima).toUpperCase();
}

function formatDate(value) {
    if (!value) return '—';
    const texto = String(value);
    const data = texto.split(' ')[0];
    const partes = data.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return texto;
}

function formatDateTime(value) {
    if (!value) return '—';
    const texto = String(value);
    const [data, hora = ''] = texto.split(' ');
    const dataFormatada = formatDate(data);
    return hora ? `${dataFormatada} · ${hora.slice(0, 5)}` : dataFormatada;
}

function excerpt(text, max = 140) {
    const limpo = String(text || '').replace(/\s+/g, ' ').trim();
    return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Escapa e depois converte quebras de linha em <br> — para usar com <%- %> (raw) nas views. */
function nl2br(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
}

/** Middleware: expõe estes helpers directamente às views EJS (res.locals). */
function exposeToViews(req, res, next) {
    res.locals.statusLabel = statusLabel;
    res.locals.statusClasses = statusClasses;
    res.locals.statusDotClasses = statusDotClasses;
    res.locals.statusProgress = statusProgress;
    res.locals.priorityLabel = priorityLabel;
    res.locals.priorityClasses = priorityClasses;
    res.locals.categoryIcon = categoryIcon;
    res.locals.categoryTone = categoryTone;
    res.locals.roleLabel = roleLabel;
    res.locals.initials = initials;
    res.locals.formatDate = formatDate;
    res.locals.formatDateTime = formatDateTime;
    res.locals.excerpt = excerpt;
    res.locals.nl2br = nl2br;
    res.locals.currentPath = req.path;
    res.locals.appUrl = process.env.APP_URL || '';
    res.locals.url = (path = '') => {
        const valor = String(path);
        // Fotografias no Supabase já são URLs absolutos.
        if (/^https?:\/\//i.test(valor)) return valor;
        return `${(process.env.APP_URL || '').replace(/\/$/, '')}/${valor.replace(/^\//, '')}`;
    };
    next();
}

module.exports = {
    statusLabel,
    statusClasses,
    statusDotClasses,
    statusProgress,
    priorityLabel,
    priorityClasses,
    categoryIcon,
    categoryTone,
    roleLabel,
    initials,
    formatDate,
    formatDateTime,
    excerpt,
    escapeHtml,
    nl2br,
    exposeToViews,
};
