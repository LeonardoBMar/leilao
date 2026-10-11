# Plano: coleta automática, alertas e estimativas

Status: **aprovado em 2026-09-27**. Decisões registradas em `docs/ARCHITECTURE.md` §15 (D-25 a D-30).

## 1. Objetivo

Automatizar o fluxo **Descobrir → Filtrar → Acompanhar → Analisar → Registrar decisão → Observar resultado → Aprender**, com o mínimo de trabalho manual:

1. Um coletor busca lotes em sites de leilão, sozinho e periodicamente.
2. Os dados viram um formato único (veículo, lote, leilão, data, local, preço, fotos) e são deduplicados.
3. Monitores do usuário ("VW Fox 2011–2013 até 150 km de São Carlos") geram alertas.
4. Um clique leva o lote para o Tracker, já preenchido. Lance e resultado passam a ser atualizados pelo coletor.
5. As estimativas (preço provável e limite estimado) saem **dos dados do próprio sistema**: arremates observados e análises do usuário.

**Único passo manual por princípio: fixar a análise.** A fixação registra a decisão do usuário antes do resultado. Se o sistema fixasse sozinho, o indicador mediria a fórmula, e não o usuário. O sistema prepara tudo e o usuário revisa e fixa.

## 2. Primeira fonte: Leilo (levantamento de 2026-09-27)

