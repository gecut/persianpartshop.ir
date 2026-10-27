import { RPCHandler } from '@orpc/server/fetch'
import {
  GetMethodCsrfProtectionHandlerPlugin as StrictGetMethodPlugin,
  RequestHeadersPlugin,
  ResponseHeadersPlugin,
  CORSPlugin,
} from '@orpc/server/plugins'
import { router } from '../routers'

export const handler = new RPCHandler<any>(router, {
  plugins: [
    new StrictGetMethodPlugin(),
    new RequestHeadersPlugin(),
    new ResponseHeadersPlugin(),
    new CORSPlugin({
      origin: (origin) => origin,
      credentials: true,
      allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH'],
    }),
  ],
})
