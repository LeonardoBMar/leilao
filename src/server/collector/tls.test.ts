import { X509Certificate } from "node:crypto";
import { getCACertificates, rootCertificates, setDefaultCACertificates } from "node:tls";

import { describe, expect, it } from "vitest";

import { EXTRA_INTERMEDIATE_CAS, installExtraCaCertificates } from "./tls";

describe("tls extra intermediate CAs", () => {
  it("todo intermediário embutido é CA válida, vigente e assinada por uma raiz confiável do Node.js", () => {
    const roots = rootCertificates.map((pem) => new X509Certificate(pem));
    const now = Date.now();
    expect(EXTRA_INTERMEDIATE_CAS.length).toBeGreaterThan(0);

    for (const pem of EXTRA_INTERMEDIATE_CAS) {
      const cert = new X509Certificate(pem);
      expect(cert.ca).toBe(true);
      expect(Date.parse(cert.validFrom)).toBeLessThanOrEqual(now);
      expect(Date.parse(cert.validTo)).toBeGreaterThan(now);
      const issuer = roots.find((root) => cert.checkIssued(root) && cert.verify(root.publicKey));
      expect(issuer, `emissor confiável ausente no bundle raiz: ${cert.issuer}`).toBeDefined();
    }
  });

  it("installExtraCaCertificates acrescenta os intermediários mantendo todas as raízes padrão (idempotente)", () => {
    const before = getCACertificates("default");
    const beforeFingerprints = new Set(before.map((pem) => new X509Certificate(pem).fingerprint256));
    try {
      installExtraCaCertificates();
      const afterFirst = getCACertificates("default");
      installExtraCaCertificates();
      const afterSecond = getCACertificates("default");

      const afterFingerprints = new Set(afterFirst.map((pem) => new X509Certificate(pem).fingerprint256));
      for (const fingerprint of beforeFingerprints) {
        expect(afterFingerprints.has(fingerprint)).toBe(true);
      }
      expect(afterSecond.length).toBe(afterFirst.length);
      for (const pem of EXTRA_INTERMEDIATE_CAS) {
        expect(afterFingerprints.has(new X509Certificate(pem).fingerprint256)).toBe(true);
      }
    } finally {
      setDefaultCACertificates(before);
    }
  });
});
