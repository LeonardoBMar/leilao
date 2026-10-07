# Plano: Leilões do catálogo e Minhas análises

Status: **aprovado em 2026-10-07**. Decisão registrada em `docs/ARCHITECTURE.md` §15 (D-42).

## 1. Problema

"Leilão" queria dizer duas coisas na navegação:

- **O leilão de verdade**, o evento com centenas de lotes. Já existe no catálogo: todo anúncio coletado traz `auctionExternalId` e `auctionName`.
- **O registro do usuário** (`auctions`), que guarda só os lotes analisados, com resultado e arquivamento.

A tela "Leilões" mostrava só o registro, e um leilão de 300 lotes aparecia com os 3 que o usuário analisou. "Descobertos" já mostrava os leilões de verdade, mas sem agrupar por leilão.

Levantamento no banco (07/10/2026): 2.485 anúncios da Leilo em 27 leilões, 650 da Freitas em 5 e 454 do Pátio em 9, todos com leilão. O Pátio não informa a data do leilão (`auctionStartsAt` vazio). Dos 28 leilões do usuário, 13 estão ligados a uma fonte e 15 são manuais; dos 45 lotes, 30 estão ligados a anúncios. Dois leilões do catálogo mudaram de nome entre coletas.

## 2. Telas e rotas

| Rota | Tela | Antes |
| --- | --- | --- |
| `/leiloes` | **Leilões, por leilão**: cartões do catálogo | Lista dos leilões do usuário |
| `/leiloes/veiculos` | **Leilões, todos os veículos**: a busca solta | `/descobertos` |
| `/leiloes/[fonte]/[leilao]` | **Leilão do catálogo**: os lotes dele, com os analisados marcados | Novo |
| `/minhas-analises` | **Minhas análises**: "Todos os lotes" (padrão) ou "Por leilão" | `/lotes` |
| `/minhas-analises/leiloes/novo` | Cadastro manual de leilão | `/leiloes/novo` |
| `/minhas-analises/leiloes/[id]` (+ `editar`, `lotes/novo`) | Registro do leilão do usuário: lotes, edição, arquivamento | `/leiloes/[id]…` |
| `/lotes/[id]` (+ `editar`, `resultado`), `/analise/[id]` | Ficha do lote e análise | Sem mudança |

O registro do leilão sai de `/leiloes/[id]` porque o Next não aceita `[id]` e `[fonte]/[leilao]` no mesmo nível. As URLs antigas redirecionam (`next.config.ts`), com a query: `/descobertos` → `/leiloes/veiculos`, `/lotes` → `/minhas-analises`, `/leiloes/novo` e `/leiloes/<uuid>…` → `/minhas-analises/leiloes/…`.

Menu: **Dashboard · Leilões · Minhas análises · Monitores · Alertas**, depois o grupo Acompanhando.

## 3. Comportamento

**Leilões, por leilão (`/leiloes`)**

- Cartão: fonte, nome, data, total de lotes, abertos, quantos batem com os filtros e quantos o usuário analisou.
- Mesmos filtros de "todos os veículos" (região, categoria, condição, busca…). Só aparece leilão com pelo menos um lote no filtro.
- Seletor "Abertos | Encerrados". Abertos: o mais próximo primeiro. Encerrados: o mais recente primeiro.
- Data do leilão: `auctionStartsAt`; sem ela, o primeiro encerramento (ou início) entre os lotes. Nome: o do anúncio coletado mais recentemente.
- A linha de saúde da coleta fica aqui e em "todos os veículos".

**Leilão do catálogo (`/leiloes/[fonte]/[leilao]`)**

- Os cartões de anúncio, só daquele leilão, com os filtros; o cartão já indica o lote analisado.
- Link "Ver minhas análises deste leilão" quando o usuário tem o registro do leilão.

**Minhas análises (`/minhas-analises`)**

- **Todos os lotes** (padrão): a lista de lotes de antes, com os mesmos filtros e paginação.
- **Por leilão** (`?vista=leilao`): os mesmos lotes filtrados, agrupados por leilão. O cabeçalho do grupo mostra nome, data, lotes do usuário e, se o leilão está no catálogo, o total de lotes com link para ele; leva ao registro do leilão.
- Botão "Novo leilão" (cadastro manual).

**Dashboard e sidebar:** "Próximos leilões" e o cartão "Próximo leilão" continuam com os leilões do usuário; mudam só os links.

## 4. Decisão técnica

Leilão do catálogo é **derivado dos anúncios**, sem tabela: agrupamento de `listings` por `(source_id, auction_external_id)`, com índice novo nesse par. Regra pura em `src/domain/listings/catalog-auctions.ts` (data, situação, nome e ordem), testada. Se o volume crescer, a saída é uma tabela `catalog_auctions` alimentada pelo coletor.

## 5. Etapas

1. Documentos: este plano, SPEC §4/§5, DESIGN §9, D-42 e GUIA.
2. Domínio e consultas: agrupamento do catálogo (regra pura + testes), índice e consulta com contagens e analisados do usuário.
3. Leilões: `/leiloes`, `/leiloes/veiculos` e `/leiloes/[fonte]/[leilao]`.
4. Minhas análises: move `/lotes` e o registro do leilão para `/minhas-analises/…`, visão "Por leilão" e redirecionamentos.
5. Fechamento: menu, links internos, E2E, `npm run check` + `npm run build` e conferência no navegador (desktop e celular).

## 6. Fora deste plano

- Ligar um leilão manual a um leilão do catálogo.
- Próximos leilões do catálogo (da região) no dashboard.
