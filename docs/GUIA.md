# Guia de uso

Como usar o Leilão Tracker no dia a dia: registrar leilões e lotes, calcular até quanto vale dar lance, preservar essa decisão e comparar com o que aconteceu de fato.

## O fluxo em uma frase

**Leilão → lote → análise → fixar → acompanhar → resultado.** Para achar lotes, o app coleta os sites de leilão e avisa quando aparece um lote que combina com o que você procura (seção 9). O dashboard mostra o que está em andamento e quantas das suas decisões ficaram dentro do limite.

## 1. Entrar

Acesse o endereço do app e entre com e-mail e senha. Não há cadastro público: contas são criadas no painel do Supabase (Authentication → Users).

**Sair** (no rodapé do menu) encerra a sessão só neste aparelho; os outros continuam conectados.

## 2. Cadastrar um leilão

Leilão que está no catálogo (seção 9) não precisa ser cadastrado: **Adicionar à análise** cria o leilão e o lote de uma vez. Para os outros, **Minhas análises → Novo leilão**.

- Obrigatórios: nome, organizador, data e hora, origem (já vem "Não informada") e status.
- Opcionais, recolhidos em *Local, links e observações*: cidade, UF, links do edital e da plataforma e observações.
- O **status é manual**. A data passar não encerra o leilão sozinho, mas a ficha avisa e oferece **Marcar como encerrado** num clique.

## 3. Cadastrar os lotes

Na página do leilão, **Adicionar lote**.

- Obrigatórios: número do lote e o veículo (marca, modelo e ano-modelo). Link, lance inicial e observações ficam recolhidos.
- **Cadastrar e analisar** salva o lote e já abre o rascunho da análise.
- O número do lote não se repete no mesmo leilão; em outro leilão, pode.
- **Lance atual:** na ficha do lote, **Atualizar lance** (ou **Corrigir lance**, num lote acompanhado no site) abre um campo ali mesmo. O app registra quando foi atualizado.
- **Acompanhar este lote:** coloca o lote no dashboard, com lance atual e seu limite lado a lado.
- **Fotos:** até 10 por lote, JPEG, PNG ou WebP até 5 MB. A primeira vira capa; dá para trocar a capa e reordenar.

## 4. Analisar o lote

Na ficha do lote, **Analisar lote**. A análise calcula o **lance máximo**: o maior lance que ainda deixa a margem que você quer.

**O rascunho já vem preenchido** com premissas padrão, de propósito pessimistas; você só revisa. *Notas* explica de onde veio cada número. Num lote cadastrado à mão, digite a FIPE e clique **Estimar a partir da FIPE** para preencher valor de venda e reparos.

| Campo | O que é | Padrão |
| --- | --- | --- |
| Valor de venda esperado | Por quanto o carro vende depois de pronto. É a base do cálculo. | FIPE − 13% sem sinistro; 20% pequena, 30% média e 40% grande monta. Sucata: em branco |
| FIPE | Base das premissas padrão. | A do anúncio: informada pelo site ou, se o site não informa, casada pelo sistema na tabela FIPE (a referência diz qual e o mês) |
| Reparos | | 5% da FIPE sem sinistro (mín. R$ 2.000; moto R$ 800); 15%, 30% e 50% por monta; + R$ 8.000 airbag acionado e + R$ 3.000 peças faltando |
| Documentação | | Despachante do anúncio, senão R$ 1.500 |
| Transporte/guincho | | Remoção do anúncio, senão R$ 300 + R$ 6/km até o pátio (linha reta × 1,3); sem local, R$ 1.500 |
| Pneus e revisão | | Carro R$ 2.400 e R$ 1.500; moto R$ 900 e R$ 600 |
| Outras taxas | | Depósito, vistoria e outras do anúncio, senão 0 |
| Comissão | Valor fixo **ou** percentual sobre o lance. | A do anúncio, senão 5% |
| Reserva para imprevistos | Dinheiro separado para surpresas, em % do valor de venda. | 5% |
| Margem desejada | Quanto você quer que sobre, em % do valor de venda. | 15% |

Reserva e margem em % acompanham o valor de venda: se você mudar o valor, elas mudam junto. Ao fixar, a análise guarda também o valor em R$. Análises antigas, feitas em R$, mostram o campo em R$ até você preencher o %.

```text
lance máximo = maior lance em que  lance + custos + comissão + reserva + margem ≤ valor de mercado
```

