# Especificação — Módulo Clientes (Entrega 04)

> Fonte: requisitos do dono do produto (2026-09-19) e respostas às perguntas de regra de negócio.
> Decisões tomadas pela engenharia estão marcadas com **[Decisão]**.

## 1. Visão geral

Cliente **não é cadastrado manualmente**. Todo cliente nasce de um lead: quando o lead é arrastado (ou tem o status
alterado) para **Convertido**, o cliente é criado automaticamente e aparece na seção **Clientes**.

Cliente e lead são a **mesma pessoa**: nome, e-mail, telefone, responsável, anotações e anexos são compartilhados.
O cliente acrescenta **status associativo**, **atendimentos** e a **linha do tempo** completa.

## 2. Ciclo de vida

| Evento no lead | Efeito no cliente |
|---|---|
| Lead vai para **Convertido** pela 1ª vez | Cliente criado, ativo, status associativo **Adimplente** **[Decisão]** |
| Lead sai de Convertido (ex.: para "Não convertido") | Cliente **arquivado** ("conversão desfeita"); nada é apagado |
| Lead volta para Convertido | O **mesmo** cliente é reativado, com todo o histórico |
| Excluir um lead que já virou cliente | **Bloqueado** **[Decisão]** (evita apagar cliente e histórico por engano) |