**Regra para novas fontes (decisão do usuário, 02/10/2026): a fonte precisa dar o preço final dos lotes vendidos**, lido depois do encerramento (página, lista ou consulta). Fonte que só mostra o desfecho, ou cujo preço só se aproxima pelo último lance visto, não é implementada: o preço final alimenta resultados e estimativas.

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` | `Allow: /` para todos, com sitemap | Coleta permitida pelo site |
| Regulamentos (cadastro, participação, privacidade) | Nenhuma cláusula contra robôs, raspagem ou extração | Sem impedimento explícito; manter coleta moderada |
| Descoberta | `sitemap-lotes.xml` lista os lotes abertos (617 no dia) com `lastmod` | Coleta **incremental**: só baixa lote novo ou alterado |
| Dados do lote | Página renderizada no servidor com o **estado completo em `window.__INITIAL_STATE__`** (situação, lance e nº de lances, início e fim, pátio, **código e nome FIPE**, **valor de mercado**, km, anos, **custos**: comissão %, despachante, remoção, depósito) e **JSON-LD `Vehicle`** (núcleo: marca, modelo, ano, km, lance, fim, fotos) | Adaptador lê o estado da página validado com Zod e usa o JSON-LD como reserva. Sem seletores CSS (as classes têm versão no nome, ex. `…-julho2026`) e sem navegador automatizado |
| Localização | Cidade/UF e endereço do pátio no JSON-LD | Distância calculada pela cidade (base do IBGE) |
| Resultado após o leilão | A **página do lote continua no ar** depois do fim, mas o lote **sai do sitemap**. No JSON-LD: `availability` vira `SoldOut`, `offers.price` é o **lance final** e `availabilityEnds`, a hora real do encerramento. Na página: "Vendido", "Lance Final · 4 lances · R$ 23.900,00" (lote 64, 21/09/2026, confirmado) | O coletor **guarda o link na descoberta e revisita o lote depois do fim** para registrar o arremate. "Leilões realizados" não serve: leva à próxima edição do evento |
| Desfechos (2026-09-28) | Situações vistas depois do fim: `Pago` e `AgPagamento` (vendido; aguardando pagamento), `Condicional` (lance à espera do vendedor, mesmo acima do mínimo), `CondicionalNegada` e `NaoArrematado` (não vendido). A página de lote encerrado **sem venda pode sair do ar** (HTTP 404), como aconteceu com a condicional negada e com lotes que ainda constavam como abertos | Mapeadas em `STATUS_BY_SITUACAO` com fixture de cada uma. Condicional é revisitado até o desfecho. 404 depois do fim encerra a revisita sem contar como falha (aberto vira desconhecido); `npm run db:reparse` reaplica o mapeamento a partir do dado bruto guardado |
| Custos e valor de mercado da fonte | Ex. lote 64: valor de mercado R$ 41.247, comissão 5% (R$ 1.195), despachante R$ 50, remoção R$ 400, depósito R$ 2.350 | Entram no rascunho de "Adicionar à análise" como **sugestão rotulada com a fonte** (D-30); nunca como estimativa do sistema (D-28) |

### 2.1 Segunda fonte: Pátio Estadual São Carlos (levantamento de 2026-09-30)

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | Não há `robots.txt` (a URL cai numa página de "não encontrada"). Os termos de uso não falam de robôs, mas o rodapé avisa que "cópia ou reprodução não autorizada" pode gerar penalidades, e o site bloqueia copiar e o botão direito | Uso **privado**, sem republicar: fotos por link (D-29), volume baixo (cerca de 10 requisições por execução para a descoberta, mais 3 por lote lido: a página, a consulta de situação e o edital; só lotes novos, revisitas vencidas e lotes acompanhados são lidos), coleta identificada. Aprovado pelo usuário ciente do aviso; pausa em `sources.active` |
| Descoberta | Sem sitemap. Listas por categoria em `/lotes/?cate[]=N&pag=P` (40 por página, paginação a partir de 0; a primeira página aponta a última). Coletadas: 1 veículos e 2 motocicletas. A lista mantém lotes encerrados há semanas | Descoberta lê as listas e consulta a situação de todos de uma vez; só entram abertos e encerrados há até 3 dias |
| Dados do lote | A página traz a ficha "Informações do bem" em texto livre (`Rótulo: valor`, que muda de leilão para leilão: "Ano Modelo" ou "Ano do Modelo", "Valor FIPE" ou "Tabela FIPE"), fotos e comissão. **Lance, situação e datas não estão na página**: vêm da consulta interna `atualizar_leiloes.php` (POST), a mesma que o site usa para atualizar a tela, que responde por vários lotes de uma vez | `fetchListing` junta a página com a consulta. Rótulos conhecidos viram campos; o resto vai para a descrição. Apelido de quem deu lance é descartado |
| Situações | 0 em breve, 1 aberto, 2 arrematado, 3 não arrematado, 10 condicional, 20 venda direta (textos do próprio site) | 2 → vendido, 3 → não vendido, 10 → condicional; venda direta fica sem mapa (desconhecida após o fim) |
| Local | O "local" da consulta é a origem do comitente (ex.: "Curitiba, PR"), não onde o veículo está. O endereço de visitação só aparece no edital do lote (`/views/edital.php?lote={id}`, "Endereço Pátio: …, cidade, ESTADO, CEP"); nos lotes conferidos em 01/10, todos em São Carlos | Local lido do edital (estado por extenso vira UF); o da consulta é ignorado. Edital fora do ar ou fora do formato → local desconhecido, sem distância, nunca adivinhado. Corrigido em 01/10/2026 |
| Página após o fim | Continua no ar por alguns dias e depois responde 200 com "Nenhum Lote Encontrado" | Tratado como página fora do ar (`gone`); a revisita 1 h após o fim grava o arremate antes disso |

### 2.2 Terceira fonte: Freitas Leiloeiro (levantamento de 2026-10-01)

Implementada em 01/10 (etapa 7, D-40). **Bloqueada para o GitHub Actions** (02/10): do computador do usuário o site responde normal, mas todas as execuções agendadas falharam ("fetch failed", depois pedidos pendurados), o que aponta para bloqueio de endereços de datacenter. Fonte pausada (`sources.active = false`) até haver outro lugar de onde coletar; a falha travava a coleta inteira (D-41). Ajustes vistos na implementação: a página do lote **dá erro 500 depois de VENDIDO, CONDICIONAL e RETIRADO** (só SEM LICITANTES e BAIXA OFERTA seguem no ar), mas o cartão da lista (`/Leiloes/ListarLotes`) continua com o desfecho e o último valor, e as fotos (`/Leiloes/ListarFotosLote`) seguem disponíveis. Monta, pátio e tipo vêm dos filtros da própria lista (`Condicao`, `PatioId`, `TipoLoteId`); pátios conhecidos: 1 Utinga, 2 Santo André, 3 Santa Bárbara. BAIXA OFERTA não tem desfecho correspondente e fica desconhecida. Outras fontes ainda não avaliadas estão em [`FONTES-PENDENTES.md`](FONTES-PENDENTES.md).

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | Não há `robots.txt` (404). Não há página de termos de uso; privacidade, "Como funciona" e Dúvidas não falam de robôs, extração ou cópia | Mesmo regime do Pátio: uso privado, volume baixo, coleta identificada, pausa em `sources.active` |
| Acesso sem navegador | Sem anti-robô. Pedidos simples com o `User-Agent` do coletor (lista de leilões, lotes de um leilão, página do lote e consulta de lance) responderam 200 com o dado (teste de 01/10) | Cabe na `SourceHttp` atual, sem navegador |
| Descoberta | Site ASP.NET com HTML no servidor. `/Leiloes/ListarLeiloes` lista a agenda (imóveis, materiais e judiciais misturados); `/Leiloes/Lotes?leilaoId=N` lista os lotes. Em 01/10: Pátio Utinga (Santo André/SP) com 300 lotes em 02/10 e 6 em 06/10; Pátio Santa Bárbara (Santa Bárbara d'Oeste/SP, ~110 km) com 80 em 07/10 | Descoberta filtra os leilões de veículos pelo título ("PÁTIO … VEÍCULOS") |
| Dados do lote | `/Leiloes/LoteDetalhes?leilaoId=N&loteNumero=M`: título "MARCA MODELO – ano/ano", descrição, data e hora, comissão (5%), despesas operacionais (R$ 2.350), endereço de retirada, condição em texto (sinistrado, sucata) e fotos em `cdn3.freitasleiloeiro.com.br`. **Sem valor de mercado (FIPE) e sem km** nos lotes vistos | Estimativa só por comparáveis de venda, sem a proporção do valor de mercado. Condição pelo extrator comum |
| Lance | Consulta à parte `/Leiloes/RetornarMaiorLanceLote` (HTML com `hdMaiorLance`, data e apelido de quem deu o lance) | Apelido descartado |
| Resultado | (Corrigido na implementação, ver acima.) A página do lote **continua no ar depois do fim** com o desfecho (VENDIDO, SEM LICITANTE, CONDICIONAL, RETIRADO), e a consulta de lance mantém o último valor (ex.: leilão 8074, lote 1, condicional a R$ 1.500) | Arremate automático pelo cartão da lista; a página do lote só é pedida enquanto ele está aberto. Lote fora da lista é página fora do ar |
| Dados pessoais | A descrição às vezes traz placa completa, chassi e Renavam | Placa, chassi e Renavam **apagados da descrição** antes de gravar (decisão do usuário, 01/10) |

### 2.3 Fontes avaliadas e descartadas

| Fonte | Data | Motivo | Para reabrir |
| --- | --- | --- | --- |
| Copart (`copart.com.br`) | 01/10/2026 | `robots.txt` libera tudo e os termos de membro (cl. 47) permitem uso pessoal não comercial, e a busca usa uma API JSON rica (lance, valor de referência, monta, sinistro, pátio). Mas o site está atrás do **Imperva/Incapsula**: pedido simples recebe a página de desafio em JavaScript (sitemap) ou erro (API). Passar exigiria navegador automatizado ou reaproveitar sessão, o que é contornar a proteção | Autorização ou API oficial da Copart |
| Sodré Santoro (`sodresantoro.com.br`) | 01/10/2026 | `robots.txt` libera tudo e a busca (`POST /api/search-lots`, consulta Elasticsearch repassada) traz dados excelentes, inclusive custos do lote. Mas um firewall responde **403** a qualquer pedido fora do navegador, até à página de termos (teste de 01/10). Além disso, os lotes vendidos somem do índice da busca e a página do lote encerrado não mostrou o desfecho | Liberação de acesso pela Sodré |
| Loop Leilões (`loopleiloes.com.br`) | 01/10/2026 | `robots.txt` libera tudo e as Condições Gerais não falam de robôs. A busca (`api.loopleiloes.com.br/search/leilao`) responde a pedido simples e devolve tudo de uma vez, mas sem FIPE, custos, condição nem pátio de retirada. A página do lote, que tem esses dados, fica atrás do **desafio anti-robô da Vercel** (429 com `X-Vercel-Mitigated: challenge`, até no `robots.txt`). A API de detalhe exige um token que não foi emitido para nós. Lotes encerrados somem da busca e a página não mostra o valor final. Em 01/10, nenhum lote em leilão a menos de ~150 km de São Carlos (só 46 loteados, o mais perto em Jundiaí) | Acesso liberado às páginas e pátio no interior de SP |
| Superbid (`superbid.net`) | 01/10/2026 | `robots.txt` barra só as páginas de categoria (`Disallow: /categorias/[...categoryId]`); os termos estão num PDF que não foi lido. A API `offer-query.superbid.net/offers/` é a mais rica de todas (filtro por cidade, coordenadas, comissão, ~4.800 lotes abertos até ~150 km de São Carlos e encerrados desde 2013), mas o **Cloudflare Bot Management** responde 403 com desafio a pedido simples, tanto na API quanto na página do lote. A API também devolve o lance final que a página esconde de quem não está logado | **Retomada em 10/10**: a API passou a responder sem desafio, daqui e do GitHub Actions. Virou a sétima fonte (§2.11, D-58) |
| Zuk (`portalzuk.com.br`) | 02/10/2026 | `robots.txt` libera o que a coleta usaria (barra `/ajax-lote*` e `/ajax-modal*`) e o HTML vem do servidor, sem desafio. Mas o foco é imóvel: **~30 veículos abertos no país** (14 em Ipojuca/PE, os demais em São Paulo, Santo André e 1 em Bebedouro). Não existe lista de veículos encerrados (404) e os ids vizinhos dos lotes de veículo dão 404, então não foi possível confirmar o **preço final** em veículo; no imóvel encerrado a página mostra "Vendido · em 2º leilão pelo valor de R$ X" | Volume de veículos no raio e um veículo encerrado com o preço visível |
| Chui Leilões (`chuileiloes.com.br`) | 02/10/2026 | Pátio municipal de Campinas (Emdec), ~90 km. `robots.txt` libera tudo e a página responde a pedido simples, mas é uma **loja da plataforma Superbid** (S4B Digital): o HTML é só a casca da aplicação e os lotes vêm de `offer-query.superbid.net` e `event-query.superbid.net`, que respondem 403 com o desafio do **Cloudflare** (como na Superbid); `api.s4bdigital.net` exige `client_id`. Termos não lidos, por não haver acesso possível | **Coberta pela fonte Superbid desde 10/10 (D-58).** A loja (id 16305) usa a mesma API, agora acessível; o filtro de descoberta do Superbid já traz os 326 lotes abertos dela (212 carros, 114 motos), sem adaptador próprio |

### 2.4 Candidata: Sumaré Leilões (levantamento de 2026-10-02)

Ainda não implementada; precisa de aprovação para virar etapa. Primeira da ordem da triagem em [`FONTES-PENDENTES.md`](FONTES-PENDENTES.md).

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | Não há `robots.txt` (404) nem sitemap. Os termos de uso tratam de cadastro, lances e pagamento; não falam de robôs, extração ou cópia | Mesmo regime do Pátio e da Freitas: uso privado, volume baixo, coleta identificada, pausa em `sources.active` |
| Acesso sem navegador | Laravel com HTML no servidor, sem anti-robô (nginx). ~150 pedidos simples com o `User-Agent` do coletor em 02/10, todos 200 | Cabe na `SourceHttp` atual, sem cookie: a paginação também aceita `GET` (`?pagina=N`, 50 lotes por página) |
| Descoberta | A página inicial lista os leilões em andamento (`/leiloes/{id}`), misturados: Detran-SP, prefeituras, PRF, Fundo Social e varas judiciais (imóveis e bens diversos). Em 02/10: Detran-SP com 254 conservados (fecha 16/10), 555 sucatas aproveitáveis (20/10) e 1 sucata inservível, todos no **pátio do Tremembé, São Paulo/SP** (~230 km); veículos de prefeituras em Ouro Verde, Santo Anastácio, Osasco e João Pinheiro/MG; PRF no ES. **Nenhum lote de veículo até 150 km de São Carlos** (Jaboticabal e Araraquara têm só terrenos). Os leilões do Detran-SP no interior citados no levantamento não estavam na agenda | Descoberta filtra os lotes de veículo pelo título ("MARCA/MODELO, AA/AA"); o valor depende de a Sumaré voltar a ter leilões do Detran-SP no interior |
| Dados do lote | `/lotes/{uuid}`: título "MARCA/MODELO, AA/AA", situação documental ("COM DIREITO A DOCUMENTO/CIRCULAÇÃO", "SUCATA PARA DESMONTE", "INSERVÍVEL"), cor, combustível, local de visitação com cidade/UF, data de fechamento, lance inicial, lance atual, incremento e fotos em `sumares3.s3.sa-east-1.amazonaws.com`. **Sem km, sem valor de mercado; comissão e despesas só no edital em PDF** | Condição pela situação documental (sucata → salvage). Comissão pelo padrão da análise. Estimativa só por comparáveis |
| Lance | Lance atual na própria página do lote; nenhum dado de quem deu o lance | Nada a descartar |
| Resultado | O lote **vendido sai da lista do leilão**, mas a página dele continua no ar com "Vendido (data)" e o lance final; "Sem Licitante" fica na lista com lance 0 (conferido no leilão de Caieiras de 01/10 e no de Osasco de jan/2026). Leilão antigo removido redireciona (302) | Revisitar o anúncio pela URL guardada, como no Leilo; sair da lista não é `gone` |
| Dados pessoais | Placa e chassi já vêm mascarados pelo site ("ESE****8", "***…079") | Redação comum (D-40) por garantia |

### 2.5 Candidata: Rico Leilões, plataforma Soleon (levantamento de 2026-10-02)

**Não implementada** (02/10): o preço final some depois do leilão, e a regra do §2 exige o preço final. Fica como candidata caso a plataforma passe a mostrá-lo. **Mesmo resultado no resto da plataforma (conferido em 02/10):** a Guariglia (veículos de financeira em Caçapava/SP) mostra "Vendido · ENCERRADO" só com o lance inicial; a Benozzati (Polícia Civil de Araçatuba e Praia Grande) mantém o maior lance visível depois do fim, mas o lote fica em "Fechado para Lances" sem nunca dizer se foi vendido (leilão de 21/08 ainda assim em 02/10); a Calil só tinha imóveis entre os encerrados, sem lote vendido para conferir. Nenhuma das três atende à regra. A plataforma Soleon também serve Benozzati, Calil e Guariglia ([`FONTES-PENDENTES.md`](FONTES-PENDENTES.md)); um adaptador pode valer para os quatro, se as páginas forem iguais.

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | `robots.txt` barra só `/painel`, `/auditorio`, `/licitante`, `/bloqueio` e `/comitentes`. Não há página de termos de uso (só política de cookies) | Mesmo regime das outras fontes; nada do que a coleta usa está barrado |
| Acesso sem navegador | HTML no servidor, Cloudflare sem desafio. ~80 pedidos simples com o `User-Agent` do coletor em 02/10, todos 200 | Cabe na `SourceHttp` atual |
| Descoberta | A página inicial lista os leilões atuais (`/leilao/{id}/lotes`, 30 lotes por página, `?page=N`); `/leiloes/encerrados` lista os encerrados. Em 02/10, ~1.500 lotes abertos: Detran-SP (pátio de Tatuí, ~200 km), DMI (Mogi das Cruzes), prefeituras de Indaiatuba (~150 km), São José dos Campos, Poloni e Jarinu. Encerrados recentes **perto de São Carlos**: prefeituras de Nova Europa, Araraquara e Dourado e RP Mobi (Ribeirão Preto) | A fonte com mais leilões no raio, mas espaçados (prefeituras e RP Mobi) |
| Dados do lote | O **cartão da lista** já traz marca/modelo, placa mascarada, ano/modelo, cor, combustível, descrição, local de exposição (endereço e cidade/UF), situação e maior lance. A página `/item/{id}/detalhes` acrescenta situação documental ("CONSERVADO (COM DIREITO A DOCUMENTO)", "SUCATA APROVEITÁVEL", "MOTOR INSERVÍVEL"), **comissão (5%) e despesas (R$)**, lance inicial, incremento, encerramento, observações e fotos em CloudFront (`d289au1mr74r1o.cloudfront.net`). **Sem km, sem valor de mercado** | Condição pela situação documental e pelas observações (remarcação, motor). Custos reais na análise |
| Lance | Maior lance, data e os últimos lances com **apelido mascarado** ("a*****p") | Apelido descartado |
| Resultado | Os leilões encerrados **mantêm todos os lotes na lista** com o desfecho (Vendido, Sem Lance, Cancelado). Mas **o valor final some** quando o leilão termina: a página do lote, o cartão e o relatório de lances mostram só o lance inicial. Durante o leilão, "Vendido" já aparece em lote com lance que garante a venda, com o maior lance visível | **Desfecho automático sim, preço final não.** O preço só vem do último lance visto antes do encerramento, que pode estar abaixo do final (lances nos últimos minutos, com prorrogação) |
| Dados pessoais | Placa mascarada pelo site; apelidos mascarados nos lances | Apelidos não são guardados; redação comum (D-40) por garantia |

### 2.6 Candidata: Mega Leilões (levantamento de 2026-10-02)

Ainda não implementada; precisa de aprovação. **Passa na regra do preço final.**

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | `Allow: /`, barra só `/login`, com sitemap. O regulamento trata de venda, pagamento e impedimentos legais; não fala de robôs, extração ou cópia | Mesmo regime das outras fontes |
| Acesso sem navegador | HTML no servidor (Yii), Cloudflare sem desafio. ~20 pedidos simples com o `User-Agent` do coletor em 02/10, todos 200 | Cabe na `SourceHttp` atual |
| Descoberta | `/veiculos?pagina=N` (carros, motos, caminhões); a URL do lote traz tipo, UF e cidade (`/veiculos/motos/sp/porto-ferreira/...-j128513`). Em 02/10: **~75 lotes de veículo no país**, quase todos **judiciais** (75) e 4 de venda direta; 17 sem cidade informada, 14 em Tatuí. Perto de São Carlos: 1 em Porto Ferreira (~50 km), 1 em Americana, 1 em Amparo, 1 em Campinas | Volume pequeno e de leilão judicial (veículo com o depositário, débitos e restrições judiciais) |
| Dados do lote | Valor inicial (e o da 2ª praça), **valor de avaliação** (referência de mercado), datas das praças, número de lances, localização com endereço e cidade, descrição do cartório (marca, modelo, ano, cor, combustível, débitos, restrições). **Sem km**; comissão de 5% na tabela de lances. A página também traz processo, vara, **autor e réu (nomes de pessoas)** e, na descrição, placa, chassi e Renavam completos | Valor de avaliação como valor de mercado rotulado (D-30). **Nomes das partes e número do processo não são guardados**; placa, chassi e Renavam apagados (D-40) |
| Lance e resultado | Depois do encerramento a página continua no ar com "Leilão encerrado R$ X" (o maior lance), o número de lances e a **tabela completa de lances** (valor, comissão, data; usuário mascarado, "vit*/*/*/*"). Na lista `/leiloes-realizados` o cartão diz "Finalizado" e o vendido ganha o selo "ARREMATADO" (ex.: Gol 2006 em Artur Nogueira, 3 lances, final R$ 10.961,50) | **Preço final disponível.** Usuários dos lances descartados. Arrematação judicial ainda depende do juiz; tratar "ARREMATADO" como vendido |

### 2.7 Candidata: plataforma Suporte Leilões (Leilão Brasil, Leilões PB, Gustavo Reis; levantamento de 2026-10-02)

Ainda não implementada; precisa de aprovação. **Passa na regra do preço final.** Os três sites usam a mesma plataforma (fotos em `static.suporteleiloes.com.br`), então um adaptador valeria para os três.

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | Leilões PB: só os comentários de "content signals" do Cloudflare, sem regra nem sinal definido. Leilão Brasil e Gustavo Reis: sem regras. Termos de uso (`/termos-uso`) não lidos a fundo | Sem restrição declarada; ler os termos antes de implementar |
| Acesso sem navegador | HTML no servidor (Symfony), Cloudflare sem desafio; ~60 pedidos simples em 02/10, todos 200 | Cabe na `SourceHttp` atual |
| Descoberta | Um **evento por bem** (`/eventos/leilao/{id}/{slug}/lote` redireciona ao lote `/eventos/leilao/{slug}/lote/{loteId}/{slug}`; o slug pode ser qualquer texto). Na Leilão Brasil, ~40 eventos de veículo abertos, **judiciais**, espalhados (São Paulo, Guarulhos, Mauá, Limeira, Bilac, MG); encerrados listados sem link, mas com o id do evento. Leilões PB: pátios em Bayeux/PB e Feira de Santana/BA (seguradoras HDI/Yelum, bancos), **fora da região**. Gustavo Reis: 1 lote de veículo | Volume perto de São Carlos muito pequeno (Limeira, ~100 km) |
| Dados do lote | Estado do lote em **JSON embutido na página**: situação numérica, lance inicial, avaliação, número de lances, data de fechamento (fuso `America/Fortaleza`), UF; endereço do bem; processo e comitente. Leilões PB mostra "valor médio de mercado" | Avaliação como valor de mercado rotulado (D-30) |
| Resultado | Depois do fim o JSON mantém **`valorArremate`** no vendido (ex.: Renault Clio 2014/2015, R$ 8.805,10; VW Up 2014/2015, R$ 23.742,74) e `null` no sem lance | **Preço final disponível** |
| Dados pessoais | O lance traz `autor` com id, cidade, UF e apelido de quem deu o lance; o lote judicial traz número do processo | `autor` e processo descartados antes de gravar; redação comum (D-40) |

### 2.8 Candidata: Leilão Detran-MG (`leilao.detran.mg.gov.br`, levantamento de 2026-10-09)

Primeira fonte com lotes em Minas Gerais. É o sistema do próprio Detran-MG (feito pela Prodemge): o leilão roda nele, sem leiloeiro intermediário, para os pátios credenciados do estado inteiro. Ainda não implementada; precisa de aprovação para virar etapa.

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | Não há `robots.txt` (404, página de erro do CakePHP) nem sitemap. O único termo é o "Termo de Declaração de Concordância e Responsabilidade" do cadastro de arrematante: trata de lances, pagamento por DAE, retirada e transferência; não fala de robôs, extração ou cópia | Mesmo regime do Pátio e da Freitas: uso privado, volume baixo, coleta identificada, pausa em `sources.active` |
| Acesso sem navegador | HTML no servidor (CakePHP + jQuery), sem anti-robô. ~80 pedidos simples com o `User-Agent` do coletor em 09/10, todos 200 | Cabe na `SourceHttp` atual, sem cookie nem login |
| Descoberta | A página inicial lista os leilões abertos (`/lotes/lista-lotes/{leilão}/{ano}`). Cada lista traz número, município e pátio, e 8 lotes por página (`?page=N`) com id (`/lotes/detalhes/{id}`), número, condição (CONSERVADO, SUCATA), "MARCA/MODELO ano" e valor. Em 09/10: **36 leilões e ~370 páginas (~2.900 lotes) em 25 municípios de MG**: Uberlândia, Juiz de Fora, Ipatinga, Paracatu, Poços de Caldas, Andradas, Botelhos, Muzambinho, Frutal, Prata, Piumhi, Campo Belo etc. A imprensa fala em ~50 leilões e 4.300 veículos por mês. A lista do leilão encerrado redireciona (302) para a página inicial | Descoberta lê as listas e guarda id, leilão, município e pátio, porque a página do lote não traz o local. Os mais perto de São Carlos: Andradas e Poços de Caldas (~170–190 km) |
| Dados do lote | `/lotes/detalhes/{id}`: valor inicial, marca/modelo, cor, ano do modelo e de fabricação, combustível, condição e fotos (`/Imagens/visualizar/leiloes/leilao_{L}/img_{id}_{n}.jpg`). **Sem km, sem valor de mercado e sem comissão**: a venda é do Estado, paga por DAE, sem comissão de leiloeiro; o edital (PDF) não cobra taxa além do lance. A "Tabela de Veículos" (PDF) traz a avaliação de cada lote, mas também placa, chassi e motor completos | Condição pela coluna (SUCATA → salvage). Comissão zero. Não ler a Tabela de Veículos (dados pessoais); a avaliação é o valor inicial da página |
| Lance e fim | Consulta interna `GET /PDO/updateCountdown.php?data[]={id}&data[]=…` (a mesma que a tela usa a cada segundo), vários lotes por pedido: `valor`, `valorIncremento`, `status`, `tempo` (segundos até o fim) e `arrematante` (CPF/CNPJ **já mascarado**: "xxx.xxx.xxx-xx") | Fim = hora do pedido + `tempo`. `arrematante` descartado |
| Resultado | Depois do fim a consulta **continua respondendo com o valor final**, inclusive em lotes antigos (ids 200000, 250000, 270000, 285000, 290000 e 293000 em 09/10). Situações: `1`/`2` aberto, `3` encerrado (com `valor` e arrematante = **vendido**, ex.: lote 280000, VW Gol 1000i, R$ 3.800; com `valor` nulo = **sem lance**), `4` cancelado, `5` encerrado (visto só no script). A página do lote encerrado continua no ar (200) | **Preço final disponível** (regra de 02/10 atendida). Revisita pela consulta interna, que responde por dezenas de lotes num pedido |
| Dados pessoais | Arrematante mascarado pelo próprio site. O nome do pátio às vezes é pessoa física com CPF completo ("DEYVID ALAN COSTA CPF 089…") | Nome do pátio só como texto com CPF apagado pela redação comum (D-40), ou descartado; o local é o município do leilão |

### 2.9 Quinta fonte: Leilão Online, plataforma Tellks (`leilaoonline.com.br`, levantamento de 2026-10-09)

Leiloeiros oficiais da JUCESP (Ricardo Miranda de Souza, 886; Eduardo Jordão Boyadjian, 464 e 1447) com leilões de carros, caminhonetes e caminhões **várias vezes por semana**, veículos em **São Paulo/SP e Leme/SP** (~70 km de São Carlos). Implementada em 09/10 (etapa 8, D-50). **Passa na regra do preço final.** A Rossi Leilões (`rossileiloes.com.br`, Ugo Rossi Filho, JUCESP 394) roda outra instância da mesma plataforma (mesmas rotas e páginas, outra base de leilões, hoje mais imóveis e caminhões): um adaptador valeria para as duas.

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | Não há `robots.txt` (404, cai na página inicial). Os Termos de Uso (`/termos-de-uso`) tratam de cadastro, lances, condicional, comissão de 5%, pagamento e retirada; não falam de robôs, extração ou cópia | Mesmo regime do Pátio e da Freitas: uso privado, volume baixo, coleta identificada, pausa em `sources.active` |
| Acesso sem navegador | HTML no servidor (PHP + jQuery), sem anti-robô. ~90 pedidos simples com o `User-Agent` do coletor em 09/10, todos 200. A tela faz um `POST /lote/ContabilizarVisita/{id}` por JavaScript, que o coletor não executa | Cabe na `SourceHttp` atual, sem cookie nem login. **Testar do GitHub Actions** antes de implementar (a Freitas, também de São Paulo, bloqueia datacenter) |
| Descoberta | `/leilao/LeilaoPorCategoria/1/leilao-carros` lista os leilões de veículos abertos (`/leilao/detalhe/{id}`); a página do leilão lista os lotes (`/lote/detalhe/{id}`). `/historico` lista os leilões já realizados. Em 09/10: 4 leilões abertos com **62 lotes** (41 no de 14/10, "Repasse Estrela & outros comitentes"); 7 leilões de veículos nos 10 dias anteriores, com 8 a 43 lotes cada | Descoberta lê a categoria de carros e as páginas dos leilões. Volume modesto, mas constante e com veículos de repasse e recuperados de sinistro |
| Dados do lote | `/lote/detalhe/{id}`: título "MARCA/MODELO; ano/ano; cor; combustível - FUNCIONANDO - IPVA OK - FIPE APROX.: R$ X - APROX. N KM", especificações em texto (airbag ausente, mecânica sem teste, "RECUPERADO DE SINISTRO CSV, SINISTRO MÉDIA MONTA", "LOCALIZAÇÃO PARA RETIRADA EM SÃO PAULO/SP"), lance inicial, último lance, número de lances, data do pregão (`#dataPregao`), situação (`#statusLote`), vídeo e fotos em CloudFront (`d1y4blh5egbvru.cloudfront.net/img/leiloes/{leilão}/lotes/{lote}/…`). Comissão de 5% pelos termos | Marca, modelo, anos, km e FIPE aproximada do título (FIPE como valor de mercado rotulado, D-30). Condição pelo extrator comum (média monta, sinistro). Cidade pela frase de retirada; sem ela, local desconhecido |
| Lance | Último lance, número de lances e a tabela dos últimos lances com **apelido mascarado** ("Gi\*\*\*na") | Apelido descartado |
| Resultado | A página do lote **continua no ar depois do fim** com "Pregão encerrado", o último lance e a situação. Situações vistas: `1` aberto ("Aguardando"), `3` **Vendido**, `4` **Venda condicional** (logo depois do pregão, à espera do comitente, até 5 dias úteis), `5` **Não vendido**. Ex.: lote 336589 (leilão de 06/10) Vendido a R$ 65.000; lote 336489 (07/10) Vendido a R$ 17.000; leilão de 09/10 com 5 condicionais. Leilões de 30/09 e 07/10 já sem condicional | **Preço final disponível** (regra de 02/10 atendida): no Vendido, o último lance é o preço final. Condicional é revisitado até virar Vendido ou Não vendido, como no Leilo. **Taxa de venda baixa** (2 vendidos em ~30 lotes conferidos): a maioria volta em leilão seguinte, então a base de arremates cresce devagar |
| Dados pessoais | Apelidos mascarados pelo site; não se viram placa, chassi nem nomes nos lotes conferidos. Comitente às vezes "P. FÍSICA", sem nome | Redação comum (D-40) por garantia |

