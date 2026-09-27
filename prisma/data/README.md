# Dados de referência

## `municipalities.csv`

Municípios brasileiros com código IBGE, UF e coordenadas da sede, para calcular distâncias sem depender de API externa (plano de coleta, §3).

- **Fonte:** [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros) (`csv/municipios.csv` + `csv/estados.csv`), licença MIT, © 2016 Kelvin S. do Prado.
- **Transformação:** mantidas as colunas `codigo_ibge`, `nome`, `latitude` e `longitude`; `codigo_uf` trocado pela sigla da UF.
- **Carga:** `npm run db:seed`, idempotente.
