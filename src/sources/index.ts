import { detranMgSource } from "./detran-mg";
import { detranScSource } from "./detran-sc";
import { freitasSource } from "./freitas";
import { leilaoOnlineSource } from "./leilao-online";
import { leiloSource } from "./leilo";
import { leiloesPbSource } from "./leiloes-pb";
import { patioSaoCarlosSource } from "./patio-sao-carlos";
import { superbidSource } from "./superbid";
import type { SourceAdapter } from "./types";

/**
 * Fontes coletadas (D-37). Fonte nova: adaptador em `src/sources/<id>/`, entrada aqui e a origem das fotos em
 * `./image-origins.ts`. O coletor cadastra a fonte no banco na primeira execução; `sources.active = false` pausa.
 */
export const SOURCES: readonly SourceAdapter[] = [
  leiloSource,
  patioSaoCarlosSource,
  freitasSource,
  detranMgSource,
  leilaoOnlineSource,
  detranScSource,
  superbidSource,
  leiloesPbSource,
];
