import {
  catalogOperations,
  type PublicCatalogBrowseInput,
} from '@persianpart/contract/public-catalog'

export async function browseCatalog(
  input: PublicCatalogBrowseInput,
  { signal }: { signal: AbortSignal },
) {
  const response = await fetch('/api/catalog/browse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(catalogOperations.browse.input.parse(input)),
    credentials: 'omit',
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error('دریافت کاتالوگ ممکن نشد')
  return catalogOperations.browse.output.parse(await response.json())
}