### 2.10 Sexta fonte: leilões do Detran-SC na plataforma Astavero (levantamento de 2026-10-10)

O Detran-SC faz uns **17 leilões por ano**, cada um com um leiloeiro credenciado do rodízio, de ~450 a ~750 lotes, com pátios no estado todo (São José, Lages, Palhoça, Imbituba, Laguna, Rio Negrinho…). Quatro leiloeiros do rodízio usam a mesma aplicação, a **Astavero** (Maxter, Krobel, Deltta e Damiani): um adaptador cobre os quatro. Implementada em 10/10 (etapa 9, D-57). **Passa na regra do preço final.**

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | Não há `robots.txt` (a aplicação devolve a página inicial). Termos de uso não lidos | Mesmo regime das outras fontes: uso privado, coleta identificada, pausa em `sources.active` |
| Acesso sem navegador | Aplicação Angular com API JSON própria, sem login e sem anti-robô. A API aceita formulário (`application/x-www-form-urlencoded`), como a `SourceHttp.post` envia | Cabe na `SourceHttp` atual, sem mudança no coletor |
| Descoberta | `POST /app/lotes` sem parâmetros devolve **todos os lotes abertos do site** numa resposta (745 na Maxter em 10/10, 740 do Detran), com leilão, lote e comitente ("DEPARTAMENTO ESTADUAL DE TRÂNSITO") | Uma requisição por site; fica com os lotes do Detran. Total anunciado maior que a lista deixa a descoberta incompleta |
| Dados do lote | `POST /app/pregao/lote` com o id do lote (~13 KB): nome ("AUTOMÓVEL FIAT/PALIO EX Ano: 2001/2002"), ficha (placa, motor, chassi), avaliação do Detran (= lance inicial), incremento, comissão de 5%, pátio (nome, cidade, endereço), datas (abertura, pregão, fechamento), fotos e lances. Id desconhecido volta `{"lote": null}`; id fora do formato do MongoDB faz a API esperar 30 s e responder 504 | Tipo do nome vira categoria (sucata → Sucatas e dano "sucata"); marca e modelo pelo formato do registro (`shared/detran-vehicle.ts`, o mesmo do Detran-MG). Avaliação não é valor de mercado: a FIPE casa (D-47) |
| Resultado | Depois do pregão o lote continua na API com a situação e os lances. Leilão 14/2026 (Krobel, 21/09): 463 lotes, 455 **Vendido**, 5 **Retirado** (com o motivo), 3 **Sem oferta**. Ex.: lote 7945, Fiat Palio 2001/2002, avaliação R$ 2.550, **vendido a R$ 6.150** depois de 13 lances. Situações da tela: Aberto, Pregão, Venda direta (aceitam lance), Vendido, Sem oferta, Retirado | **Preço final disponível**: o maior lance do vendido. Vendido sem lance fica desconhecido |
| Dados pessoais | Cada lance traz **nome, CPF, apelido e IP** de quem deu o lance; o lote traz o dono do veículo (`w`) e a ficha traz placa, motor e chassi | Só o valor de cada lance é lido; `w` e o comitente não são lidos; linhas de placa, motor, chassi e Renavam saem da ficha antes do `raw` (D-40). Nas fixtures, os campos de quem deu lance viram `[removido]` e placa, motor e chassi viram valores fictícios |
| Cobertura | Os outros leiloeiros do rodízio usam leilao.pro (Só Leilões, Moresco: também com preço final), Soleon (Machado, Nogari: sem preço final) e uma plataforma não analisada (Hoppe) | Só os leilões dos quatro sites Astavero entram; os demais ficam em `docs/FONTES-PENDENTES.md` |

