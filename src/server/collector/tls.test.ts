import { X509Certificate } from "node:crypto";
import { getCACertificates, rootCertificates, setDefaultCACertificates } from "node:tls";

import { describe, expect, it } from "vitest";

import { EXTRA_INTERMEDIATE_CAS, installExtraCaCertificates } from "./tls";

describe("tls extra intermediate CAs", () => {
  it("todo intermediário embutido é CA válida, vigente e assinada por uma raiz confiável do Node.js", () => {
    const roots = rootCertificates.map((pem) => new X509Certificate(pem));
    expect(EXTRA_INTERMEDIATE_CAS.length).toBeGreaterThan(0);

    for (const pem of EXTRA_INTERMEDIATE_CAS) {
      const cert = new X509Certificate(pem);
      expect(cert.ca).toBe(true);
      expect(Date.parse(cert.validTo)).toBeGreaterThan(Date.now());
      const issuer = roots.find((root) => root.subject === cert.issuer);
      expect(issuer, `emissor ausente do bundle raiz: ${cert.issuer}`).toBeDefined();
      expect(issuer ? cert.checkIssued(issuer) : false).toBe(true);
      expect(issuer ? cert.verify(issuer.publicKey) : false).toBe(true);
    }
  });

  it("installExtraCaCertificates acrescenta os intermediários mantendo as raízes padrão (idempotente)", () => {
    const before = getCACertificates("default");
    try {
      installExtraCaCertificates();
      const afterFirst = getCACertificates("default");
      installExtraCaCertificates();
      const afterSecond = getCACertificates("default");

      expect(afterFirst.length).toBeGreaterThanOrEqual(before.length);
      expect(afterSecond.length).toBe(afterFirst.length);
      for (const pem of EXTRA_INTERMEDIATE_CAS) {
        const fingerprint = new X509Certificate(pem).fingerprint256;
        expect(afterFirst.some((installed) => new X509Certificate(installed).fingerprint256 === fingerprint)).toBe(
          true,
        );
      }
    } finally {
      setDefaultCACertificates(before);
    }
  });
});
