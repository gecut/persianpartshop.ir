import { APIError, type PayloadRequest } from 'payload'
import { StoredCatalogSettingsSchema, PublicCatalogBrowseSchema, PublicCatalogPageSchema, CatalogPreviewSchema, type CatalogSettings, type PublicCatalogBrowseInput, type CatalogInput } from '@persianpart/contract/public-catalog'
import type { Media, ProductsSelect } from '../../payload-types'
import {
  compilePolicy,
  applyVisitorFilters,
  hasEmptyCriteria,
} from './catalog-policy'
import { mapPublicProduct, publicConfig } from './catalog-mapper'
import { catalogQuerySQL } from './catalog-query-sql'
import {
  CatalogQueryResultSchema,
  type CatalogQuery,
  type CatalogQueryResult,
} from './catalog-query-types'

const emptyFacets = () => ({
  categories: [],
  brands: [],
  dimensions: [],
  tags: [],
  colors: [],
  grades: [],
})
const unavailable = () =>
  new APIError('دریافت کاتالوگ ممکن نشد؛ دوباره تلاش کنید.', 503)
const projection = {
  name: true,
  sku: true,
  productType: true,
  category: true,
  brand: true,
  dimension: true,
  color: true,
  grade: true,
  tags: true,
  width: true,
  height: true,
  unit: true,
  sqmPerCarton: true,
  piecesPerCarton: true,
  weight: true,
  secondary_unit: true,
  itemsPerPack: true,
  approxCoverage: true,
  richDescription: true,
  cover: true,
  gallery: true,
  updatedAt: true,
} satisfies ProductsSelect

export function createCatalogService(req: PayloadRequest) {
  async function loadSettings() {
    try {
      const doc = await req.payload.findGlobal({
        slug: 'catalog-settings',
        depth: 0,
        req,
        overrideAccess: false,
      })
      const result = StoredCatalogSettingsSchema.safeParse(doc.policy)
      if (!result.success || !doc.updatedAt) throw unavailable()
      return { settings: result.data, revision: doc.updatedAt }
    } catch {
      throw unavailable()
    }
  }
  async function query(input: CatalogQuery) {
    try {
      const adapter = req.payload.db as unknown as {
        pool: {
          query: (
            text: string,
            params: unknown[],
          ) => Promise<{ rows: { result: unknown }[] }>
        }
      }
      const sql = catalogQuerySQL(input)
      return CatalogQueryResultSchema.parse(
        (await adapter.pool.query(sql.text, sql.params)).rows[0]?.result,
      )
    } catch {
      throw unavailable()
    }
  }
  async function hydrate(
    rows: CatalogQueryResult['rows'],
    settings: CatalogSettings,
  ) {
    if (!rows.length) return []
    const result = await req.payload.find({
      collection: 'products',
      where: { id: { in: rows.map((row) => row.id) } },
      select: projection,
      limit: rows.length,
      depth: 1,
      req,
      overrideAccess: false,
    })
    const byId = new Map(result.docs.map((product) => [product.id, product]))
    return rows.flatMap((row) => {
      const product = byId.get(row.id)
      return product ? [mapPublicProduct(product, row, settings)] : []
    })
  }
  async function config(settings: CatalogSettings) {
    async function media(id: number | null): Promise<Media | null> {
      if (id == null) return null
      try {
        return await req.payload.findByID({
          collection: 'media',
          id,
          depth: 0,
          req,
          overrideAccess: false,
        })
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'status' in error &&
          error.status === 404
        )
          return null
        throw unavailable()
      }
    }
    const [fallback, share] = await Promise.all([
      media(settings.presentation.fallbackImage),
      media(settings.sharing.image),
    ])
    return publicConfig(settings, fallback, share)
  }
  async function browse(input: PublicCatalogBrowseInput) {
    const { settings, revision } = await loadSettings()
    if (
      (!settings.pricing.showPrice &&
        (input.minPrice != null ||
          input.maxPrice != null ||
          input.sort === 'cheapest' ||
          input.sort === 'expensive')) ||
      (settings.stock.mode === 'hidden' && input.inStock)
    ) {
      throw new APIError('این فیلتر در کاتالوگ فعال نیست.', 400)
    }
    const publicSettings = await config(settings)
    if (settings.paused)
      return PublicCatalogPageSchema.parse({
        state: 'paused',
        revision,
        config: publicSettings,
        items: [],
        facets: emptyFacets(),
        total: 0,
        page: input.page,
        limit: input.limit,
        hasMore: false,
      })
    const policy = compilePolicy(settings)
    const [data, facets] = await Promise.all([
      query({
        policy: applyVisitorFilters(policy, input),
        mode: 'browse',
        page: input.page,
        limit: input.limit,
        sort: input.sort ?? publicSettings.sort,
      }),
      query({ policy, mode: 'facets', limit: 1 }),
    ])
    return PublicCatalogPageSchema.parse({
      state: 'active',
      revision,
      config: publicSettings,
      items: await hydrate(data.rows, settings),
      facets: facets.facets,
      total: data.total,
      page: input.page,
      limit: input.limit,
      hasMore: input.page * input.limit < data.total,
    })
  }
  return {
    bootstrap: () => browse(PublicCatalogBrowseSchema.parse({})),
    browse,
    product: async (input: CatalogInput<'product'>) => {
      const { settings } = await loadSettings()
      if (settings.paused)
        throw new APIError('محصول در کاتالوگ موجود نیست.', 404, {
          code: 'CATALOG_NOT_FOUND',
        })
      const data = await query({
        policy: compilePolicy(settings),
        mode: 'browse',
        productId: input.id,
        limit: 1,
      })
      const products = await hydrate(data.rows, settings)
      if (!products[0])
        throw new APIError('محصول در کاتالوگ موجود نیست.', 404, {
          code: 'CATALOG_NOT_FOUND',
        })
      return { product: products[0], config: await config(settings) }
    },
    preview: async (settings: CatalogSettings, productId?: number) => {
      const result = await query({
        policy: compilePolicy({ ...settings, paused: false }),
        mode: 'browse',
        limit: 6,
      })
      const explain =
        productId == null
          ? null
          : (
              await query({
                policy: compilePolicy(settings),
                mode: 'explain',
                productId,
                limit: 1,
              })
            ).explain
      return CatalogPreviewSchema.parse({
        matchedCount: result.total,
        publishedCount: settings.paused ? 0 : result.total,
        emptyFilteredIsAll:
          settings.base === 'filtered' && hasEmptyCriteria(settings),
        sample: await hydrate(result.rows, settings),
        explain,
      })
    },
  }
}