- **Campo em branco não vira zero.** Enquanto faltar algo, o painel lista o que falta. Se um custo não existe, digite 0.
- **Lance simulado:** teste qualquer valor e veja custo total, margem e se ficou abaixo, no ou acima do limite. Não altera o lance do lote.
- **Sem lance viável:** se os custos e a margem já consomem o valor de venda, o app avisa em vez de sugerir número negativo.
- **Salvar rascunho** guarda sem compromisso. Rascunhos podem ter campos em branco.

## 5. Fixar a análise

**Fixar análise** congela premissas, notas e o limite calculado. É o registro da sua decisão **antes** do resultado. Fixa na hora, sem confirmação; para mudar algo depois, **Revisar premissas** cria a próxima versão. Datas e fontes das referências ficam recolhidas em *Fontes e datas das referências*.

- Todos os custos precisam estar preenchidos (mesmo que zero).
- A versão fixada **nunca muda**. Para rever números, use **Revisar premissas**: nasce um rascunho novo (v2, v3…) com os dados da anterior, e a antiga continua no histórico.
- Fixe **antes do leilão acabar**. É isso que faz a análise contar no indicador do dashboard.

## 6. Registrar o resultado

Depois do leilão, na ficha do lote (ou em *Registros pendentes* no Dashboard), **Registrar resultado** abre um modal curto:

- **Desfecho:** já vem em *Arrematado*; troque para sem venda, retirado, cancelado ou "não sei". Preço final só para arrematado, já preenchido com o lance atual.
- **Data:** já vem com hoje. O horário é o do fim do lote ou do leilão quando eles caem nesse dia; assim uma análise fixada de manhã continua contando como anterior a um leilão à tarde.
- **Minha participação:** só observei, dei lance ou arrematei. É separado do desfecho: "dentro do limite" não quer dizer que você comprou.
- **Comparar com a análise** (recolhido): por padrão, a última fixada que não é retrospectiva. A comparação fica presa a essa versão, mesmo que você crie outras depois.

O resultado mostra a diferença entre o preço final e seu limite (ex.: *R$ 2.300,00 acima do seu limite*). Não é prejuízo: é só a distância entre o que o mercado pagou e o que você decidiu pagar.

**Errou algo?** **Corrigir resultado** abre o mesmo modal; o motivo é opcional. A revisão anterior continua visível em *Histórico de correções*.

## 7. Dashboard

O dashboard começa pelo que vale analisar agora e termina nas suas decisões.

- **Linha de contagens:** quantos lotes estão para analisar, o próximo leilão na região, seus acompanhados (e quantos têm o provável acima do limite) e as pendências. Cada trecho leva ao bloco.
- **Para analisar agora** (abaixo dos acompanhados, em linhas compactas): até 6 lotes abertos do filtro padrão de Leilões (até 150 km; carros, motos e utilitários) ou de um monitor ligado, que você ainda não adicionou à análise e cujo **provável lance final cabe no limite**. "Cabe com folga" quer dizer que até o valor alto da faixa cabe; "no limite", que só a mediana cabe. Primeiro vêm os lotes com vendas parecidas de verdade, depois os estimados pela proporção da categoria. O limite é o estimado pelas suas análises quando há 3 parecidas; senão, o das premissas padrão (seção 4), que é pessimista de propósito.
- **Lotes acompanhados:** pelo fim do leilão, com lance atual × seu limite e o provável lance final ao lado. "Provável acima do seu limite" é o sinal de que o lote deve escapar.
- **Próximos leilões na região:** leilões dos sites nos próximos 7 dias com lotes no filtro padrão ou nos seus monitores, quantos são e quantos cabem no limite.
- **Pendências:** rascunhos de análise abertos e lotes acompanhados cujo leilão já começou e ainda não têm resultado.
- **Indicador:** *X de Y resultados comparáveis ficaram dentro do limite*.

Por que o dashboard não compara o lance atual com o histórico: o lance sobe até o fim (dois dias antes, ainda está em cerca de 90% do final), então quase todo lote parece barato antes de encerrar.

**O que entra no indicador:** lotes arrematados, com preço final conhecido e análise fixada **antes** do resultado. Ficam de fora:

- lotes não arrematados (retirados, cancelados, sem arrematação) ou com preço desconhecido;
- análises marcadas como **Retrospectiva** (feitas já sabendo o resultado) ou com momento desconhecido.

## 8. Arquivar e excluir

- **Arquivar** (no lote, pelo menu **⋯** ao lado de Editar) tira leilão ou lote das listas e do dashboard, sem apagar nada. Veja de novo em *Mais filtros → Só arquivados*; **Reativar** traz de volta.
- **Excluir** só aparece quando não há histórico (nenhuma análise fixada nem resultado). Com histórico, arquive.

## 9. Leilões, monitores e alertas