### 2.11 Sétima fonte: Superbid Exchange (`exchange.superbid.net`, levantamento de 2026-10-10)

Marketplace nacional de leilões corporativos e judiciais (seguradoras, locadoras, bancos, empresas, prefeituras), com **7.461 lotes abertos** em Carros & Motos em 10/10 e 227 mil encerrados no histórico. Implementada em 10/10 (etapa 10, D-58), com carga avulsa dos encerrados dos últimos 30 dias e descoberta pelo fim mais próximo (D-60). **Passa na regra do preço final.** Aprovada como fonte pelo usuário em 10/10, ciente do `robots.txt` abaixo.

| Item | Achado | Consequência |
| --- | --- | --- |
| `robots.txt` e termos | O site tem `Disallow: /categorias/[...categoryId]`: é o modelo de rota do Next.js, que não casa com nenhuma URL real, mas sinaliza que a lista por categoria não é desejada. A API (`offer-query.superbid.net`) não tem `robots.txt` (404). Sitemap quebrado (aponta para `localhost:3000`). Termos de uso não lidos | A coleta usa só a API, não as páginas de categoria. Mesmo regime das outras fontes: uso privado, coleta identificada, pausa em `sources.active` |
| Acesso sem navegador | **Em 01/10 a mesma API respondia 403 com o desafio do Cloudflare** (§2.3); em 10/10 não. O site é Next.js e a página já traz os lotes no `__NEXT_DATA__`, mas a **API JSON pública** que o site usa responde sem login, cookie ou token. As páginas têm o script passivo da Cloudflare, que não bloqueou; a API nem passa por ela. **Testado do GitHub Actions em 10/10**: lista, oferta e API com 200 e conteúdo completo | Cabe na `SourceHttp` atual, sem navegador e sem dependência nova. Se o bloqueio voltar, a fonte aparece com falha no cartão de saúde e pode ser pausada em `sources.active` |
| Descoberta | `GET offer-query.superbid.net/offers/?portalId=[2,15]&locale=pt_BR&requestOrigin=marketplace&filter=…&orderBy=…&pageNumber=N&pageSize=500`. Filtro `campo:valor;campo:valor` (lista entre colchetes): `product.productType.id:10` (Carros & Motos), `statusId:1` (abertos) ou `statusId:[3,6,7,11,80]` (encerrados), `auction.id:N`, `id:[a,b,…]` (lote a lote, para revisitar). **Só `orderBy=id:desc` ordena de fato** (`endDate:desc` é ignorado e `endDateTime` dá 503); filtro por intervalo de datas não funcionou. Total limitado a 10 mil na API de eventos. `fieldList=campo;campo` deixa só os campos pedidos: a página de 500 com id, fim e gerenciador tem ~80 KB, contra ~1,6 MB por 100 ofertas completas. A paginação para em 10 mil resultados (página 21 em diante dá erro) | Abertos: `statusId:1` paginado. Encerrados recentes: `id:desc` até a página em que todos os lotes terminaram há mais de N dias (300 mais novos = 281 encerrados desde 01/10). Revisita dos condicionais e transitórios por `id:[…]`. Sempre com `fieldList`. A categoria 10 inclui **cotas de consórcio**, que precisam ser descartadas pelo tipo ou pela descrição |
| Dados do lote | `product` (descrição curta e detalhada, marca, modelo, subcategoria, local, fotos), `auction` (leilão, leiloeiro, endereço, modalidade), `offerDetail` (lance inicial, maior lance, **preço de reserva**), `store`/`seller` (comitente), datas de início e fim, número de lances e visitas | Marca, modelo, anos e km da descrição; local pelo `product.location`. Preço de reserva não é valor de mercado: a FIPE casa (D-47) |
| Resultado | O lote encerrado continua na API com `price` = maior lance; conferido no site em dois lotes (3773745: R$ 129.000; 3752797: R$ 26.500). O site mostra "Lance atual" e o selo "Encerrado" para quase tudo (o selo "Vendido" só vem com a flag `sold`, que não apareceu nos encerrados recentes), então o desfecho sai do **`statusCode`**. Nos 300 encerrados mais novos: **3** = vencedor e preço ≥ reserva (137 de 137); **7** = vencedor e preço abaixo da reserva (48 de 48), igual no histórico de 2025; **6** = sem lance (27 dos 70 com `removed`); **11** = misto (18 com vencedor, 4 acima da reserva), só nos encerrados recentes e nunca no histórico; **80** = 1 lance, sem vencedor, preço igual à reserva (raro) | `3` → vendido; `7` → condicional; `6` → retirado se `removed`, senão não vendido; `11` e `80` → **desconhecido** (nunca adivinhado), com revisita por `id` enquanto o lote estiver na janela. Se o `11` virar outro código, a revisita corrige |
| Dados pessoais | `winnerBid` traz o id e o login mascarado do vencedor ("J\*\*\*\*\*00"); a descrição traz placa final e às vezes chassi | `winnerBid` só como "tem vencedor"; id e login não são gravados. Redação comum (D-40) na descrição |

