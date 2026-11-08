import { RPCHandler } from '@orpc/server/fetch'
import { COMMON_ERROR_STATUS_MAP } from '@orpc/server'
import {
  GetMethodCsrfProtectionHandlerPlugin as StrictGetMethodPlugin,
  RequestHeadersPlugin,
  ResponseHeadersPlugin,
  CORSPlugin,
} from '@orpc/server/plugins'
import { router } from '../routers'

export const handler = new RPCHandler<any>(router, {
  errorStatusMap: { ...COMMON_ERROR_STATUS_MAP, EXACT_STOCK_AVAILABLE: 409, SOURCE_UNAVAILABLE: 409, CANNOT_CANCEL: 409 },
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
