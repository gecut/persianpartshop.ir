import { match, P } from 'ts-pattern'

export function isSessionError(error: unknown): boolean {
  return match(error)
    .with(
      P.union(
        { code: 'UNAUTHORIZED' },
        { status: P.union(401, '401') },
        { data: { code: 'USER_BANNED' } },
        { error: { code: 'UNAUTHORIZED' } },
        { error: { status: P.union(401, '401') } },
        { error: { data: { code: 'USER_BANNED' } } }
      ),
      () => true
    )
    .otherwise(() => false)
}