O app coleta sozinho, de 2 em 2 horas, os lotes dos sites de leilão (hoje o Leilo, o Pátio Estadual São Carlos, a Freitas, o Detran-MG e o Leilão Online, só veículos e motos). Você não cadastra nada para isso. Os lotes de todos os sites aparecem juntos em Leilões, nos monitores e nas estimativas; o cartão diz de qual site veio cada um.

**Leilões** é o catálogo; **Minhas análises** são os lotes que você levou para análise (todos, ou agrupados por leilão em *Por leilão*), com os leilões que você cadastrou. Lá os filtros também aplicam na hora: busca, **Lance × limite** (abaixo, no limite, acima do seu limite, sem lance viável ou sem comparação), leilão próximo ou realizado e, em *Mais filtros*, análise fixada, resultado, acompanhados e arquivados. Em *Todos os lotes*, ordene por data do leilão, maior folga até o limite ou atualizados recentemente.

- **Leilões → Por leilão:** um cartão por leilão coletado, com data, total de lotes, abertos, quantos batem com os filtros e quantos você já analisou. Abrir o cartão mostra todos os lotes daquele leilão, com os que você analisou marcados.
- **Leilões → Todos os veículos:** os lotes coletados, com foto, lance, distância de São Carlos/SP, valor de mercado e **condição declarada pelo leiloeiro** (pequena ou média monta, sucata, circulação vedada, laudo cautelar…). Os filtros aplicam na hora: busca (com sugestões de marca e modelo), preço e % do valor de mercado, ano, distância e, em *Mais filtros*, categoria, combustível, quilometragem, condição, itens a esconder (circulação vedada, chassi remarcado, airbag, laudo reprovado), chave, origem, site, encerramento, lances e lotes já analisados. Cada filtro ativo vira um chip com “×”; *Limpar tudo* tira todos. *Salvar como monitor* pede só um nome e cria o monitor com os mesmos critérios, sem sair da lista (ou *Ajustar critérios antes de salvar* abre o formulário completo). Lote sem selo de condição é lote em que o leiloeiro **não informou** nada, e não uma garantia de que não há dano.
- **Valor de mercado:** o rótulo diz de onde ele vem. **"da fonte"** é o valor informado pelo site do leilão. **"FIPE out/2026"** é o valor que o sistema encontrou na tabela FIPE oficial daquele mês, para sites que não informam (Freitas, Detran-MG e parte do Leilo e do Leilão Online), casando marca, modelo, versão, ano e combustível. **"versão aproximada"** quer dizer que a versão exata não foi identificada e o valor é a mediana das versões parecidas, que custam quase o mesmo. Para lote aberto, a tabela é a do mês em que o lote apareceu; para encerrado, a do mês do fim. Esse valor entra no % do mercado, nos filtros, nos monitores, nas estimativas e na Pesquisa. Confira a versão antes de fixar uma análise.
- **Monitores:** buscas salvas. Crie em *Monitores → Novo monitor* (ou em *Salvar como monitor*, a partir dos filtros) com pelo menos marca ou modelo, um ano, uma faixa de preço ou um teto do valor de mercado (ex.: "VW Fox, 2011–2013, até R$ 25.000, até pequena monta"). O monitor usa os mesmos critérios dos filtros de Leilões. Cada monitor mostra quantos lotes abertos **combinam agora**, com link para *Todos os veículos* já filtrado.
- **Alertas:** a cada coleta, lote **novo** que combina com um monitor ligado vira um alerta (marcado **Novo**), com o contador ao lado de *Alertas* no menu e uma faixa no Dashboard. Lotes que já existiam quando você criou, editou ou religou o monitor não viram alerta (estão em "combinam agora"). Se o lance ou os dados do lote mudarem depois, não chega outro alerta: o alerta mostra sempre os dados da última coleta. *Alertas* abre nos **não lidos**; adicionar o lote à análise marca os alertas dele como lidos.
- **Desligar** um monitor para de gerar alertas sem apagar os antigos; **Excluir** apaga o monitor e os alertas dele.
- **Adicionar à análise:** no cartão do lote (em Leilões ou num alerta), cria de uma vez o leilão, o lote (já acompanhado) e um rascunho de análise **sem sair da lista**; o aviso que aparece tem **Abrir análise**. Dá para adicionar vários lotes seguidos. O rascunho vem com as premissas padrão (seção 4), usando a FIPE, a condição declarada e as taxas que o site informa, com a origem anotada em *Notas*; confira tudo antes de fixar. Clicar de novo não duplica: o cartão passa a mostrar **Ver minha análise**. Lotes do mesmo leilão do site ficam no mesmo leilão do Tracker. O botão só aparece quando o site informa marca, modelo, ano e o leilão. Se o leilão estava arquivado no Tracker, ele volta à lista.
- **Resultado automático:** quando o lote adicionado assim encerra no site, o coletor registra o resultado sozinho (arrematado com o preço final, não vendido ou retirado), com o link e a hora do fim, marcado **Registrado pelo coletor** e ligado à sua análise fixada. Sua participação fica como "acompanhei": se você arrematou, corrija o resultado (vira uma nova revisão). Venda **condicional** ou desfecho desconhecido aparecem como **Resultado a confirmar** na ficha e no Dashboard, com o formulário já preenchido; se o site confirmar depois, o resultado entra sozinho. Adicionar um lote que já encerrou cria a análise como "feita conhecendo o resultado".
- **Estimativas:** nos lotes abertos (Leilões e alertas), o cartão mostra o **provável** lance final e o seu **limite estimado**, sempre com o número de casos. O provável vem de vendas parecidas já encerradas no catálogo (mesma marca e modelo, ano ±1, mesma condição, km próxima; de qualquer região). Sem 5 vendas parecidas, usa quanto veículos da mesma categoria e condição costumam sair em relação ao valor de mercado informado pelo site. Sem nenhuma base, diz "Sem base suficiente". O limite estimado aplica a calculadora às premissas das suas análises fixadas de veículos parecidos, com o valor de venda pela FIPE do próprio anúncio (menos o desconto pela condição) e reserva e margem em % desse valor, a partir de 3 delas. Sem 3 análises parecidas, o cartão usa as **premissas padrão** (seção 4) com os dados do anúncio e diz isso. A linha **Cabe com folga**, **No limite** ou **Provável acima** compara o provável com esse limite. São referências: a decisão continua sendo a sua análise fixada.
- **Lance automático:** num lote adicionado assim, o coletor atualiza o **lance atual** a cada coleta, enquanto o lote não estiver arquivado (a ficha mostra "Acompanhado no Leilo, lido em …", com o nome do site de origem). Você ainda pode digitar um lance; ele vale até a próxima leitura do site com lance diferente.

