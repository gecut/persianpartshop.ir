import { mcpPlugin, type MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { StockImportModeSchema, SubmitOrderInputSchema } from '@persianpart/contract'
import { APIError, UnauthorizedError, type CollectionConfig } from 'payload'
import { z } from 'zod'
import { retryFailedSms } from '../collections/sms-queue/_retry-sms.endpoint'
import { exportPrices } from '../collections/warehouse-stock/_import.endpoints'
import { adjustProductStock, readProductStock, stockAdjustmentSchema } from '../collections/warehouse-stock/_product-stock.endpoints'
import { configureMcpKeys, logMcpOperation, mcpEnabled, mcpKeySchema, restrictMcpWrites } from './access'
import { csvPreview, issueUpload } from './transfers'

const full = { find: true, create: true, update: true, delete: true }
const readWrite = { find: true, create: true, update: true }
const readUpdate = { find: true, update: true }
const read = { find: true }
const collections = {
  products: { enabled: full, description: 'Catalog products, base prices, SKU and media links. Use the stock tools for warehouse balances.' },
  categories: { enabled: full, description: 'Catalog categories and their parent relationships.' },
  brands: { enabled: full },
  tags: { enabled: full },
  dimensions: { enabled: full },
  plans: { enabled: full, description: 'Sales plans and eligible products or customers.' },
  users: { enabled: readWrite, description: 'Customer accounts and their assigned customer type.' },
  'customer-types': { enabled: read },
  'supply-requests': { enabled: readUpdate },
  orders: { enabled: readUpdate, description: 'Sales orders. Use createOrders to register an order. Updates can change stock and queue notifications.' },
  warehouses: { enabled: readWrite },
  'warehouse-stock': { enabled: read },
  media: { enabled: { ...readUpdate, delete: true }, description: 'Existing images and their metadata. Use prepareMediaUpload for a new image.' },
  'sms-queue': { enabled: read, description: 'Display SMS queue state. Use retryFailedSms to retry a failed item.' },
} satisfies NonNullable<MCPPluginConfig['collections']>

type Tool = NonNullable<NonNullable<MCPPluginConfig['mcp']>['tools']>[number]

function tool<Shape extends z.ZodRawShape>(
  name: string, description: string, schema: z.ZodObject<Shape>,
  run: (input: z.output<z.ZodObject<Shape>>, req: Parameters<Tool['handler']>[1]) => unknown | Promise<unknown>,
): Tool {
  return {
    name, description, parameters: schema.shape,
    handler: async (args, req) => {
      const identity = args.id ?? args.productId ?? args.previewId
      const recordId = typeof identity === 'string' || typeof identity === 'number' ? identity : undefined
      const event = { msg: 'MCP tool', tool: name, actor: req.user?.id, id: recordId }
      req.context.mcpCustomTool = name
      try {
        let result = await run(schema.parse(args), req)
        if (result instanceof Response) {
          const body: unknown = result.headers.get('content-type')?.includes('application/json')
            ? await result.json() : await result.text()
          if (!result.ok) {
            const message = z.object({ error: z.string() }).safeParse(body)
            throw new APIError(message.success ? message.data.error : 'Operation failed.', result.status, undefined, true)
          }
          result = body
        }
        req.payload.logger.info({ ...event, result: 'ok' })
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      } catch (error) {
        req.payload.logger.warn({ ...event, result: 'error' })
        const message = error instanceof APIError && error.isPublic ? error.message
          : error instanceof z.ZodError ? 'Check the tool input.' : 'Operation failed.'
        return { isError: true, content: [{ type: 'text', text: message }] }
      }
    },
  }
}

const id = z.number().int().positive().safe()
const page = z.number().int().min(1).max(1_000_000).default(1)

const tools = [
  tool('createOrders', 'Register a pending order for one customer and warehouse. The CMS calculates prices and reserves stock. Confirm before placing.',
    SubmitOrderInputSchema.extend({ customerId: id }),
    async ({ customerId, warehouseId, items, ...details }, req) => {
      const order = await req.payload.create({
        collection: 'orders', req, depth: 0, overrideAccess: false,
        data: {
          ...details, user: customerId, warehouse: warehouseId, status: 'pending',
          trackingNumber: 0, orderNumber: '', subtotal: 0, finalTotal: 0,
          items: items.map(item => ({
            product: id.parse(Number(item.productId)), requestedArea: item.requestedArea ?? item.requestedSqm!,
            cartonCount: 0, deliverableArea: 0, unitPrice: 0, totalPrice: 0,
          })),
        },
      })
      return { id: order.id, trackingNumber: order.trackingNumber, status: order.status, finalTotal: order.finalTotal }
    }),
  tool('readProductStock', 'Read stock balances and versions for a product by warehouse.', z.object({ productId: id }),
    (input, req) => readProductStock(req, input.productId)),
  tool('adjustProductStock', 'Set one warehouse balance from its current revision. Confirm the warehouse and before/after amounts first.',
    stockAdjustmentSchema.extend({ productId: id }),
    ({ productId, ...change }, req) => adjustProductStock(req, productId, () => change)),
  tool('prepareMediaUpload', 'Issue a five-minute ticket for one local image. Send the file as multipart to the returned path.',
    z.object({ alt: z.string().trim().min(1).max(500) }),
    (input, req) => issueUpload(req, { kind: 'media', ...input })),
  tool('prepareCsvImport', 'Issue a five-minute ticket for a local CSV. Upload it to generate a preview without changing stock or prices.',
    z.object({ mode: StockImportModeSchema, warehouseId: id.optional() }),
    (input, req) => issueUpload(req, { kind: 'csv', ...input })),
  tool('getCsvImportPreview', 'Read the import preview summary plus a page of rows and errors.',
    z.object({ previewId: z.string().uuid(), page }),
    (input, req) => csvPreview(req, input.previewId, input.page)),
  tool('applyCsvImport', 'Apply the exact changes in an unexpired, error-free preview. Confirm the preview before calling.',
    z.object({ previewId: z.string().uuid() }),
    (input, req) => csvPreview(req, input.previewId, 1, true)),
  tool('exportPrices', 'Export a page of 100 prices as CSV.', z.object({ page }),
    (input, req) => exportPrices(req, 'price', input.page, 100)),
  tool('retryFailedSms', 'Requeue a single failed SMS. Confirm the message ID before calling.', z.object({ id }),
    (input, req) => retryFailedSms(req, input.id)),
]

export const cmsMcp = mcpPlugin({
  disabled: !mcpEnabled,
  userCollection: 'admins',
  collections,
  mcp: { tools },
  overrideApiKeyCollection: configureMcpKeys,
  overrideAuth: async (_req, resolveDefault) => {
    const access = await resolveDefault()
    if (!mcpKeySchema.safeParse(access).success) throw new UnauthorizedError()
    return access
  },
})

export function addMcpWriteGuards(configs: CollectionConfig[]) {
  return configs.map(collection => {
    if (!Object.hasOwn(collections, collection.slug)) return collection
    return {
      ...collection,
      hooks: {
        ...collection.hooks,
        beforeOperation: [restrictMcpWrites, ...(collection.hooks?.beforeOperation ?? [])],
        afterOperation: [...(collection.hooks?.afterOperation ?? []), logMcpOperation],
      },
    }
  })
}