## 3. Arquitetura

```text
GitHub Actions (cron) ──► coletor (Node, mesmo repositório)
                            ├─ adaptador por fonte: descobrir URLs → baixar → extrair → validar (Zod)
                            ├─ normalizar (domain) → deduplicar → gravar observação
                            └─ casar com monitores → criar alertas
                                   │ Prisma
                                   ▼
                              Supabase (Postgres)
                                   ▲ DAL (requireUser + ownerId)
Leilão Tracker (Vercel) ── Descobertos · Monitores · Alertas · Adicionar à análise · Estimativas
```

**Camadas**, seguindo as regras atuais (ESLint aplica):

| Onde | O quê | Teste |
| --- | --- | --- |
| `src/domain/listings/` | Tipos do formato único, normalização (marca e modelo, cidade), chave de deduplicação, distância, casamento com monitor, estimativas. **Puro.** | Unitário, obrigatório |
| `src/sources/<fonte>/` | Adaptador: `discover(http)` (lista os anúncios) e `fetchListing(http, id) → ListingInput`. As requisições passam pela interface `SourceHttp` do coletor; a leitura das páginas é pura. Registro em `src/sources/index.ts` (D-37) | Unitário com **páginas salvas** em `fixtures/` e o contrato comum (`listingContractProblems`). Quando o site mudar, o teste quebra |
| `src/server/collector/` | Orquestração: rede educada, gravação, execução registrada | Integração |
| `scripts/collect.ts` | Ponto de entrada do cron | Execução a seco com fixtures no CI |
| `src/features/listings`, `watches`, `alerts` | DAL, actions e telas | Unitário e E2E |

