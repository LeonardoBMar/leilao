import { describe, expect, it } from "vitest";

import { checkImageFile, detectImageType, MAX_IMAGE_BYTES } from "./lot-images";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe("checkImageFile — CA-18", () => {
  it("aceita JPEG, PNG e WebP até 5 MB", () => {
    expect(checkImageFile({ type: "image/jpeg", size: 1 })).toBeNull();
    expect(checkImageFile({ type: "image/webp", size: MAX_IMAGE_BYTES })).toBeNull();
  });

  it("recusa tipo não suportado, arquivo vazio e acima do limite", () => {
    expect(checkImageFile({ type: "image/gif", size: 10 })).toBe("unsupported_type");
    expect(checkImageFile({ type: "application/pdf", size: 10 })).toBe("unsupported_type");
    expect(checkImageFile({ type: "image/png", size: 0 })).toBe("empty");
    expect(checkImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toBe("too_large");
  });
});

describe("detectImageType", () => {
  it("reconhece as assinaturas binárias", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectImageType(bytes(...ascii("RIFF"), 0x10, 0, 0, 0, ...ascii("WEBP")))).toBe("image/webp");
  });

  it("recusa conteúdo que não é imagem, mesmo com tipo declarado de imagem", () => {
    expect(detectImageType(bytes(...ascii("%PDF-1.7")))).toBeNull();
    expect(detectImageType(bytes(...ascii("<svg")))).toBeNull();
    expect(detectImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});
