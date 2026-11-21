import { z } from 'zod'
import { CatalogExplainSchema, CatalogStatusSchema, PublicCatalogFacetsSchema, type CatalogSettings, type PublicCatalogBrowseInput } from '@persianpart/contract/public-catalog'

// Internal expressions generated only by the CMS policy compiler, never HTTP input.
export type CatalogPredicate =
  | { op: 'constant'; value: boolean }
  | { op: 'ref'; code: string }
  | { op: 'and' | 'or'; items: CatalogPredicate[] }
  | { op: 'not'; item: CatalogPredicate }
  | { op: 'active' }
  | {
      op: 'in'
      field:
        | 'id'
        | 'productType'
        | 'brand'
        | 'dimension'
        | 'color'
        | 'grade'
        | 'status'
      values: (string | number)[]
    }
  | { op: 'categories'; ids: number[] }
  | { op: 'tags'; ids: number[]; mode: 'any' | 'all' }
  | { op: 'price'; min: number | null; max: number | null }
  | { op: 'validPrice' | 'image' }
  | { op: 'search'; value: string }
export interface CompiledCatalogPolicy {
  clauses: { reasonCode: string; condition: CatalogPredicate }[]
  condition: CatalogPredicate
  pricing: CatalogSettings['pricing']
}
export interface CatalogQuery {
  policy: CompiledCatalogPolicy
  mode: 'browse' | 'facets' | 'explain'
  page?: number
  limit?: number
  productId?: number
  familyId?: number
  sort?: NonNullable<PublicCatalogBrowseInput['sort']>
}
export const CatalogQueryResultSchema = z
  .object({
    total: z.number().int().nonnegative(),
    rows: z.array(
      z
        .object({
          id: z.number().int().positive(),
          price: z.number().nullable(),
          quantity: z.number(),
          status: CatalogStatusSchema,
        })
        .strict(),
    ),
    facets: PublicCatalogFacetsSchema,
    explain: CatalogExplainSchema.nullable(),
  })
  .strict()
export type CatalogQueryResult = z.infer<typeof CatalogQueryResultSchema>