## 10. Pesquisa

**Pesquisa** mostra em gráficos quanto se pagou nas vendas que o app coletou. É uma fotografia do que aconteceu: não diz o que comprar.

- **A medida é o % do valor de mercado:** lance final ÷ valor de mercado (informado pelo site ou casado pelo sistema na FIPE; o cabeçalho diz quantas vendas são assim, e a lista de vendas marca "FIPE" nelas). "45%" quer dizer que o lote saiu a 45% da FIPE, ou 55% abaixo dela. É a mesma medida do filtro "% do mercado" de Leilões, então dá para levar um número da Pesquisa direto para um filtro ou monitor.
- **Escolha a condição antes de comparar.** A condição pesa mais que qualquer outra coisa, por isso os gráficos nunca misturam condições. "Sem monta declarada" quer dizer que o site **não informou** a condição, e não que o veículo está inteiro: o Pátio São Carlos quase nunca informa.
- **Quanto se paga por condição:** a distribuição de cada condição, com a mediana e a faixa do meio (metade das vendas cai nela).
- **Por estado:** o mapa pinta cada estado pela mediana e escreve o valor. Passe o mouse sobre um estado para ver a mediana, a faixa do meio e o número de vendas; clique para ver o detalhe (clique de novo para voltar ao Brasil). Estado com menos de 5 vendas fica cinza, mostra só a contagem e lista as vendas uma a uma no detalhe. O estado é o do pátio. Fora de SP, cada estado vem de um site só, então a diferença entre estados é também diferença entre sites e vendedores.
- **Modelo:** escolha um modelo na busca (ou clique numa linha do ranking) para ver o mapa só dele, as vendas por ano e a lista com link para cada anúncio. Com um modelo, o mapa também mostra o lance final em R$: o mapa escreve os milhares ("38,9" é R$ 38,9 mil). Sem modelo, o ranking mostra os modelos que mais saem abaixo do valor de mercado.
- **Como o lance sobe:** quanto do lance final já estava dado 48 h, 24 h ou 1 h antes do fim. Ajuda a não achar barato um lote que ainda vai subir.

A base começa em 28/09/2026, quando a coleta começou, e cresce a cada coleta. Por isso ainda não há filtro de período.

## 11. Backup

Os dados vivem no Supabase. Faça backup **toda semana e antes de cada migration**:

```bash
npm run backup
```

Guarde a cópia fora do computador. Restauração e detalhes: [OPERACAO.md](OPERACAO.md) §5 e §6.
