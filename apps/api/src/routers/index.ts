import { base } from '../rpc/base'
import { auth } from './auth'
import { catalog } from './catalog'
import { shopping } from './shopping'
import { order } from './order'
import { customer } from './customer'
import { user } from './user'
import { plan } from './plan'

export { auth, catalog, shopping, order, customer, user, plan }

export const router = base.router({
  health: base.health.handler(() => ({ status: 'ok' })),
  echo: base.echo.handler(({ input }) => ({ echo: input })),

  auth,
  catalog,
  shopping,
  order,
  customer,
  user,
  plan,
})

export type AppRouter = typeof router