## 3. Tela de Clientes

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Clientes                                   Clientes Ativos: 12           │
│ [ Ativos | Arquivados ]                                                  │
│ [🔍 Buscar por nome...] [Filtros ▾] [Ordenar por: Nome (A–Z) ▾]          │
├──────────────┬───────────────────┬────────────────┬──────────────┬──────┤
│ Nome         │ E-mail            │ Telefone       │ Status assoc.│      │
├──────────────┼───────────────────┼────────────────┼──────────────┼──────┤
│ Ana Souza    │ ana@exemplo.com   │ (11) 91234-5678│ 🟢 Adimplente│  ✏️  │  ← linha inteira clicável
│ João Lima    │ joao@exemplo.com  │ (81) 99876-5432│ 🔴 Inadimpl. │  ✏️  │
└──────────────┴───────────────────┴────────────────┴──────────────┴──────┘
```

- **Clientes Ativos: {X}** = clientes **não arquivados** com status **Adimplente** (resposta do dono do produto).
- Abas **Ativos** (não arquivados) e **Arquivados** (conversão desfeita).
- **Busca** por nome (mesmas regras dos Leads).
- **Filtros [Decisão]:** Status associativo (Todos · Adimplente · Inadimplente) · Responsável (Todos · Meus · usuário).
- **Ordenar por [Decisão]:** Nome (A–Z) (padrão) · Nome (Z–A) · Convertidos recentemente · Convertidos há mais tempo · Atualizados recentemente.
- **Linha inteira clicável** → abre o cliente (aba Informações). **Lápis** → abre direto na aba Editar.
- Estado na URL como nos Leads (`?q=&status=&owner=&sort=&view=archived&client=<id>&tab=`).

## 4. Modal do cliente (centralizado, como o dos Leads)

| Aba | Conteúdo |
|---|---|
| **Informações** | Nome, e-mail, telefone, status associativo, responsável, cliente desde (data/hora da conversão), última edição |
| **Editar** | Nome, e-mail, telefone, status associativo, responsável (se puder reatribuir); "Última edição" |
| **Anotações** | As mesmas do lead (histórico compartilhado) |
| **Anexos** | Os mesmos do lead (Visualizar / Baixar / Remover) |
| **Atendimentos** | Formulário + lista (§5) |
| **Linha do tempo** | Todo o histórico, do mais recente ao mais antigo (§6) |

## 5. Atendimentos (registro de contato)

- Campos: **Data e hora** (padrão: agora; não pode ser no futuro), **Tipo** (Reunião · Ligação · WhatsApp · E-mail · Presencial),
  **Responsável** (usuário ativo; padrão: quem registra), **Assunto** (3–150 caracteres), **Descrição** (opcional, texto formatado
  igual às anotações).
- Lista do mais recente ao mais antigo, com data/hora, tipo, responsável, assunto e descrição.
- Atendimentos podem ser **editados** e **excluídos** pelo **autor** (quem registrou) ou por **gestor/admin**
  (confirmado 2026-09-19). A linha do tempo registra "Atendimento editado" e "Atendimento excluído" com data, hora e autor.

## 6. Linha do tempo

Reúne, com **dia e hora** e **quem fez**:

| Origem | Exemplo |
|---|---|
| Criação do lead | "Virou lead em Prospect" |
| Mudança de coluna | "Movido de Primeiro Contato para Reunião Agendada" |
| Conversão / reversão | "Convertido em cliente" · "Conversão desfeita — cliente arquivado" · "Cliente reativado" |
| Arquivar / desarquivar lead | "Lead arquivado" |
| Responsável | "Responsável alterado de Ana para Bruno" |
| Dados | "Dados de contato atualizados" · "Status associativo: Adimplente → Inadimplente" |
| Anotações, anexos, atendimentos | "Anotação adicionada" · "Anexo adicionado: proposta.pdf" · "Atendimento (Reunião): Alinhamento" |

A linha do tempo também aparece no **modal do lead** **[Decisão]** (mesmo histórico).
Leads criados antes desta entrega ganham o evento "Virou lead" com a data original de criação; leads já convertidos
viram clientes na migração.

## 7. Permissões (ADR-003)

| Ação | admin | manager | sales | viewer |
|---|---|---|---|---|
| Ver clientes, atendimentos, linha do tempo | ✅ | ✅ | ✅ | ✅ |
| Editar dados e status associativo | ✅ | ✅ | só clientes em que é responsável | ❌ |
| Registrar atendimento | ✅ | ✅ | ✅ (qualquer cliente) | ❌ |
| Anotar / anexar | regras do lead (Leads §6) | | | |
| Reatribuir responsável | ✅ | ✅ | ❌ | ❌ |
| Criar cliente manualmente | ❌ (não existe) | | | |

## 8. Critérios de aceitação

1. Arrastar um lead para **Convertido** cria o cliente, que aparece em Clientes com status Adimplente.
2. Não existe botão/rota para criar cliente manualmente.
3. "Clientes Ativos: X" conta só não arquivados e Adimplentes, e muda ao alterar o status.
4. Tirar o lead de Convertido arquiva o cliente; devolvê-lo reativa o **mesmo** cliente com o histórico intacto.
5. Lista com busca, filtros e ordenação; colunas Nome, E-mail, Telefone, Status Associativo e lápis.
6. Clicar na linha abre o modal (Informações); o lápis abre em Editar.
7. Editar altera nome/e-mail/telefone (refletido no lead) e status associativo; registra "última edição".
8. Anotações e anexos do lead aparecem no cliente e vice-versa.
9. Atendimento registrado aparece na lista e na linha do tempo; data no futuro é recusada.
10. A linha do tempo mostra criação, cada mudança de coluna, conversão e demais eventos com dia, hora e autor.
11. Excluir um lead convertido é bloqueado com mensagem clara.
12. Permissões da §7 verificadas no servidor.

## 9. QA

| Nível | Casos |
|---|---|
| Unit | validators (atendimento, filtros, status), montagem da linha do tempo |
| Integração | conversão/reversão/reativação na mesma transação; contador de ativos; eventos gravados em cada ação; posse do sales; bloqueio de exclusão; IDOR de cliente/atendimento; data futura |
| E2E | converter pelo kanban → cliente listado; contador; filtros; linha clicável; lápis; editar; atendimento; linha do tempo; reverter/reativar; viewer sem ações |

## 10. Regras confirmadas na implementação

- Lead **arquivado** não muda de status por nenhum caminho (kanban ou formulário), então não converte nem reverte cliente.
- ✅ Cliente arquivado segue os mesmos mecanismos do lead arquivado: continua editável (confirmado 2026-09-19).

## 11. Segurança

| Ameaça | Mitigação |
|---|---|
| Criar cliente forjando requisição | Não há action/rota de criação; cliente só nasce dentro da transação de mudança de status do lead |
| IDOR em cliente/atendimento | Permissão + posse checadas no service com dados do banco; ids UUID |
| Mass assignment (`leadId`, `archivedAt`, `convertedAt`) | Schemas `strict` |
| XSS em atendimento | Descrição usa o mesmo schema/renderizador seguro das anotações (ADR-007); assunto é texto puro |
| Inconsistência lead × cliente | Conversão, reversão e evento gravados na **mesma transação** da mudança de status (com lock do lead) |
