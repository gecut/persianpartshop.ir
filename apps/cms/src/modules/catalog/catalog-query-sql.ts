import type { CatalogPredicate, CatalogQuery } from './catalog-query-types'

export function catalogQuerySQL(options: CatalogQuery) {
  const input = {
    ...options,
    page: options.page ?? 1,
    limit: options.limit ?? 24,
    sort: options.sort ?? 'default',
  }
  const params: unknown[] = []
  const param = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }
  const clauses = new Map(
    input.policy.clauses.map((clause) => [clause.reasonCode, clause.condition]),
  )
  const normalize = (sql: string) =>
    `lower(trim(regexp_replace(translate(${sql}, 'يك۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩‌‍', 'یک01234567890123456789  '), '\\s+', ' ', 'g')))`
  function render(
    predicate: CatalogPredicate,
    visited = new Set<string>(),
  ): string {
    switch (predicate.op) {
      case 'constant':
        return predicate.value ? 'TRUE' : 'FALSE'
      case 'ref': {
        const value = clauses.get(predicate.code)
        if (!value || visited.has(predicate.code))
          throw new Error('Invalid catalog clause reference')
        return render(value, new Set([...visited, predicate.code]))
      }
      case 'and':
      case 'or':
        return predicate.items.length
          ? `(${predicate.items.map((item) => render(item, visited)).join(predicate.op === 'and' ? ' AND ' : ' OR ')})`
          : predicate.op === 'and'
            ? 'TRUE'
            : 'FALSE'
      case 'not':
        return `(NOT (${render(predicate.item, visited)}))`
      case 'active':
        return 'p.is_active IS TRUE'
      case 'in': {
        if (!predicate.values.length) return 'FALSE'
        const columns = {
          id: 'id',
          productType: 'product_type',
          brand: 'brand_id',
          dimension: 'dimension_id',
          color: 'color',
          grade: 'grade',
          status: 'catalog_status',
        } as const
        return `COALESCE(p.${columns[predicate.field]}::text = ANY(${param(predicate.values.map(String))}::text[]), FALSE)`
      }
      case 'categories':
        return `COALESCE(p.category_id IN (WITH RECURSIVE descendants AS (SELECT id FROM categories WHERE id = ANY(${param(predicate.ids)}::bigint[]) UNION SELECT c.id FROM categories c JOIN descendants d ON c.parent_id = d.id) SELECT id FROM descendants), FALSE)`
      case 'tags':
        return predicate.mode === 'all'
          ? `(SELECT COUNT(DISTINCT r.tags_id) FROM products_rels r WHERE r.parent_id = p.id AND r.path = 'tags' AND r.tags_id = ANY(${param(predicate.ids)}::bigint[])) = ${param(new Set(predicate.ids).size)}`
          : `EXISTS (SELECT 1 FROM products_rels r WHERE r.parent_id = p.id AND r.path = 'tags' AND r.tags_id = ANY(${param(predicate.ids)}::bigint[]))`
      case 'validPrice':
        return 'p.catalog_price IS NOT NULL'
      case 'price':
        return `(p.catalog_price IS NOT NULL${predicate.min == null ? '' : ` AND p.catalog_price >= ${param(predicate.min)}`}${predicate.max == null ? '' : ` AND p.catalog_price <= ${param(predicate.max)}`})`
      case 'image':
        return `(EXISTS (SELECT 1 FROM media m WHERE m.id = p.cover_id AND m.mime_type LIKE 'image/%') OR EXISTS (SELECT 1 FROM products_gallery g JOIN media m ON m.id = g.image_id WHERE g._parent_id = p.id AND m.mime_type LIKE 'image/%'))`
      case 'search': {
        const escaped = `%${predicate.value.replace(/[\\%_]/g, '\\$&')}%`
        const pattern = param(escaped)
        return `(${['p.name', 'p.sku', "COALESCE(p.color,'')", "COALESCE(b.name,'')", "COALESCE(d.name,'')"].map((column) => `${normalize(column)} LIKE ${pattern}`).join(' OR ')} OR EXISTS (SELECT 1 FROM products_rels r JOIN tags t ON t.id=r.tags_id WHERE r.parent_id=p.id AND r.path='tags' AND ${normalize('t.name')} LIKE ${pattern}))`
      }
    }
  }
  const pct = param(input.policy.pricing.percentage),
    step = param(input.policy.pricing.roundingStep)
  const condition = render(input.policy.condition)
  let target =
    input.productId == null
      ? ''
      : ` AND p.id = ${param(input.productId)}::bigint`
  if (input.familyId != null) {
    target += ` AND p.family_id = ${param(input.familyId)}::bigint`
  }
  const sort = {
    default: 'p.name ASC, p.id ASC',
    newest: 'p.created_at DESC, p.id DESC',
    oldest: 'p.created_at ASC, p.id ASC',
    cheapest: 'p.catalog_price ASC NULLS LAST, p.id ASC',
    expensive: 'p.catalog_price DESC NULLS LAST, p.id ASC',
  }[input.sort]
  const facetSQL = `json_build_object(
    'categories', COALESCE((SELECT json_agg(x ORDER BY x.name, x.id) FROM (WITH RECURSIVE ancestors AS (SELECT c.id,c.name,c.parent_id FROM categories c WHERE c.id IN (SELECT category_id FROM matching) UNION SELECT c.id,c.name,c.parent_id FROM categories c JOIN ancestors a ON a.parent_id=c.id) SELECT DISTINCT id,name FROM ancestors) x),'[]'::json),
    'brands', COALESCE((SELECT json_agg(x ORDER BY x.name, x.id) FROM (SELECT DISTINCT b.id,b.name FROM matching p JOIN brands b ON b.id=p.brand_id) x),'[]'::json),
    'dimensions', COALESCE((SELECT json_agg(json_build_object('id',x.id,'name',x.name) ORDER BY x.products DESC,x.width,x.id) FROM (SELECT d.id,d.name,d.width,COUNT(*) AS products FROM matching p JOIN dimensions d ON d.id=p.dimension_id GROUP BY d.id,d.name,d.width) x),'[]'::json),
    'tags', COALESCE((SELECT json_agg(x ORDER BY x.name, x.id) FROM (SELECT DISTINCT t.id,t.name FROM matching p JOIN products_rels r ON r.parent_id=p.id AND r.path='tags' JOIN tags t ON t.id=r.tags_id) x),'[]'::json),
    'colors', COALESCE((SELECT json_agg(x.color ORDER BY x.color) FROM (SELECT DISTINCT color FROM matching WHERE color IS NOT NULL AND color <> '') x),'[]'::json),
    'grades', COALESCE((SELECT json_agg(x.grade ORDER BY x.grade) FROM (SELECT DISTINCT grade FROM matching WHERE grade IS NOT NULL) x),'[]'::json))`
  const explanation =
    input.mode === 'explain' && input.productId != null
      ? `(SELECT json_build_object('id', p.id, 'published', (${condition}), 'clauses', json_build_array(${input.policy.clauses.map((clause) => `json_build_object('reasonCode', ${param(clause.reasonCode)}::text, 'passed', COALESCE((${render(clause.condition)}),FALSE))`).join(',')})) FROM enriched p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN dimensions d ON d.id=p.dimension_id WHERE p.id=${param(input.productId)}::bigint)`
      : 'NULL'
  const limit = param(input.limit),
    offset = param((input.page - 1) * input.limit)
  return {
    text: `WITH stock AS (
      SELECT s.product_id, MAX(s.inventory_sqm) FILTER (WHERE w.stock_mode='exact') AS quantity,
        bool_or(w.stock_mode='inquiry') AS inquiry
      FROM warehouse_stock s JOIN warehouses w ON w.id=s.warehouse_id
      WHERE s.is_active IS TRUE AND w.is_active IS TRUE GROUP BY s.product_id
    ), priced AS (
      SELECT p.*, COALESCE(s.quantity,0) AS catalog_quantity, COALESCE(s.inquiry,FALSE) AS catalog_inquiry,
        CASE WHEN p.base_price_per_sqm > 0 AND p.base_price_per_sqm::text NOT IN ('NaN','Infinity','-Infinity')
          THEN p.base_price_per_sqm::numeric * (1 + ${pct}::numeric/100) ELSE NULL END AS raw_price
      FROM products p LEFT JOIN stock s ON s.product_id=p.id
    ), enriched AS (
      SELECT p.*, CASE WHEN raw_price IS NULL THEN NULL ELSE CASE WHEN ${step}::numeric * ROUND(raw_price/${step}::numeric) > 0
        THEN ${step}::numeric * ROUND(raw_price/${step}::numeric) ELSE GREATEST(1, ROUND(raw_price)) END END AS catalog_price,
        CASE WHEN (p.product_type='other' AND p.unit IS NOT NULL AND catalog_quantity >= 1)
          OR (p.product_type='tile' AND p.sqm_per_carton > 0 AND ROUND(p.sqm_per_carton*100) > 0 AND catalog_quantity >= ROUND(p.sqm_per_carton*100)/100)
          THEN 'available' WHEN catalog_inquiry THEN 'inquiry' ELSE 'out_of_stock' END AS catalog_status
      FROM priced p
    ), matching AS (
      SELECT p.* FROM enriched p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN dimensions d ON d.id=p.dimension_id WHERE (${condition})${target}
    ), page AS (
      SELECT p.id,p.catalog_price AS price,p.catalog_quantity AS quantity,p.catalog_status AS status, row_number() OVER(ORDER BY ${sort}) AS ordinal
      FROM matching p ORDER BY ${sort} LIMIT ${limit} OFFSET ${offset}
    ) SELECT json_build_object('total',(SELECT COUNT(*) FROM matching),'rows',
      COALESCE((SELECT json_agg(json_build_object('id',id,'price',price,'quantity',quantity,'status',status) ORDER BY ordinal) FROM page),'[]'::json),
      'facets', ${input.mode === 'facets' ? facetSQL : "json_build_object('categories','[]'::json,'brands','[]'::json,'dimensions','[]'::json,'tags','[]'::json,'colors','[]'::json,'grades','[]'::json)"},
      'explain',${explanation}) AS result`,
    params,
  }
}
