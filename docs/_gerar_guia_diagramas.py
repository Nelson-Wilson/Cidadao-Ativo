# -*- coding: utf-8 -*-
"""Gera o guia Word de leitura dos diagramas HLD e LLD."""
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

OUT_DOCX = Path(__file__).resolve().parent / "Como_ler_os_diagramas_HLD_LLD.docx"

NAVY = RGBColor(0x1B, 0x3A, 0x4B)
ACCENT = RGBColor(0x0F, 0x5C, 0x4C)
MUTED = RGBColor(0x44, 0x44, 0x44)
BLACK = RGBColor(0x22, 0x22, 0x22)


def set_run(run, size=11, bold=False, color=BLACK, italic=False):
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(size)
    run.font.name = "Calibri"
    run.font.color.rgb = color
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:eastAsia"), "Calibri")


def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = NAVY if level == 1 else ACCENT
        run.font.name = "Calibri"
    return p


def add_para(doc, text, *, bold=False, italic=False, size=11, space_after=8, center=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    if center:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    set_run(run, size=size, bold=bold, italic=italic)
    return p


def add_rich(doc, parts, space_after=8):
    """parts: list of (text, kwargs for set_run)."""
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    for text, kwargs in parts:
        run = p.add_run(text)
        set_run(run, **kwargs)
    return p


def shade_header(cell, hex_color="1B3A4B"):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = tcPr.makeelement(qn("w:shd"), {
        qn("w:val"): "clear",
        qn("w:color"): "auto",
        qn("w:fill"): hex_color,
    })
    tcPr.append(shd)


def set_cell_text(cell, text, *, bold=False, color=BLACK, size=10, white=False):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.space_before = Pt(2)
    run = p.add_run(text)
    c = RGBColor(0xFF, 0xFF, 0xFF) if white else color
    set_run(run, size=size, bold=bold, color=c)


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.autofit = True
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        shade_header(cell)
        set_cell_text(cell, h, bold=True, white=True, size=10)
    for r_i, row in enumerate(rows):
        for c_i, val in enumerate(row):
            set_cell_text(table.rows[r_i + 1].cells[c_i], val, size=10)
    doc.add_paragraph()
    return table


def build():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)

    add_para(doc, "Cidadão Ativo", bold=True, size=12, space_after=0, center=True)
    add_para(
        doc,
        "Guia de leitura dos diagramas de arquitectura",
        bold=True,
        size=20,
        space_after=4,
        center=True,
    )
    add_para(
        doc,
        "Como interpretar o Diagrama de Alto Nível (HLD) e o Diagrama de Baixo Nível (LLD)",
        italic=True,
        size=12,
        space_after=4,
        center=True,
    )
    add_para(
        doc,
        "Documento de apoio à documentação do sistema  ·  Os diagramas encontram-se no README.md",
        size=10,
        space_after=16,
        center=True,
    )

    add_heading(doc, "1. Para que servem estes diagramas", 1)
    add_para(
        doc,
        "Os diagramas não são desenhos decorativos: são mapas. Cada caixa representa uma função "
        "do sistema e cada seta representa um uso, uma dependência ou um fluxo de informação. "
        "Este guia explica como ler esses símbolos e o que cada parte faz no Cidadão Ativo.",
    )
    add_para(
        doc,
        "Existem dois níveis de leitura, de propósito diferente:",
    )

    add_table(
        doc,
        ["Diagrama", "Público", "Pergunta que responde", "O que mostra"],
        [
            [
                "Alto nível (HLD)",
                "Clientes, gestores, analistas, arquitectos e programadores",
                "O que existe no sistema e quem usa o quê?",
                "Actores, módulos de negócio e relações, sem código",
            ],
            [
                "Baixo nível (LLD)",
                "Programadores e equipa técnica",
                "Como cada peça está implementada?",
                "Ficheiros, rotas, serviços, dados, estados e chamadas",
            ],
        ],
    )
    add_para(
        doc,
        "Regra prática: se precisa de explicar o produto a alguém de negócio, use o HLD. "
        "Se precisa de alterar código, seguir um pedido HTTP ou perceber uma tabela da base "
        "de dados, use o LLD.",
        italic=True,
    )

    add_heading(doc, "2. Como se lê um diagrama em geral", 1)
    add_heading(doc, "2.1. Caixas, grupos e setas", 2)
    add_table(
        doc,
        ["Símbolo", "Significado", "Como ler"],
        [
            [
                "Caixa (rectângulo)",
                "Um componente ou uma função",
                "Leia o nome em voz alta: “isto é o mapa”, “isto é o login”.",
            ],
            [
                "Grupo (área com título)",
                "Uma família de componentes",
                "Primeiro leia o título do grupo (ex.: Quem usa), depois as caixas dentro.",
            ],
            [
                "Seta A → B",
                "A usa, envia informação ou depende de B",
                "Não é necessariamente “ordem no tempo”. É “relação”.",
            ],
            [
                "Cilindro / base de dados",
                "Persistência (o que fica gravado)",
                "Tudo o que aponta para aqui é gravado ou consultado.",
            ],
            [
                "Estado (máquina de estados)",
                "Fase de vida de uma denúncia",
                "Só se avança pelas setas desenhadas; o resto é transição inválida.",
            ],
            [
                "Linha no modelo ER",
                "Relação entre tabelas",
                "||--o{ lê-se “um para muitos”; }o--o| lê-se “muitos para zero ou um”.",
            ],
        ],
    )

    add_heading(doc, "2.2. Ordem de leitura recomendada", 2)
    add_para(doc, "1.  Identifique os grupos (as áreas grandes), não as caixas soltas.")
    add_para(doc, "2.  Veja quem entra no sistema (actores / browser).")
    add_para(doc, "3.  Siga as setas até às funções centrais (denúncia, município, técnico).")
    add_para(doc, "4.  Veja o que fica gravado (dados e fotografias) e o que é externo (GPS, IA).")
    add_para(
        doc,
        "5.  Só depois desça ao LLD: ficheiros, rotas e tabelas.",
        space_after=12,
    )

    add_heading(doc, "3. Diagrama de alto nível (HLD) — funcionalidades", 1)
    add_para(
        doc,
        "O HLD está dividido em quatro grupos. Leia-os nesta ordem: Quem usa → Cidadão Ativo → "
        "O que o sistema guarda → Fora da aplicação.",
    )

    add_heading(doc, "3.1. Grupo «Quem usa» (actores)", 2)
    add_para(
        doc,
        "Estas caixas não são ecrãs: são papéis de pessoas. Cada seta que sai de um actor "
        "mostra a que parte do sistema esse papel tem direito.",
    )
    add_table(
        doc,
        ["Caixa no diagrama", "Quem é", "O que esta pessoa faz no sistema"],
        [
            [
                "Cidadão",
                "Morador autenticado",
                "Abre conta, cria denúncias com foto e GPS, consulta as suas ocorrências e o mapa.",
            ],
            [
                "Técnico de campo",
                "Trabalhador municipal autenticado",
                "Vê só as tarefas que lhe foram atribuídas, inicia o trabalho e comprova a resolução com fotografia.",
            ],
            [
                "Município / Admin",
                "Gestor da câmara (ou administrador)",
                "Vê o dashboard, analisa denúncias, atribui técnicos e muda o estado até fechar o processo.",
            ],
            [
                "Qualquer visitante",
                "Pessoa sem login",
                "Consulta o mapa público de ocorrências e pode usar o assistente virtual.",
            ],
        ],
    )

    add_heading(doc, "3.2. Grupo «Cidadão Ativo» (funções do produto)", 2)
    add_para(
        doc,
        "Cada caixa deste grupo é uma funcionalidade de negócio. Não pense em pastas de código; "
        "pense em “o que o sistema permite fazer”.",
    )
    add_table(
        doc,
        ["Caixa", "Funcionalidade", "Como a reconhecer no uso diário"],
        [
            [
                "Mapa de ocorrências",
                "Visualizar problemas no território",
                "Página inicial com mapa, filtros de categoria, estado e bairro.",
            ],
            [
                "Assistente virtual",
                "Tirar dúvidas em linguagem natural",
                "Widget de chatbot, disponível também sem login.",
            ],
            [
                "Contas e acesso",
                "Identificar a pessoa e o seu papel",
                "Registo, login e logout; quatro papéis: cidadão, técnico, município, admin.",
            ],
            [
                "Denúncias do cidadão",
                "Reportar um problema urbano",
                "Formulário com descrição, fotografia e localização; lista “As minhas denúncias”.",
            ],
            [
                "Operação municipal",
                "Gerir e despachar ocorrências",
                "Dashboard, listagem, atribuição de técnico e mudança de estado.",
            ],
            [
                "Tarefas de campo",
                "Executar e comprovar a resolução",
                "Lista de tarefas do técnico, botão iniciar e envio da foto de resolução.",
            ],
            [
                "Apoio inteligente",
                "Ajudar as outras funções com IA",
                "Sugestão de categoria, duplicados, prioridade, resumos e respostas do chatbot.",
            ],
        ],
    )

    add_heading(doc, "3.3. Como ler as setas do HLD (o que cada relação significa)", 2)
    add_para(
        doc,
        "As setas do HLD não são um algoritmo. Dizem “quem usa o quê” ou “esta função precisa daquela”.",
    )
    add_table(
        doc,
        ["Seta", "Funcionalidade da relação"],
        [
            [
                "Visitante → Mapa / Assistente",
                "O sistema é parcialmente aberto: ver o território e perguntar não exige conta.",
            ],
            [
                "Cidadão → Contas, Denúncias e Mapa",
                "O cidadão autentica-se para reportar, mas continua a poder ver o mapa.",
            ],
            [
                "Município → Operação municipal",
                "Toda a gestão (dashboard, atribuição, estados) passa por este módulo.",
            ],
            [
                "Técnico → Tarefas de campo",
                "O técnico não gere o município; só executa o que lhe foi atribuído.",
            ],
            [
                "Denúncias / Operação / Campo / Assistente → Apoio inteligente",
                "A IA não é um ecrã isolado: serve as outras funções (classificar, priorizar, resumir, conversar).",
            ],
            [
                "Denúncias / Campo → Fotos",
                "Há dois tipos de fotografia: a do problema (cidadão) e a da resolução (técnico).",
            ],
            [
                "Vários módulos → Dados",
                "Utilizadores, denúncias e histórico ficam na base de dados, não só no ecrã.",
            ],
            [
                "Denúncias / Mapa → GPS",
                "A localização vem de fora (GPS do telemóvel ou marcação no mapa Leaflet).",
            ],
            [
                "Apoio inteligente → Serviço de IA",
                "O “cérebro” da classificação e da visão está fora da aplicação (API de IA).",
            ],
        ],
    )

    add_heading(doc, "3.4. O fluxo de negócio escondido no HLD", 2)
    add_para(
        doc,
        "Mesmo sem números nas setas, o HLD descreve o ciclo de vida do serviço. Leia-o em cinco passos:",
    )
    add_para(doc, "Passo 1 — O cidadão entra em Contas e depois em Denúncias (foto + GPS).")
    add_para(doc, "Passo 2 — O Apoio inteligente classifica, procura duplicados e calcula prioridade.")
    add_para(doc, "Passo 3 — A Operação municipal analisa, atribui um técnico e muda o estado.")
    add_para(doc, "Passo 4 — As Tarefas de campo executam o trabalho e gravam a foto de resolução.")
    add_para(
        doc,
        "Passo 5 — A Operação municipal fecha o processo. O Mapa mostra o resultado a todos.",
        space_after=8,
    )
    add_para(
        doc,
        "Frase-resumo do HLD: cidadão reporta → município analisa e atribui → técnico executa e resolve → município fecha.",
        italic=True,
    )

    add_heading(doc, "4. Diagrama de baixo nível (LLD) — funcionalidades técnicas", 1)
    add_para(
        doc,
        "O LLD é o mesmo sistema, visto por dentro. Cada grupo é uma camada de software. "
        "Leia de cima para baixo: Browser → Servidor → Autenticação → Rotas → Serviços / Modelos → Persistência.",
    )

    add_heading(doc, "4.1. Camada Browser — o que o utilizador corre no telemóvel ou PC", 2)
    add_table(
        doc,
        ["Caixa", "Função no diagrama"],
        [
            ["Views EJS", "Páginas HTML geradas no servidor (formulários, dashboards, mapa)."],
            ["public/js/map.js", "Pede a lista pública de denúncias e desenha os pontos no mapa."],
            ["public/js/report-form.js", "No formulário: GPS, sugestão de categoria por IA e aviso de duplicados."],
            ["public/js/chatbot.js", "Envia a pergunta do assistente para a API e mostra a resposta."],
        ],
    )

    add_heading(doc, "4.2. Camada Servidor — o portão de todos os pedidos", 2)
    add_para(
        doc,
        "Tudo passa primeiro pelo middleware (compressão, sessão, utilizador actual, CSRF). "
        "Só depois o pedido chega a uma rota. As rotas estão separadas por área funcional:",
    )
    add_table(
        doc,
        ["Ficheiro de rotas", "Função que implementa (ligação ao HLD)"],
        [
            ["routes/map.js", "Mapa público e redireccionamento /dashboard segundo o papel."],
            ["routes/auth.js", "Contas e acesso: login, registo e logout."],
            ["routes/reports.js", "Denúncias do cidadão: criar, listar e ver detalhe."],
            ["routes/municipio.js", "Operação municipal: dashboard, listar, atribuir, mudar estado."],
            ["routes/tecnico.js", "Tarefas de campo: listar, iniciar e resolver com foto."],
            ["routes/api.js", "JSON para mapa, chatbot, classificação, foto e duplicados."],
            ["GET /health", "Verificação operacional: o servidor e o MySQL respondem?"],
            ["404 + erros + shutdown", "Páginas em falta, erros internos e encerramento limpo do processo."],
        ],
    )

    add_heading(doc, "4.3. Autenticação e papéis", 2)
    add_para(
        doc,
        "exigirAutenticacao significa “só com sessão iniciada”. exigirPapel significa “só este tipo "
        "de utilizador”. tentarAutenticar compara o email e a palavra-passe (hash bcrypt). "
        "No diagrama, quase todas as rotas de negócio apontam para esta caixa: é a tranca da porta.",
    )

    add_heading(doc, "4.4. Models — o que cada entidade faz", 2)
    add_para(
        doc,
        "Um model não é um ecrã: é a regra e a consulta sobre uma tabela. Quando o LLD liga uma "
        "rota a um model, está a dizer “esta página lê ou grava estes dados”.",
    )
    add_table(
        doc,
        ["Model", "Função"],
        [
            ["Usuario", "Contas, papéis e técnicos de um departamento."],
            ["Denuncia + TRANSITIONS", "Criar denúncia, consultar, atribuir e mudar estado com histórico."],
            ["Categoria", "Tipos de problema ( palete usada no formulário e no mapa)."],
            ["Municipio / Departamento", "Organização municipal e encaminhamento automático."],
            ["ConfirmacaoDenuncia", "Quando um cidadão confirma que um problema já reportado é o mesmo."],
            ["ResolucaoFotoDenuncia", "Fotografia com que o técnico prova que o problema foi resolvido."],
        ],
    )

    add_heading(doc, "4.5. Services — as funções “inteligentes” e de negócio", 2)
    add_para(
        doc,
        "Os serviços são a implementação da caixa «Apoio inteligente» do HLD, mais o encaminhamento.",
    )
    add_table(
        doc,
        ["Serviço", "Função no sistema"],
        [
            ["servicoEncaminhamentoDenuncia", "Escolhe município e departamento a partir da categoria."],
            ["servicoClassificacao", "Sugere categoria e gravidade a partir do texto da denúncia."],
            ["servicoAnaliseFoto", "Lê a fotografia: categoria, gravidade, duplicado visual e prova de resolução."],
            ["servicoDeteccaoDuplicados", "Procura denúncias próximas (GPS + texto); pode pedir comparação visual."],
            ["servicoPrioridade", "Calcula baixa / normal / urgente / muito urgente (com salvaguarda de risco de vida)."],
            ["servicoChatbot", "Responde às perguntas do assistente virtual."],
            ["servicoDashboardInteligente", "Resume estatísticas para o painel do município."],
            ["servicoResumo", "Resume a descrição da denúncia para o técnico no campo."],
            ["aiClient.js", "Único sítio que fala com a API de IA (Anthropic). Se falhar, o resto do sistema continua."],
        ],
    )

    add_heading(doc, "4.6. Persistência — o que fica gravado", 2)
    add_table(
        doc,
        ["Caixa", "Função"],
        [
            ["src/db.js (pool mysql2)", "Canal de ligações à base cidadao_ativo."],
            ["MySQL", "Tabelas de utilizadores, denúncias, histórico, sessões, etc."],
            ["Multer disco", "Guarda fotos definitivas (reports e resolutions), máx. 5 MB, jpg/png/webp."],
            ["Multer memória", "Foto temporária só para a IA analisar; depois é apagada."],
            ["public/uploads/...", "Pasta pública de onde o browser mostra as imagens."],
        ],
    )

    add_heading(doc, "5. Como ler o modelo de dados (ER)", 1)
    add_para(
        doc,
        "Este diagrama responde: “que tabelas existem e como se ligam?”. Comece sempre pela tabela "
        "reports (denúncias): é o coração do sistema. Depois siga as linhas.",
    )
    add_table(
        doc,
        ["Notação", "Como ler em português"],
        [
            ["users ||--o{ reports «abre»", "Um cidadão pode abrir muitas denúncias."],
            ["users ||--o{ reports «tecnico atribuido»", "Um técnico pode ter muitas denúncias atribuídas (ou nenhuma)."],
            ["categories ||--o{ reports", "Cada denúncia tem uma categoria; uma categoria serve muitas denúncias."],
            ["municipalities / departments → reports", "A denúncia fica associada a um município e a um departamento."],
            ["category_department", "Tabela-ponte: diz que departamento trata que categoria (encaminhamento)."],
            ["report_status_histories", "Auditoria: cada mudança de estado fica registada (quem e quando)."],
            ["report_photo_resolutions", "Fotos de resolução ligadas à denúncia e ao técnico."],
            ["report_confirmations", "Confirmações de duplicado (um utilizador só confirma a mesma denúncia uma vez)."],
            ["user_sessions", "Sessões web persistidas no MySQL (cookie cidadao_ativo_sid)."],
        ],
    )
    add_para(
        doc,
        "Campos-chave a notar na caixa reports: status (fase do processo), priority (urgência), "
        "latitude/longitude (posição no mapa) e photo_path (foto do problema).",
        italic=True,
    )

    add_heading(doc, "6. Como ler a máquina de estados da denúncia", 1)
    add_para(
        doc,
        "Este diagrama não mostra ecrãs: mostra as fases legais do processo. Uma denúncia só pode "
        "saltar para um estado vizinho. Se a seta não existe, a transição é recusada pelo código "
        "(Denuncia.TRANSITIONS / mudarStatus).",
    )
    add_table(
        doc,
        ["Estado", "O que significa na prática", "Quem provoca a saída"],
        [
            ["recebida", "Acabou de ser submetida pelo cidadão.", "Município passa a em análise."],
            ["em_analise", "A câmara está a avaliar.", "Atribui técnico (atribuida) ou rejeita."],
            ["atribuida", "Já tem técnico responsável.", "Técnico inicia (em_execucao)."],
            ["em_execucao", "Trabalho de campo a decorrer.", "Técnico resolve com foto (resolvida)."],
            ["resolvida", "Há prova fotográfica de resolução.", "Município fecha (fechada)."],
            ["fechada", "Processo concluído.", "Estado final."],
            ["rejeitada", "Não será tratada.", "Estado final."],
        ],
    )
    add_para(
        doc,
        "Leitura rápida da figura: o caminho feliz é recebida → em_analise → atribuida → "
        "em_execucao → resolvida → fechada. O desvio é em_analise → rejeitada.",
        italic=True,
    )

    add_heading(doc, "7. Ponte entre os dois diagramas", 1)
    add_para(
        doc,
        "Use esta tabela quando vir uma caixa no HLD e quiser saber onde está no LLD (e no código).",
    )
    add_table(
        doc,
        ["No HLD (função de negócio)", "No LLD (implementação)"],
        [
            ["Contas e acesso", "routes/auth.js + src/auth.js + Usuario + user_sessions"],
            ["Mapa de ocorrências", "routes/map.js + GET /api/reports + public/js/map.js"],
            ["Assistente virtual", "POST /api/chatbot + servicoChatbot + public/js/chatbot.js"],
            ["Denúncias do cidadão", "routes/reports.js + Denuncia.criar + upload reports"],
            ["Operação municipal", "routes/municipio.js + dashboard + atribuição + estados"],
            ["Tarefas de campo", "routes/tecnico.js + ResolucaoFotoDenuncia + upload resolutions"],
            ["Apoio inteligente", "src/services/ai/* + aiClient.js + rotas /api/ai/*"],
            ["Dados", "MySQL (schema.sql) através dos models e de src/db.js"],
            ["Fotografias", "public/uploads/reports e public/uploads/resolutions"],
            ["Serviço de IA (externo)", "AIClient.enviarMensagem → API Anthropic"],
        ],
    )

    add_heading(doc, "8. Checklist para apresentar ou rever os diagramas", 1)
    add_para(doc, "Com o HLD à frente, deve conseguir responder:")
    add_para(doc, "• Quem pode usar o sistema sem conta?")
    add_para(doc, "• O que o cidadão faz que o técnico não faz, e vice-versa?")
    add_para(doc, "• Onde entra a inteligência artificial — é um módulo isolado ou um apoio?")
    add_para(doc, "• O que fica gravado depois de uma denúncia?")
    add_para(doc, "Com o LLD à frente, deve conseguir responder:")
    add_para(doc, "• Que ficheiro de rotas trata o meu ecrã?")
    add_para(doc, "• Que serviço chama a IA e o que acontece se a chave de API falhar?")
    add_para(doc, "• Que tabela guarda o histórico de estados?")
    add_para(
        doc,
        "• Quais as transições permitidas a partir de em_analise?",
        space_after=12,
    )

    add_heading(doc, "9. Onde estão os diagramas", 1)
    add_para(
        doc,
        "Os desenhos (Mermaid) estão na secção «Arquitectura do sistema» do ficheiro README.md "
        "na raiz do projecto. Este documento não substitui esses desenhos: ensina a lê-los. "
        "Abra o README num visualizador que suporte Mermaid (GitHub, GitLab ou pré-visualização "
        "Markdown no Cursor) para ver as figuras; use este guia ao lado para interpretar cada caixa e cada seta.",
    )

    footer = doc.sections[0].footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = fp.add_run("Cidadão Ativo  ·  Guia de leitura dos diagramas HLD e LLD")
    set_run(run, size=9, color=MUTED)

    doc.save(str(OUT_DOCX))
    print(OUT_DOCX)


if __name__ == "__main__":
    build()
