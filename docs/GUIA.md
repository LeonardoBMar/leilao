# Guia de uso

Como usar o Leilão Tracker no dia a dia: registrar leilões e lotes, calcular até quanto vale dar lance, preservar essa decisão e comparar com o que aconteceu de fato.

## O fluxo em uma frase

**Leilão → lote → análise → fixar → acompanhar → resultado.** Para achar lotes, o app coleta os sites de leilão e avisa quando aparece um lote que combina com o que você procura (seção 9). O dashboard mostra o que está em andamento e quantas das suas decisões ficaram dentro do limite.

## 1. Entrar

Acesse o endereço do app e entre com e-mail e senha. Não há cadastro público: contas são criadas no painel do Supabase (Authentication → Users).

**Sair** (no rodapé do menu) encerra a sessão só neste aparelho; os outros continuam conectados.

## 2. Cadastrar um leilão

**Leilões → Novo leilão.**

- Obrigatórios: nome, organizador, data e hora, origem (Detran, seguradora, financeira, judicial…) e status.
- Opcionais: cidade, UF, links do edital e da plataforma e observações.
- O **status é manual**. A data passar não encerra o leilão sozinho: mude para *Encerrado* quando for o caso.

## 3. Cadastrar os lotes

Na página do leilão, **Adicionar lote**.

- Obrigatórios: número do lote e o veículo (marca, modelo e ano-modelo).
- O número do lote não se repete no mesmo leilão; em outro leilão, pode.
- **Lance atual:** atualize na ficha do lote (campo *Novo lance atual* → *Atualizar*). O app registra quando foi atualizado.
- **Acompanhar este lote:** coloca o lote no dashboard, com lance atual e seu limite lado a lado.
- **Fotos:** até 10 por lote, JPEG, PNG ou WebP até 5 MB. A primeira vira capa; dá para trocar a capa e reordenar.

## 4. Analisar o lote

Na ficha do lote, **Analisar lote**. A análise calcula o **lance máximo**: o maior lance que ainda deixa a margem que você quer.

| Campo | O que é |
| --- | --- |
| Valor de mercado | Por quanto o carro vale/vende depois de pronto. É a base do cálculo. |
| FIPE (opcional) | Só referência. Não substitui o valor de mercado. |
| Custos fixos | Reparos, documentação, transporte, pneus, revisão e outras taxas. |
| Comissão | Valor fixo **ou** percentual sobre o lance. |
| Reserva para imprevistos | Dinheiro separado para surpresas. |
| Margem desejada | Quanto você quer que sobre. |

```text
lance máximo = maior lance em que  lance + custos + comissão + reserva + margem ≤ valor de mercado
```

- **Campo em branco não vira zero.** Enquanto faltar algo, o painel lista o que falta. Se um custo não existe, digite 0.
- **Lance simulado:** teste qualquer valor e veja custo total, margem e se ficou abaixo, no ou acima do limite. Não altera o lance do lote.
- **Sem lance viável:** se os custos e a margem já consomem o valor de mercado, o app avisa em vez de sugerir número negativo.
- **Salvar rascunho** guarda sem compromisso. Rascunhos podem ter campos em branco.

## 5. Fixar a análise

**Fixar análise** congela premissas, notas e o limite calculado. É o registro da sua decisão **antes** do resultado.

- Todos os custos precisam estar preenchidos (mesmo que zero).
- A versão fixada **nunca muda**. Para rever números, use **Revisar premissas**: nasce um rascunho novo (v2, v3…) com os dados da anterior, e a antiga continua no histórico.
- Fixe **antes do leilão acabar**. É isso que faz a análise contar no indicador do dashboard.

## 6. Registrar o resultado

Depois do leilão, na ficha do lote, **Registrar resultado**.

- **Desfecho:** arrematado, sem arrematação, retirado, cancelado ou desconhecido. Preço final só para arrematado.
- **Data e hora do desfecho:** informe se souber. Sem ela, marque *Confirmo que esta análise foi feita antes do desfecho* se for verdade.
- **Análise usada na comparação:** por padrão, a última fixada que não é retrospectiva. A comparação fica presa a essa versão, mesmo que você crie outras depois.
- **Minha participação:** apenas observei, participei e não arrematei, ou arrematei. É separado do desfecho: "dentro do limite" não quer dizer que você comprou.

O resultado mostra a diferença entre o preço final e seu limite (ex.: *R$ 2.300,00 acima do seu limite*). Não é prejuízo: é só a distância entre o que o mercado pagou e o que você decidiu pagar.

**Errou algo?** **Corrigir resultado** exige um motivo. A revisão anterior continua visível em *Histórico de correções*.

## 7. Dashboard

- **Contagens:** leilões, lotes, acompanhados e analisados (arquivados não contam).
- **Lotes acompanhados:** lance atual × seu limite.
- **Próximos leilões:** agendados e em andamento, por data.
- **Pendências:** rascunhos de análise abertos e lotes acompanhados cujo leilão já começou e ainda não têm resultado.
- **Indicador:** *X de Y resultados comparáveis ficaram dentro do limite*.

