import { oc } from '@orpc/contract'
import { z } from 'zod'
import { authContract } from './auth'
import { catalogContract } from './catalog'
import { customerContract, userContract } from './customer'
import { orderContract } from './order'
import { planContract } from './plan'
import { shoppingContract } from './shopping'
import { warehouseContract } from './warehouse'
import { supplyRequestContract } from './supply-request'
import { offlineContract } from './offline'
import { activityFeedContract } from './activity-feed'

/**
 * Root Contract for PersianPart Monorepo (Single Source of Truth - SSOT).
 * Consolidated into all domains:
 * 1. health & echo - Root probes
 * 2. auth          - Customer OTP authentication & sessions
 * 3. catalog       - Products, parts, categories, brands, tags, dimensions, carton calculation
 * 4. shopping      - Addresses, cart products, and checkout methods
 * 5. customer      - Customer profile & customer pricing tiers
 * 6. user          - User profile, listing, and updates
 * 7. order         - Order lifecycle, reorder preparation & cart pricing validation
 * 8. plan          - Personalized credit terms & promotional plans
 * 9. warehouse     - Whole-cart warehouse eligibility and authoritative quote
 * 10. supplyRequest- Inquiry supply request lifecycle
 * 11. activityFeed - Unified orders and supply requests feed
 */
export const appContract = {
  health: oc.output(
    z.object({
      status: z.string(),
    })
  ),

  echo: oc
    .input(z.any())
    .output(
      z.object({
        echo: z.any(),
      })
    ),

  auth: authContract,
  catalog: catalogContract,
  shopping: shoppingContract,
  customer: customerContract,
  user: userContract,
  order: orderContract,
  plan: planContract,
  warehouse: warehouseContract,
  supplyRequest: supplyRequestContract,
  activityFeed: activityFeedContract,
  offline: offlineContract,
}

export type AppContract = typeof appContract
export const contract = appContract

export * from './common'
export * from './auth'
export * from './catalog'
export * from './shopping'
export * from './customer'
export * from './order'
export * from './plan'
export * from './warehouse'
export * from './supply-request'
export * from './activity-feed'

export * from './offline'