**Rede educada:**
- 1 requisição por segundo por fonte.
- User-Agent identificado (`LeilaoTracker/1.0 (+contato)`).
- Nova tentativa com espera crescente em 429 e 5xx.
- Limite de páginas por execução.
- Só páginas públicas: nada de login ou CAPTCHA.

## 4. Modelo de dados (novas tabelas)

| Tabela | Escopo | Conteúdo |
| --- | --- | --- |
| `sources` | global | Fonte (leilo), ativa ou não |
| `listings` | **global** | Anúncio normalizado. **Única por `(source_id, external_id)`**. Guarda URL canônica (`/lote/<uuid>/`), veículo, lote, evento, início e fim, cidade, UF, município IBGE, fotos (URLs), `first_seen_at`, `last_seen_at`, `raw` (JSON original). **Desfecho na fonte:** status (aberto, vendido, condicional, não vendido…), **lance final**, nº de lances, hora real do fim e `next_check_at` (quando revisitar). Complementos da fonte: valor de mercado informado, vendedor, tipo de retomada e taxas da descrição |
| `listing_observations` | global, só inserção | Instantâneos de lance e status ao longo do tempo. Base do "último lance observado" e do histórico de preço |
| `collector_runs` | global | Início, fim, fonte, descobertos, novos, atualizados e falhas, com amostra de erros |
| `municipalities` | global, semente | Municípios do IBGE com latitude e longitude (arquivo estático versionado, sem API externa) |
| `watches` | `owner_id` | Monitor: marca, modelo, faixa de ano, preço máximo, cidade base e raio (padrão São Carlos/SP, 150 km), ativo |
| `alerts` | `owner_id` | Monitor × anúncio, **único por par**, com lido ou não e data |
| `lots.listing_id` | `owner_id` | Liga o lote do usuário ao anúncio, para atualização automática |
| `results.source` | `owner_id` | `manual` ou `collector`, para rastrear a origem do dado |

