import { createHmac } from 'node:crypto'
import { Forbidden, UnauthorizedError, type CollectionAfterOperationHook, type CollectionBeforeOperationHook, type CollectionConfig, type Field, type PayloadRequest } from 'payload'
import { z } from 'zod'
import { getAdminUser, isSuperAdmin } from '../access/roles'
import { businessError } from '../lib/validation'

export const mcpEnabled = process.env.CMS_MCP_ENABLED === 'true'

const manager = z.object({
  id: z.number().int().positive(),
  collection: z.literal('admins'),
  isActive: z.literal(true),
  role: z.literal('manager'),
})

export function requireMcpManager(user: unknown) {
  const result = manager.safeParse(user)
  if (!result.success) throw new Forbidden()
  return result.data
}

export const mcpKeySchema = z.object({
  id: z.number().int().positive(),
  enableAPIKey: z.literal(true),
  user: manager,
})

export function keyDigest(req: PayloadRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ') || !authorization.slice(7).trim()) throw new UnauthorizedError()
  return createHmac('sha256', req.payload.secret).update(authorization.slice(7).trim()).digest('hex')
}

const canIssueKey = ({ req }: { req: PayloadRequest }) => isSuperAdmin({ req }) === true

function disableCapabilityDefaults(fields: Field[]): Field[] {
  return fields.map(field => {
    if (field.type === 'checkbox') return { ...field, defaultValue: false }
    if (field.type === 'collapsible' || field.type === 'group' || field.type === 'row') {
      return { ...field, fields: disableCapabilityDefaults(field.fields) }
    }
    if (field.type === 'relationship' && field.name === 'user') {
      return { ...field, defaultValue: undefined, access: { create: canIssueKey, update: () => false } }
    }
    return field
  })
}

export function configureMcpKeys(collection: CollectionConfig): CollectionConfig {
  return {
    ...collection,
    lockDocuments: false,
    access: {
      create: canIssueKey, read: canIssueKey, update: canIssueKey, delete: canIssueKey, unlock: canIssueKey,
    },
    fields: disableCapabilityDefaults(collection.fields),
    hooks: {
      ...collection.hooks,
      beforeChange: [
        ...(collection.hooks?.beforeChange ?? []),
        async ({ data, operation, req }) => {
          if (operation !== 'create') return data
          const owner = await req.payload.findByID({ collection: 'admins', id: data.user, req, depth: 0, overrideAccess: false })
          if (getAdminUser({ ...owner, collection: 'admins' })?.role !== 'manager' || owner.isActive !== true) {
            throw businessError('Select an active manager as key owner.', 'MCP_INVALID_OWNER', 400)
          }
          return data
        },
      ],
    },
  }
}

export const restrictMcpWrites: CollectionBeforeOperationHook = ({ req, args, operation }) => {
  if (req.payloadAPI !== 'MCP') return
  if (operation === 'update' || operation === 'delete' || operation === 'updateByID' || operation === 'deleteByID') {
    if (!('id' in args) || args.id == null || args.id === '') {
      req.payload.logger.warn({ msg: 'MCP collection operation', tool: operation, collection: args.collection.config.slug, actor: req.user?.id, result: 'id-required' })
      throw businessError('Specify a single record ID.', 'MCP_ID_REQUIRED', 400)
    }
    args.overrideLock = false
  }
}

export const logMcpOperation: CollectionAfterOperationHook = ({ req, collection, args, result, operation }) => {
  if (req.payloadAPI !== 'MCP' || req.context.mcpCustomTool) return
  const verbs: Partial<Record<typeof operation, string>> = { create: 'create', find: 'find', findByID: 'find', updateByID: 'update', deleteByID: 'delete' }
  const verb = verbs[operation]
  if (!verb) return
  const name = collection.slug.split('-').map(part => part[0]?.toUpperCase() + part.slice(1)).join('')
  const recordId = 'id' in args ? args.id : result && typeof result === 'object' && 'id' in result ? result.id : undefined
  req.payload.logger.info({ msg: 'MCP collection operation', tool: verb + name, actor: req.user?.id, id: recordId, result: 'ok' })
}
