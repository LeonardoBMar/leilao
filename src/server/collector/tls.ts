import "server-only";

import { getCACertificates, setDefaultCACertificates } from "node:tls";

/**
 * Certificado intermediário `Valid Certificadora RSA DV SSL CA 2` (emitido por `Sectigo Public Server Authentication
 * Root R46`, já presente no bundle raiz do Node.js; válido de 24/09/2025 a 23/09/2035).
 *
 * O servidor `leilao.detran.mg.gov.br` envia apenas o certificado folha (`*.detran.mg.gov.br`) sem a cadeia
 * intermediária. Navegadores recuperam o intermediário via AIA (`http://crt.sectigo.com/ValidCertificadoraRSADVSSLCA2.crt`),
 * mas o Node.js não faz AIA chasing e falha com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Incluir este intermediário mantém a
 * verificação TLS completa (`rejectUnauthorized: true`) sem enfraquecer a confiança, pois ele encadeia numa raiz já
 * confiável.
 *
 * SHA-256: 79:A3:55:8F:AD:A3:EB:2C:36:B5:E7:D1:C2:B5:BF:E4:F8:89:C6:AE:76:AF:45:DD:4E:B8:6F:4F:FA:19:B7:60
 */
const VALID_RSA_DV_SSL_CA_2_PEM = [
  "-----BEGIN CERTIFICATE-----",
  "MIIGQTCCBCmgAwIBAgIRANR3Y+zYsNkbye1NBIp6Oh8wDQYJKoZIhvcNAQEMBQAw",
  "XzELMAkGA1UEBhMCR0IxGDAWBgNVBAoTD1NlY3RpZ28gTGltaXRlZDE2MDQGA1UE",
  "AxMtU2VjdGlnbyBQdWJsaWMgU2VydmVyIEF1dGhlbnRpY2F0aW9uIFJvb3QgUjQ2",
  "MB4XDTI1MDkyNDAwMDAwMFoXDTM1MDkyMzIzNTk1OVowZjELMAkGA1UEBhMCQlIx",
  "KTAnBgNVBAoTIFZhbGlkIENlcnRpZmljYWRvcmEgRGlnaXRhbCBMVERBMSwwKgYD",
  "VQQDEyNWYWxpZCBDZXJ0aWZpY2Fkb3JhIFJTQSBEViBTU0wgQ0EgMjCCAaIwDQYJ",
  "KoZIhvcNAQEBBQADggGPADCCAYoCggGBAMLEZrDHAK3rpO9gk6RYo9a54so0pKHB",
  "9futlaUHRz07sUAwe/VJ91SpkUayRMpD13aUFkj0bI2RPYpMnCJcRLnT2t5TcnSz",
  "/aqtJXEEQx6ggDljfmjzO++GrXuiWBkGtBlszUKXobEP5dVUWwpGOdkq0MnNyZQb",
  "8tokM0X4q8u3KlG5EtEDhN8YtxEaIPlDNZWlDLcB2AHJ39OJ672fsdXFa+pOMjRM",
  "RXxKxMN6BAFmawIa6pGHeQI3KzxL/Nm5/bFrWPypJlhcnH9/hFN7wOJI+488HBvJ",
  "ybxcceMvJbpIhKtaavXxbKdOVrpxX9qVO9L+5BD3T7R1vVzFQjsrzsbS46YoFufI",
  "7+R69KwQIlSyh66rbYjBW4ak8Vryfy9u1lqxR3U/yNwTRc+bFMS0PoJ4p1NihKjp",
  "8iA1wVZRbAQuiHCrNBMTYLGQhoy9jT4rvoEc7XTVkJQfP+hyXwqR8gM5FNDFCq43",
  "/dhJ1NHcU36H+R9e7+nEz4HVDAz4T8xuAwIDAQABo4IBbzCCAWswHwYDVR0jBBgw",
  "FoAUVnNYZJX5khqwEioEYnmhQBWIIUkwHQYDVR0OBBYEFIFkgUlxs/VayhB/mIUz",
  "0N7y92irMA4GA1UdDwEB/wQEAwIBhjASBgNVHRMBAf8ECDAGAQH/AgEAMBMGA1Ud",
  "JQQMMAoGCCsGAQUFBwMBMBMGA1UdIAQMMAowCAYGZ4EMAQIBMFQGA1UdHwRNMEsw",
  "SaBHoEWGQ2h0dHA6Ly9jcmwuc2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY1NlcnZl",
  "ckF1dGhlbnRpY2F0aW9uUm9vdFI0Ni5jcmwwgYQGCCsGAQUFBwEBBHgwdjBPBggr",
  "BgEFBQcwAoZDaHR0cDovL2NydC5zZWN0aWdvLmNvbS9TZWN0aWdvUHVibGljU2Vy",
  "dmVyQXV0aGVudGljYXRpb25Sb290UjQ2LnA3YzAjBggrBgEFBQcwAYYXaHR0cDov",
  "L29jc3Auc2VjdGlnby5jb20wDQYJKoZIhvcNAQEMBQADggIBAI6mPd5Kb5M9OGq/",
  "jSmbkVJv5OasvKZbXibotLVVCAUnGeKR7uTxpjf+/QaGXDqu8WZpsm/6hijU5Ew/",
  "06Gp4AmVeqBg68Sdb/hcSusrz7x1Q+kHsi2Rm1N8m7Z/A0vbb5IPcVlDyzhjMfAe",
  "5T+Ta8wbZiJSgD8WN+uBR1pj14TsvvUk5wkdqcyMvsXncku7DOcUqOiyfqsC3qZo",
  "IuxEZAxso3bHSP/Qw1cKGuqx2F8cBjo/6TZs7Qnqc/K3Jdc741EvscRs89oYt8iT",
  "OzGxWb+9ypjnIX+nG++gLr31Df2DS/ZlUrNcBAk505DY6qOs/P+1CRGSrzUzKGz4",
  "080VsfC+FthgRJvtfL/hcPWU/539XvGWc+L5MDIlsnZuBOGiu3qop0lvO2MG2xFA",
  "6aAhT/sZt3et3QCR6w6z4KEh9J1gUBzEB0TlLvqzauJbdDxhv5XDH1eGcOfe8CRS",
  "NjD1abyuMp9v4gQG14MLL6Pu/s0QCgBTQ5THWG4aAXUQNNQcV5sXBDxLFCfq8qkp",
  "PcPdNyi4p1h8HHIQvvMiA56IRLSLhpKqnIsJge55ZrE7X9ZTWzCJ9G9+dNJ0ovaS",
  "VPbF8u6LJubkvcqonLnhoPUiCzRVa3dBt8TwUk7v+nVSqbdLd7rFqsGVuUSplDR6",
  "dewRCVqCAV+Pz02jvV6RzECz6+iQ",
  "-----END CERTIFICATE-----",
].join("\n");

/** Intermediários de fontes com cadeia TLS incompleta; todos encadeiam em raízes já confiáveis do Node.js. */
export const EXTRA_INTERMEDIATE_CAS: readonly string[] = [VALID_RSA_DV_SSL_CA_2_PEM];

let installed = false;

/**
 * Acrescenta os certificados intermediários conhecidos à lista padrão do processo Node.js (idempotente).
 * Preserva todos os certificados raiz padrão e mantém a validação TLS completa.
 */
export function installExtraCaCertificates(): void {
  if (installed) return;
  const current = getCACertificates("default");
  const missing = EXTRA_INTERMEDIATE_CAS.filter((pem) => !current.includes(pem));
  if (missing.length > 0) {
    setDefaultCACertificates([...current, ...missing]);
  }
  installed = true;
}
