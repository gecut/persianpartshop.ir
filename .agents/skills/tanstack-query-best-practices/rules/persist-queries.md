# persist-queries: Safe Query Persistence

## Priority: LOW

- **Default: do not persist the Query cache.** Keep it in memory unless persistence is explicitly requested.
- If requested, allowlist only queries verified to contain public data; deny all other queries by default. Do not persist mutations.
- Never persist sessions, tokens, personally identifiable information (PII), or order data, including in query keys, values, or metadata.
- Review `apps/web/src/lib/query-keys.ts`, actual key parameters, and serialized data before enabling persistence. For example, `auth.session` can include a token in its key.

Use `dehydrateOptions.shouldDehydrateQuery` for the allowlist and `shouldDehydrateMutation` to exclude mutations. See the official [persistence documentation](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient) and [hydration reference](https://tanstack.com/query/latest/docs/framework/react/reference/hydration).