- **Deduplicação:**
  - Mesma fonte: a chave única impede duplicar. Reaparecer só atualiza o anúncio e cria uma observação.
  - Fontes diferentes, quando houver a segunda: marca, modelo, ano, cidade e data formam uma impressão digital. O caso é marcado como **"possível duplicado"** e **nunca é juntado sozinho**.
- **Segurança (D-14):** as tabelas novas seguem com RLS ativo e sem acesso pela API de dados. Só o servidor lê e grava. Catálogo global não tem `owner_id`; o que é do usuário (monitores, alertas, lotes) tem.

## 5. Estimativas com dados do próprio sistema

Nada de fórmula externa. A estimativa só aparece quando **existe base suficiente**, e sempre mostra de onde veio.

| Estimativa | Fonte | Regra |
| --- | --- | --- |
| **Preço provável de arremate** | Últimos lances observados de lotes **comparáveis** já encerrados no catálogo | Mesma marca e modelo, ano ±1, faixa de km, região e **mesma condição declarada** (sem monta informada, pequena monta, média monta, sucata; `damage_level`). Mostra **mediana e faixa (P25–P75) com o número de casos**. Com menos de 5 comparáveis: "Sem base suficiente (3 de 5)" |
| **Limite estimado** | Calculadora atual (a mesma fórmula da análise) alimentada pelos **dados do usuário**: custos das suas análises fixadas de veículos comparáveis, com a FIPE do anúncio como valor de mercado (D-36), e margem e reserva padrão | Sem análises comparáveis suficientes, não mostra limite, e sim "faça 3 análises de veículos parecidos para liberar". Nunca vira análise fixada sozinha |
| **Precisão** | Estimado × real dos lotes encerrados | Tela de aprendizado (Fase 2): quanto a estimativa errou, por modelo e origem |

Consequência honesta: **no começo não haverá estimativas.** Elas surgem conforme o coletor acumula arremates e o usuário fixa análises. A etapa 5 só começa quando houver dados.

## 6. Etapas

Cada etapa segue o fluxo da skill `leilao-padroes`:
1. atualizar SPEC e ARCHITECTURE;
2. implementar do domínio para as telas;
3. testar (unitário, fixtures e E2E);
4. rodar `npm run check` e `npm run build`;
5. revisar com o subagente `leilao-reviewer`;
6. commitar e usar a etapa por alguns dias antes da próxima.

