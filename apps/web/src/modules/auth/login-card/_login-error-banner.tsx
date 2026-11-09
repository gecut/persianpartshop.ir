import { motion } from "framer-motion"
import { AlertCircleIcon } from "@/components/ui/icons"

interface LoginErrorBannerProps {
  message: string;
}

export function LoginErrorBanner({ message }: LoginErrorBannerProps) {
  return (
    <motion.div
      key="login-error"
      initial={{ opacity: 0, height: 0, y: -8 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mb-4 overflow-hidden"
    >
      <div className="flex items-start gap-2.5 rounded-2xl border border-danger/20 bg-danger/10 py-3.5 px-2 text-xs font-semibold text-danger">
        <AlertCircleIcon
          size={18}
          className="mt-0.5 shrink-0 text-danger"
        />
        <span className="leading-relaxed">{message}</span>
      </div>
    </motion.div>
  );
}
