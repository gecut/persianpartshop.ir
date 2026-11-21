/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. MODIFY AT YOUR OWN RISK. */
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import {
  handleServerFunctions,
  RootLayout,
} from '@payloadcms/next/layouts'
import type { Viewport } from 'next'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './custom.css'
import AdminEnhancements from './admin-enhancements'

type Args = {
  children: React.ReactNode
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

const Layout = ({ children }: Args) => (
  <RootLayout
    config={config}
    importMap={importMap}
    serverFunction={serverFunction}
    htmlProps={{ dir: 'rtl', lang: 'fa' }}
  >
    <AdminEnhancements />
    {children}
  </RootLayout>
)

export default Layout
