import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { err, ok, type Result } from "@/lib/result";

/**
 * Busca HTTP segura contra SSRF para o Importador Universal de Lotes (D-98).
 * Bloqueia IPs privados/loopback/link-local/multicast (IPv4 e IPv6), valida redirecionamentos,
 * valida Content-Type HTML/texto, impõe timeout total de 8 s (incluindo leitura do corpo) e teto de 2 MB.
 */

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 2;

const USER_AGENT = "Mozilla/5.0 (compatible; LeilaoTrackerImport/1.0; +https://github.com/LeonardoBMar/leilao)";

export type SafeFetchError = "invalid_url" | "blocked_host" | "blocked_by_site" | "too_large" | "network_error";

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a = 0, b = 0] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/** Verifica se um endereço IPv4 ou IPv6 pertence a faixa privada, loopback, link-local ou reservada. */
export function isPrivateIp(ip: string): boolean {
  const normalized = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const version = isIP(normalized);
  if (version === 4) return isPrivateIpv4(normalized);
  if (version === 6) {
    if (normalized === "::1" || normalized === "::") return true;
    // Formas expandidas de loopback ou unspecified (ex.: 0:0:0:0:0:0:0:1 / 0:0:0:0:0:0:0:0)
    if (/^(?:0+:){6,7}0*[01]$/.test(normalized)) return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA fc00::/7
    if (
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    ) {
      return true; // link-local fe80::/10
    }
    if (normalized.startsWith("ff")) return true; // multicast ff00::/8
    if (normalized.startsWith("64:ff9b:") || normalized.startsWith("100::")) return true; // NAT64 / discard
    if (normalized.startsWith("::ffff:")) {
      return isPrivateIpv4(normalized.slice(7));
    }
    return false;
  }
  return true;
}

/** Valida protocolo, credenciais, hostname literal e IPs resolvidos via DNS antes da requisição. */
export async function validateTargetUrl(rawUrl: string): Promise<Result<URL, SafeFetchError>> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return err("invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return err("invalid_url");
  if (url.username || url.password) return err("blocked_host");

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return err("blocked_host");
  }

  if (isIP(host) !== 0) {
    return isPrivateIp(host) ? err("blocked_host") : ok(url);
  }

  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) return err("network_error");
    if (addresses.some((entry) => isPrivateIp(entry.address))) return err("blocked_host");
  } catch {
    return err("network_error");
  }

  return ok(url);
}

/** Baixa o HTML de uma página pública de lote com proteção contra SSRF, timeout total e teto de tamanho. */
export async function fetchExternalLotHtml(
  rawUrl: string,
): Promise<Result<{ url: string; html: string }, SafeFetchError>> {
  let currentUrl = rawUrl.trim();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const validated = await validateTargetUrl(currentUrl);
    if (!validated.ok) return validated;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      let response: Response;
      try {
        response = await fetch(validated.value.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
        });
      } catch {
        return err("network_error");
      }

      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => {});
        const location = response.headers.get("location");
        if (!location || hop === MAX_REDIRECTS) return err("blocked_by_site");
        try {
          currentUrl = new URL(location, validated.value).toString();
        } catch {
          return err("invalid_url");
        }
        continue;
      }

      if (response.status === 403 || response.status === 429 || response.status === 503) {
        await response.body?.cancel().catch(() => {});
        return err("blocked_by_site");
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        return err("network_error");
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (
        contentType &&
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        await response.body?.cancel().catch(() => {});
        return err("blocked_by_site");
      }

      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        await response.body?.cancel().catch(() => {});
        return err("too_large");
      }

      const reader = response.body?.getReader();
      if (!reader) return err("network_error");

      const chunks: Uint8Array[] = [];
      let received = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > MAX_BODY_BYTES) {
            await reader.cancel();
            return err("too_large");
          }
          chunks.push(value);
        }
      } catch {
        return err("network_error");
      }

      const html = Buffer.concat(chunks).toString("utf8");
      if (
        html.length < 12_000 &&
        /cf-browser-verification|challenge-platform|just a moment|attention required! \| cloudflare/i.test(html)
      ) {
        return err("blocked_by_site");
      }

      return ok({ url: validated.value.toString(), html });
    } finally {
      clearTimeout(timer);
    }
  }

  return err("blocked_by_site");
}
