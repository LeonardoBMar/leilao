"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

type SliderProps = SliderPrimitive.SliderProps & {
  /** Nome de cada ponto para leitores de tela (ex.: ["Preço mínimo", "Preço máximo"]). */
  thumbLabels: readonly string[];
  /** Valor de cada ponto como o leitor de tela deve ler (ex.: "R$ 30 mil"), no lugar do número cru. */
  thumbValueTexts?: readonly string[];
};

/** Faixa com um ou dois pontos (Radix): setas, Page Up/Down, Home/End e arraste, com alvos de 40 px. */
function Slider({ className, thumbLabels, thumbValueTexts, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex h-10 w-full touch-none items-center select-none data-[disabled]:opacity-60",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-primary-subtle">
        <SliderPrimitive.Range className="absolute h-full bg-foreground" />
      </SliderPrimitive.Track>
      {thumbLabels.map((label, index) => (
        <SliderPrimitive.Thumb
          key={label}
          aria-label={label}
          aria-valuetext={thumbValueTexts?.[index]}
          className="group flex size-10 items-center justify-center rounded-full outline-none"
        >
          <span className="block size-5 rounded-full border-2 border-foreground bg-surface shadow-sm transition-transform duration-120 group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2" />
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
