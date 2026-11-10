import type { Endpoint } from 'payload'
import { z } from 'zod'
import { CatalogBrowseInputSchema } from '@persianpart/contract'
import { getAdminUser } from '../access/roles'

export const InternalCatalogBrowseSchema = CatalogBrowseInputSchema.extend({
  allowedCategoryIds: z.array(z.number().int().positive()),
  markupPercent: z.number().finite(),
})

/** Select IDs before hydration: stock and customer-price sorting precede pagination. */
export function catalogBrowseQuery(input: z.infer<typeof InternalCatalogBrowseSchema>) {
  const params: unknown[] = []
  const param = (value: unknown) => { params.push(value); return `$${params.length}` }
  const conditions = ['p.is_active = true']
  if (input.allowedCategoryIds.length) conditions.push(`p.category_id = ANY(${param(input.allowedCategoryIds)}::int[])`)
  const dimension = `CASE WHEN p.product_type = 'other' THEN CASE WHEN p.weight > 0 THEN p.weight::text || ' کیلوگرم' ELSE '' END ELSE COALESCE(d.name, COALESCE(p.width,60)::text || '×' || COALESCE(p.height,120)::text) END`
  const grade = `CASE WHEN p.grade::text LIKE 'grade_%' THEN 'درجه ' || translate(replace(p.grade::text,'grade_',''),'1234','۱۲۳۴') ELSE p.grade::text END`
  if (input.dimension) conditions.push(`${dimension} = ${param(input.dimension.replace(/x/gi, '×').trim())}`)
  if (input.category) conditions.push(`COALESCE(c.name,'عمومی') = ${param(input.category)}`)
  for (const [values, expression] of [[input.brands, "COALESCE(b.name,'پرشین پارت')"], [input.colors, "COALESCE(NULLIF(p.color,''),'استاندارد')"], [input.grades, grade]] as const) {
    if (values.length) conditions.push(`${expression} = ANY(${param(values)}::text[])`)
  }
  if (input.tags.length) conditions.push(`EXISTS (SELECT 1 FROM products_rels r JOIN tags t ON t.id=r.tags_id WHERE r.parent_id=p.id AND r.path='tags' AND t.name=ANY(${param(input.tags)}::text[]))`)
  if (input.search.trim()) {
    const pattern = param(`%${input.search.trim().toLowerCase().replace(/[\\%_]/g, '\\$&')}%`)
    conditions.push(`(lower(p.name) LIKE ${pattern} OR lower(p.sku) LIKE ${pattern} OR lower(COALESCE(b.name,'پرشین پارت')) LIKE ${pattern} OR lower(COALESCE(p.color,'استاندارد')) LIKE ${pattern} OR lower(${dimension}) LIKE ${pattern} OR EXISTS (SELECT 1 FROM products_rels r JOIN tags t ON t.id=r.tags_id WHERE r.parent_id=p.id AND r.path='tags' AND lower(t.name) LIKE ${pattern}))`)
  }
  if (input.supplyMode) conditions.push(`EXISTS (SELECT 1 FROM warehouse_stock s JOIN warehouses w ON w.id=s.warehouse_id WHERE s.product_id=p.id AND s.is_active=true AND w.is_active=true AND w.stock_mode='inquiry')`)
  else if (input.inStock) conditions.push(`EXISTS (SELECT 1 FROM warehouse_stock s JOIN warehouses w ON w.id=s.warehouse_id WHERE s.product_id=p.id AND s.is_active=true AND w.is_active=true AND w.stock_mode='exact' AND s.inventory_sqm > 0 AND (p.product_type='other' OR s.inventory_sqm >= ROUND(p.sqm_per_carton*100)/100))`)
  const price = `ROUND(COALESCE(p.base_price_per_sqm,0) * (1 + ${param(input.markupPercent)}::numeric/100))`
  const order = input.sort === 'cheapest' ? `${price} ASC, p.created_at DESC, p.id DESC` : input.sort === 'expensive' ? `${price} DESC, p.created_at DESC, p.id DESC` : input.sort === 'oldest' ? 'p.created_at ASC, p.id ASC' : input.sort === 'newest' ? 'p.created_at DESC, p.id DESC' : 'p.name ASC, p.id ASC'
  const limit = param(input.limit)
  const offset = param((input.page - 1) * input.limit)
  return { text: `WITH matching AS (SELECT p.id, p.name, p.created_at, ${price} AS price FROM products p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN dimensions d ON d.id=p.dimension_id WHERE ${conditions.join(' AND ')}) SELECT id, COUNT(*) OVER()::int AS total FROM matching p ORDER BY ${order.replaceAll(price, 'p.price')} LIMIT ${limit} OFFSET ${offset}`, params }
}

export const catalogBrowseEndpoint: Endpoint = {
  path: '/catalog-browse', method: 'post',
  handler: async req => {
    const actor = getAdminUser(req.user)
    if (!actor || !['service', 'manager', 'superadmin'].includes(actor.role)) return Response.json({ error: 'Forbidden' }, { status: 403 })
    const input = InternalCatalogBrowseSchema.safeParse(await req.json?.())
    if (!input.success) return Response.json({ error: 'Invalid catalog filters' }, { status: 400 })
    const pool = (req.payload.db as unknown as { pool?: { query: (text: string, values: unknown[]) => Promise<{ rows: { id: number; total: number }[] }> } }).pool
    if (!pool) return Response.json({ error: 'PostgreSQL required' }, { status: 503 })
    const query = catalogBrowseQuery(input.data)
    const result = await pool.query(query.text, query.params)
    return Response.json({ ids: result.rows.map(row => row.id), total: result.rows[0]?.total ?? 0 })
  },
}

export const planBrowseEndpoint: Endpoint = {
  path: '/plan-browse', method: 'post',
  handler: async req => {
    const actor = getAdminUser(req.user)
    if (!actor || !['service', 'manager', 'superadmin'].includes(actor.role)) return Response.json({ error: 'Forbidden' }, { status: 403 })
    const input = z.object({ userId: z.number().int().positive(), page: z.number().int().positive(), limit: z.number().int().min(1).max(100) }).safeParse(await req.json?.())
    if (!input.success) return Response.json({ error: 'Invalid pagination' }, { status: 400 })
    const pool = (req.payload.db as unknown as { pool?: { query: (text: string, values: unknown[]) => Promise<{ rows: { id: number; total: number }[] }> } }).pool
    if (!pool) return Response.json({ error: 'PostgreSQL required' }, { status: 503 })
    const { userId, page, limit } = input.data
    const result = await pool.query(`SELECT p.id, COUNT(*) OVER()::int AS total FROM plans p WHERE p.is_active IS DISTINCT FROM false AND EXISTS (SELECT 1 FROM plans_rels r WHERE r.parent_id=p.id AND r.path='users' AND r.users_id=$1) ORDER BY (p.expires_at IS NOT NULL AND p.expires_at <= NOW()) ASC, p.starts_at DESC NULLS LAST, p.id DESC LIMIT $2 OFFSET $3`, [userId, limit, (page - 1) * limit])
    return Response.json({ ids: result.rows.map(row => row.id), total: result.rows[0]?.total ?? 0 })
  },
}