**O que entra no indicador:** lotes arrematados, com preço final conhecido e análise fixada **antes** do resultado. Ficam de fora:

- lotes não arrematados (retirados, cancelados, sem arrematação) ou com preço desconhecido;
- análises marcadas como **Retrospectiva** (feitas já sabendo o resultado) ou com momento desconhecido.

## 8. Arquivar e excluir

- **Arquivar** tira leilão ou lote das listas e do dashboard, sem apagar nada. Veja de novo em *Somente arquivados*; **Reativar** traz de volta.
- **Excluir** só aparece quando não há histórico (nenhuma análise fixada nem resultado). Com histórico, arquive.

## 9. Descobertos, monitores e alertas

O app coleta sozinho, de 2 em 2 horas, os lotes dos sites de leilão (hoje o Leilo). Você não cadastra nada para isso.

- **Descobertos:** os lotes coletados, com foto, lance, distância de São Carlos/SP, valor de mercado informado pelo site e **condição declarada pelo leiloeiro** (pequena ou média monta, sucata, circulação vedada, laudo cautelar…). Filtre por busca, ano, lance, distância, categoria, condição e situação. Lote sem selo de condição é lote em que o leiloeiro **não informou** nada, e não uma garantia de que não há dano.
- **Monitores:** buscas salvas. Crie em *Monitores → Novo monitor* com pelo menos marca ou modelo, um ano ou um lance máximo (ex.: "VW Fox, 2011–2013, até R$ 25.000, até pequena monta"). Cada monitor mostra quantos lotes abertos **combinam agora**, com link para Descobertos já filtrado.
- **Alertas:** a cada coleta, lote **novo** que combina com um monitor ligado vira um alerta ("Novo veículo encontrado"), com o contador ao lado de *Alertas* no menu e uma seção no Dashboard. Lotes que já existiam quando você criou, editou ou religou o monitor não viram alerta (estão em "combinam agora"). Se o lance ou os dados do lote mudarem depois, não chega outro alerta: o alerta mostra sempre os dados da última coleta.
- **Desligar** um monitor para de gerar alertas sem apagar os antigos; **Excluir** apaga o monitor e os alertas dele.
- **Adicionar à análise:** no cartão do lote (em Descobertos ou num alerta), cria de uma vez o leilão, o lote (já acompanhado) e um rascunho de análise, e abre o rascunho. O rascunho vem com o que o site informa: valor de mercado, comissão, despachante (documentação), remoção (transporte) e depósito e vistoria (outras taxas), com a origem anotada em *Notas*. Reparos, pneus, revisão, reserva e margem ficam com você; confira tudo antes de fixar. Clicar de novo não duplica: o cartão passa a mostrar **Ver no Tracker**. Lotes do mesmo leilão do site ficam no mesmo leilão do Tracker. O botão só aparece quando o site informa marca, modelo, ano e o leilão. Se o leilão estava arquivado no Tracker, ele volta à lista.
- **Resultado automático:** quando o lote adicionado assim encerra no site, o coletor registra o resultado sozinho (arrematado com o preço final, não vendido ou retirado), com o link e a hora do fim, marcado **Registrado pelo coletor** e ligado à sua análise fixada. Sua participação fica como "acompanhei": se você arrematou, corrija o resultado (vira uma nova revisão). Venda **condicional** ou desfecho desconhecido aparecem como **Resultado a confirmar** na ficha e no Dashboard, com o formulário já preenchido; se o site confirmar depois, o resultado entra sozinho. Adicionar um lote que já encerrou cria a análise como "feita conhecendo o resultado".
- **Estimativas:** nos lotes abertos (Descobertos e alertas), o cartão mostra o **provável** lance final e o seu **limite estimado**, sempre com o número de casos. O provável vem de vendas parecidas já encerradas no catálogo (mesma marca e modelo, ano ±1, mesma condição, km próxima; de qualquer região). Sem 5 vendas parecidas, usa quanto veículos da mesma categoria e condição costumam sair em relação ao valor de mercado informado pelo site. Sem nenhuma base, diz "Sem base suficiente". O limite estimado aplica a calculadora às premissas das suas análises fixadas de veículos parecidos, com a FIPE do próprio anúncio como valor de mercado, e aparece a partir de 3 delas. São referências: a decisão continua sendo a sua análise fixada.
- **Lance automático:** num lote adicionado assim, o coletor atualiza o **lance atual** a cada coleta, enquanto o lote não estiver arquivado (a ficha mostra "Acompanhado no Leilo, lido em …"). Você ainda pode digitar um lance; ele vale até a próxima leitura do site com lance diferente.

## 10. Backup

Os dados vivem no Supabase. Faça backup **toda semana e antes de cada migration**:

```bash
npm run backup
```

Guarde a cópia fora do computador. Restauração e detalhes: [OPERACAO.md](OPERACAO.md) §5 e §6.
