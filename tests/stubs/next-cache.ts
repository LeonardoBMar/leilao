/**
 * Substituto neutro de `next/cache` no Vitest: fora do runtime do Next.js com Cache Components,
 * `cacheLife()` e `cacheTag()` lançam erro. Testes unitários e `test:db` executam as funções
 * diretamente contra o código/banco sem camada de cache.
 */
export function cacheLife(_profile: unknown): void {}
export function cacheTag(..._tags: string[]): void {}
export function updateTag(_tag: string): void {}
export function revalidateTag(_tag: string, _profile?: unknown): void {}
export function revalidatePath(_path: string, _type?: "layout" | "page"): void {}
export function refresh(): void {}
