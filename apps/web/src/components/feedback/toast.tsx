import { Toast, toast as heroUIToast } from '@heroui/react'

export const toast = {
  success: (title: string, description?: string) => {
    heroUIToast.success(title, { description })
  },
  error: (title: string, description?: string) => {
    heroUIToast.danger(title, { description })
  },
  warning: (title: string, description?: string) => {
    heroUIToast.warning(title, { description })
  },
  info: (title: string, description?: string) => {
    heroUIToast.info(title, { description })
  },
}

export function ToastContainer() {
  return <Toast.Provider placement="top" className="bottom-20 sm:bottom-6 text-right z-50" dir="rtl" />
}