| # | Entrega | Pronto quando |
| --- | --- | --- |
| **0** ✅ | **Decisões e fixtures.** SPEC e ARCHITECTURE atualizados. Arremate confirmado pela página do lote (§2). Desfechos mapeados com fixtures reais do leilão de 28/09 (vendido, aguardando pagamento, condicional, condicional negada, não arrematado). `Retirado` ainda não apareceu numa página real; fica mapeado pelo nome | Decisões aprovadas e uma fixture para cada desfecho conhecido |
| 1 | **Catálogo + adaptador Leilo + coletor agendado**, já **revisitando lotes encerrados** para gravar o arremate (a base das estimativas começa a crescer no primeiro dia). Tabelas `sources`, `listings`, `listing_observations`, `collector_runs` e `municipalities`. Cron de 2 em 2 horas (cabe na cota gratuita do GitHub para repositório privado). Tela **Descobertos** com filtros (marca, modelo, ano, preço, distância) e cartão "última coleta" no dashboard. **Condição declarada** pelo leiloeiro (monta, sucata, circulação vedada, remarcado, laudo cautelar…) extraída da descrição, com selos e filtro | Lotes até 150 km de São Carlos aparecem sozinhos, sem duplicar, com fotos e distância. Falha do coletor fica visível no app |
| 2 | **Monitores e alertas.** Telas de monitores (CRUD) e de alertas, com contador na navegação e seção no dashboard. Monitor usa os mesmos critérios de Descobertos, inclusive a condição. Lote que já existia ao criar, editar ou religar o monitor não vira alerta (aparece como "combinam agora"); mudança no lote não gera outro alerta | Lote novo compatível gera **um** alerta, com "Ver lote" ("Adicionar à análise" chega na etapa 3) |
| 3 | **Adicionar à análise + acompanhamento automático.** Cria leilão, lote e rascunho a partir do anúncio (sem duplicar se já existir). O coletor atualiza o lance dos lotes ligados. Entregue em 30/09 (D-34): anúncio sem marca, modelo ou ano não mostra o botão; anúncio ligado é revisitado a cada execução | Um clique leva o lote ao Tracker, e o lance atual se mantém sozinho |
| 4 | **Resultado automático** nos lotes do usuário: quando o anúncio ligado encerra, o coletor registra o resultado (desfecho, preço final, hora real) com `source = collector` e link. Desfecho ambíguo (ex.: condicional) fica como **"resultado a confirmar"**, já preenchido. Entregue em 30/09 (D-35): o formulário de "a confirmar" vem com lance, hora e link; anúncio já encerrado ao ser adicionado gera análise retrospectiva | O usuário não digita resultados; no máximo confirma |
| 5 | **Estimativas** (§5), quando houver base. Entregue em 30/09 (D-36) com dois ajustes aprovados: comparáveis de **qualquer região** e, sem 5 comparáveis, a **proporção do valor de mercado** das vendas da mesma categoria e condição | Alerta e anúncio mostram "provável R$ X (n=12) · limite estimado R$ Y" ou "sem base suficiente" |
| 6 | **Segunda fonte e coletor para várias fontes.** Entregue em 30/09 (D-37): Pátio Estadual São Carlos (§2.1), fontes em paralelo e isoladas, passos comuns uma vez por execução, contrato comum dos anúncios e categoria no vocabulário comum. Notificações externas (e-mail ou push) **saíram do escopo** por decisão do usuário: alertas só no app | Segunda fonte entra só com um adaptador novo e a entrada em `src/sources/index.ts`; falha de uma fonte aparece no app com o nome dela |
| 7 | **Terceira fonte: Freitas Leiloeiro** (§2.2). Entregue em 01/10 (D-40): leilões de pátio e veículos da agenda, monta, pátio e tipo pelos filtros do site, custos da página enquanto o lote está aberto, desfecho pelo cartão e placa, chassi e Renavam apagados da descrição | Lotes da Freitas aparecem em Descobertos com local, condição e categoria, e o arremate é gravado sem pedir a página encerrada |
| 8 | **Quinta fonte: Leilão Online** (§2.9). Entregue em 09/10 (D-50): leilões abertos da categoria Automóveis, uma página por lote com situação e último lance (vendido, condicional, não vendido), categoria pelo filtro da lista do leilão guardada no `raw`, local pela frase de retirada e FIPE aproximada do título como valor da fonte | Lotes do Leilão Online aparecem em Leilões com categoria, local e condição, e o arremate é gravado na revisita da página do lote |
| 9 | **Sexta fonte: Detran-SC na Astavero** (§2.10). Entregue em 10/10 (D-57): lotes abertos do Detran nos sites Maxter, Krobel, Deltta e Damiani (uma lista por site), o lote pela API do site com situação e lances (o maior é o preço final), categoria pelo tipo no nome e nada de quem deu lance | Lotes do Detran-SC aparecem em Leilões com pátio, categoria e sucata, e o arremate é gravado na revisita |
| 10 | **Sétima fonte: Superbid Exchange** (§2.11). Entregue em 10/10 (D-58): lotes abertos de Carros e Motos pela API JSON do site (sem navegador), a oferta pelo id em qualquer situação, desfecho pelo código da situação (vendido, condicional, não vendido, retirado; os demais desconhecidos), marca, modelo e anos da API, da ficha rotulada ou do título, e nada de quem está vencendo | Lotes do Superbid aparecem em Leilões com cidade, categoria e despesas, e o arremate é gravado na revisita |

## 7. Decisões

Aprovadas e registradas em `docs/ARCHITECTURE.md` §15: **D-25** catálogo global · **D-26** coletor no GitHub Actions com `tsx` · **D-27** adaptador por estado da página + JSON-LD · **D-28** estimativas só com dados do sistema · **D-29** fotos por URL · **D-30** dados da fonte como sugestão rotulada · **D-32** alertas criados pelo coletor · **D-34** lote ligado ao anúncio e lance automático · **D-35** resultado automático · **D-36** estimativas (região nacional e proporção do valor de mercado) · **D-37** várias fontes e segunda fonte · **D-40** terceira fonte (Freitas) · **D-48** Detran-MG · **D-50** Leilão Online · **D-57** Detran-SC (Astavero).

## 8. Riscos

| Risco | Mitigação |
| --- | --- |
| Lote vendido "condicional" ou desfecho novo | Mapeamento explícito de status com fixture; status desconhecido vira "a confirmar" e aparece no registro da coleta, nunca é adivinhado |
| Página do lote sair do ar depois de um tempo | Revisita logo após o fim (`next_check_at` = fim + 1 h, com novas tentativas); o que não for obtido fica "desfecho desconhecido" e fora das estimativas |
| Horário do cron no GitHub não é exato (atrasos de minutos) | Observação extra nas horas finais; se não bastar, servidor pequeno (D-26 prevê a migração) |
| Site muda o formato | Validação Zod aponta a falha, `collector_runs` e o cartão no dashboard mostram, e o teste com fixture reproduz |
| Volume cresce com mais fontes | Fontes em paralelo, cada uma com o seu ritmo e limite de anúncios por execução (D-37); coleta incremental (sitemap com `lastmod` ou lista + situação em lote); o job tem 20 min |
| Termos de uso mudam | Revisar a cada fonte nova; desligar a fonte em `sources.active` |
