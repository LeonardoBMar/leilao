"use client";

import { ArrowLeft, ArrowRight, ImageOff, ImagePlus, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, useRef, useState, useTransition } from "react";

import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  toast,
} from "@/components/ui";
import { checkImageFile, MAX_IMAGES_PER_LOT } from "@/domain/lot-images";
import type { ActionState } from "@/lib/action-state";
import { LOT_IMAGES_BUCKET } from "@/lib/storage-buckets";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import {
  confirmImageUploadAction,
  deleteImageAction,
  moveImageAction,
  requestImageUploadAction,
  setCoverImageAction,
} from "../actions";
import type { LotImageItem } from "../queries";

const CHECK_MESSAGES = {
  unsupported_type: "formato não aceito (use JPEG, PNG ou WebP)",
  too_large: "passa de 5 MB",
  empty: "arquivo vazio",
} as const;

type LotGalleryProps = { lotId: string; images: LotImageItem[] };

/** Galeria do lote (SPEC RF-07): envio direto ao Storage, capa, ordem e remoção. */
export function LotGallery({ lotId, images }: LotGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const remaining = MAX_IMAGES_PER_LOT - images.length;

  async function uploadOne(file: File): Promise<string | null> {
    const problem = checkImageFile(file);
    if (problem) return `${file.name}: ${CHECK_MESSAGES[problem]}.`;

    const ticket = await requestImageUploadAction(lotId, { fileName: file.name, mimeType: file.type, size: file.size });
    if (ticket.status === "error") return `${file.name}: ${ticket.message}`;

    const { error } = await getSupabaseBrowserClient()
      .storage.from(LOT_IMAGES_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
    if (error) return `${file.name}: falha no envio. Tente novamente.`;

    const confirmed = await confirmImageUploadAction(lotId, { path: ticket.path, fileName: file.name });
    return confirmed.status === "error" ? `${file.name}: ${confirmed.message}` : null;
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;
    if (files.length > remaining) {
      toast.error(`Cada lote aceita até ${MAX_IMAGES_PER_LOT} fotos. Selecione no máximo ${remaining}.`);
      return;
    }

    startTransition(async () => {
      const problems: string[] = [];
      for (const [index, file] of files.entries()) {
        setProgress(`Enviando ${index + 1} de ${files.length}…`);
        const problem = await uploadOne(file);
        if (problem) problems.push(problem);
      }
      setProgress(null);
      const sent = files.length - problems.length;
      if (sent > 0) toast.success(sent === 1 ? "Foto adicionada." : `${sent} fotos adicionadas.`);
      for (const problem of problems) toast.error(problem);
    });
  }

  return (
    <div className="grid gap-4">
      {images.length === 0 ? (
        <EmptyState icon={ImageOff} title="Sem fotos" description="Adicione fotos do edital ou da vistoria." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Fotos do lote">
          {images.map((image, index) => (
            <GalleryItem key={image.id} image={image} isFirst={index === 0} isLast={index === images.length - 1} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFiles}
        />
        <Button
          variant="secondary"
          disabled={remaining <= 0}
          loading={isPending}
          loadingLabel={progress ?? "Enviando…"}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          Adicionar fotos
        </Button>
        <p className="text-caption text-muted" aria-live="polite">
          {progress ?? `${images.length} de ${MAX_IMAGES_PER_LOT} · JPEG, PNG ou WebP até 5 MB`}
        </p>
      </div>
    </div>
  );
}

function GalleryItem({ image, isFirst, isLast }: { image: LotImageItem; isFirst: boolean; isLast: boolean }) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") toast.error(result.message);
      else if (result.status === "success" && result.message) toast.success(result.message);
    });
  }

  return (
    <li className="grid gap-2" aria-busy={isPending || undefined}>
      <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-subtle">
        {image.url ? (
          <a href={image.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${image.originalFilename}`}>
            {/* URL assinada e temporária: sem otimização do Next (cada URL é única). */}
            <Image
              src={image.url}
              alt={image.originalFilename}
              fill
              unoptimized
              sizes="(min-width: 640px) 33vw, 50vw"
              className="object-cover"
            />
          </a>
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-caption text-muted">
            Não foi possível carregar a foto
          </div>
        )}
        {image.isCover ? (
          <Badge variant="primary" className="absolute top-2 left-2">
            Capa
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Mover para a esquerda"
            disabled={isFirst || isPending}
            onClick={() => run(() => moveImageAction(image.id, "up"))}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Mover para a direita"
            disabled={isLast || isPending}
            onClick={() => run(() => moveImageAction(image.id, "down"))}
          >
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
        <div className="flex gap-1">
          {!image.isCover ? (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Definir como capa"
              disabled={isPending}
              onClick={() => run(() => setCoverImageAction(image.id))}
            >
              <Star aria-hidden="true" />
            </Button>
          ) : null}
          <Dialog>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={`Remover ${image.originalFilename}`} disabled={isPending}>
                <Trash2 aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remover foto?</DialogTitle>
                <DialogDescription>
                  “{image.originalFilename}” será removida do lote e do armazenamento.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancelar</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" onClick={() => run(() => deleteImageAction(image.id))}>
                    Remover
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </li>
  );
}
