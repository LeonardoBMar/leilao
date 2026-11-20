import { describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES } from "@/domain/lot-images";

import { confirmUploadSchema, imageIdSchema, lotIdSchema, moveDirectionSchema, requestUploadSchema } from "./schemas";

const VALID_UUID = "01950000-0000-7000-8000-000000000001";

describe("lotIdSchema e imageIdSchema", () => {
  it("validam UUIDs de lote e imagem", () => {
    expect(lotIdSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(imageIdSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(lotIdSchema.safeParse("123").success).toBe(false);
    expect(imageIdSchema.safeParse("").success).toBe(false);
  });
});

describe("requestUploadSchema", () => {
  it("normaliza o nome do arquivo e aceita tamanhos dentro do limite de pré-validação", () => {
    expect(
      requestUploadSchema.parse({
        fileName: "  frente-lateral.jpg  ",
        mimeType: "image/jpeg",
        size: MAX_IMAGE_BYTES,
      }),
    ).toEqual({
      fileName: "frente-lateral.jpg",
      mimeType: "image/jpeg",
      size: MAX_IMAGE_BYTES,
    });
  });

  it("rejeita nome vazio, tamanho negativo ou acima de 2x MAX_IMAGE_BYTES", () => {
    expect(
      requestUploadSchema.safeParse({
        fileName: "   ",
        mimeType: "image/jpeg",
        size: 1024,
      }).success,
    ).toBe(false);

    expect(
      requestUploadSchema.safeParse({
        fileName: "foto.jpg",
        mimeType: "image/jpeg",
        size: -1,
      }).success,
    ).toBe(false);

    expect(
      requestUploadSchema.safeParse({
        fileName: "foto.jpg",
        mimeType: "image/jpeg",
        size: MAX_IMAGE_BYTES * 2 + 1,
      }).success,
    ).toBe(false);
  });
});

describe("confirmUploadSchema e moveDirectionSchema", () => {
  it("valida o caminho no Storage e o nome do arquivo na confirmação", () => {
    expect(
      confirmUploadSchema.parse({
        path: "user-id/lot-id/image.jpg",
        fileName: " image.jpg ",
      }),
    ).toEqual({
      path: "user-id/lot-id/image.jpg",
      fileName: "image.jpg",
    });

    expect(
      confirmUploadSchema.safeParse({
        path: "a".repeat(301),
        fileName: "image.jpg",
      }).success,
    ).toBe(false);
  });

  it("aceita apenas direções up e down", () => {
    expect(moveDirectionSchema.parse("up")).toBe("up");
    expect(moveDirectionSchema.parse("down")).toBe("down");
    expect(moveDirectionSchema.safeParse("left").success).toBe(false);
  });
});
