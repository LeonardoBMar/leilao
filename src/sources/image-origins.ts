/**
 * Origens das fotos dos anúncios, liberadas na CSP (`img-src` em next.config.ts, D-29). Uma por fonte; cada adaptador
 * monta ou filtra as fotos pela sua, e o contrato comum recusa o anúncio com foto de outra origem.
 * Arquivo sem imports: o next.config.ts lê direto.
 */
export const LEILO_IMAGE_ORIGIN = "https://leilo.cdndp.com.br";
export const PATIO_IMAGE_ORIGIN = "https://patioestadualsc.org";
export const FREITAS_IMAGE_ORIGIN = "https://cdn3.freitasleiloeiro.com.br";

export const LISTING_IMAGE_ORIGINS = [LEILO_IMAGE_ORIGIN, PATIO_IMAGE_ORIGIN, FREITAS_IMAGE_ORIGIN] as const;
