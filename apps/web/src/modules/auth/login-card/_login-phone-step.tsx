import React from "react"
import { motion } from "framer-motion"
import { Button, InputGroup } from "@heroui/react"
import { RefreshCwIcon } from "@/components/ui/icons"
import { Smartphone2Icon } from "@solar-icons/react/outline/smartphone-2"

interface LoginPhoneStepProps {
  phone: string;
  isLoading: boolean;
  onPhoneChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function LoginPhoneStep({ phone, isLoading, onPhoneChange, onSubmit }: LoginPhoneStepProps) {
  return (
      <motion.form
        key="step-phone"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="phone-input"
            className="mb-2 block text-start text-xs font-light text-foreground/80"
          >
            شماره تلفن همراه
          </label>

          <InputGroup
            dir="ltr"
            fullWidth
            className="h-15 relative rounded-2xl text-s bg-foreground/5 transition-all shadow-none"
          >
            <InputGroup.Prefix className="pointer-events-none flex items-center justify-center ps-3.5 pe-1 text-muted">
              <Smartphone2Icon
                className="**:stroke-1"
                size={24}
                // className="absolute left-0 bottom-4"
              />
            </InputGroup.Prefix>

            <InputGroup.Input
              id="phone-input"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={phone}
              onChange={(e) => {
                const cleaned = e.target.value
                  .replace(/[۰-۹]/g, (d) =>
                    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
                  )
                  .replace(/[٠-٩]/g, (d) =>
                    String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
                  )
                  .replace(/\D/g, "")
                  .slice(0, 11);

                onPhoneChange(cleaned);
              }}
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              dir="ltr"
              autoFocus
              disabled={isLoading}
              className="h-14 flex-1 shadow-none! px-4 text-left text-sm font-bold tracking-widest text-foreground outline-hidden placeholder:text-sm placeholder:font-light border-0 ring-0"
            />
          </InputGroup>
        </div>

        <Button
          type="submit"
          className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 "
        >
          {isLoading ? (
            <RefreshCwIcon size={18} className="animate-spin" />
          ) : (
            <>
              <span>دریافت کد ورود</span>
            </>
          )}
        </Button>
      </motion.form>
  );
}
