import { motion } from "framer-motion"
import { Button } from "@heroui/react"
import { CodeSlots, type CodeSlotsStatus } from "@/components/ui/code-slots/code-slots"
import { RefreshCwIcon, PencilIcon, LockIcon } from "@/components/ui/icons"
import { toPersianDigits } from "@/lib/utils/currency"

interface LoginOtpStepProps {
  phone: string;
  otpCode: string;
  otpStatus: CodeSlotsStatus;
  isLoading: boolean;
  countdown: number;
  onEditPhone: () => void;
  onCodeChange: (val: string) => void;
  onVerify: (code?: string) => void;
  onResend: () => void;
}

export function LoginOtpStep({
  phone,
  otpCode,
  otpStatus,
  isLoading,
  countdown,
  onEditPhone,
  onCodeChange,
  onVerify,
  onResend,
}: LoginOtpStepProps) {
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return toPersianDigits(
      `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    );
  };

  return (
      <motion.div
        key="step-otp"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 12 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="space-y-4"
      >
        {/* Phone Info */}
        <div className="flex items-center justify-between rounded-2xl bg-muted/5 p-3">
          <div className="text-start">
            <span className="block text-xs text-muted">
              کد تأیید ارسال شد به:
            </span>

            <span
              className="text-sm font-extrabold tracking-wider text-foreground"
              dir="ltr"
            >
              {toPersianDigits(phone)}
            </span>
          </div>

          <Button
            type="button"
            onPress={onEditPhone}
            isDisabled={isLoading}
            className="flex h-8 cursor-pointer items-center gap-1 rounded-xl px-3 text-xs font-bold text-foreground bg-muted/10 transition-color hover:scale-[1.01]"
          >
            <PencilIcon size={14} />
            <span>ویرایش شماره</span>
          </Button>
        </div>

        <div>
          <label className="my-6 block text-start text-xs font-bold text-foreground/80">
            کد تأیید ۴ رقمی پیامک‌شده
          </label>

          <div
            className="flex w-full items-center justify-center mt-5"
            dir="ltr"
          >
            <CodeSlots
              length={4}
              radius={20}
              rise={9}
              cascade={60}
              status={otpStatus}
              value={otpCode}
              onChange={onCodeChange}
              onComplete={(code) => onVerify(code)}
              disabled={isLoading}
              autoFocus
              slotSize={56}
              bounce={0.3}
              gap={12}
              settle={0.5}
            />
          </div>
        </div>

        <Button
          type="button"
          onPress={() => onVerify()}
          className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
        >
          {isLoading ? (
            <RefreshCwIcon size={18} className="animate-spin" />
          ) : (
            <>
              <LockIcon size={16} />
              <span>تأیید و ورود به پنل</span>
            </>
          )}
        </Button>
        <div className="flex items-center justify-between pt-1 text-xs">
          {countdown > 0 ? (
            <span className="font-medium text-muted">
              امکان ارسال مجدد تا:{" "}
              <strong className="font-bold text-foreground">
                {formatTimer(countdown)}
              </strong>
            </span>
          ) : (
            <Button
              type="button"
              onPress={onResend}
              isDisabled={isLoading}
              className="flex h-auto min-w-0 cursor-pointer items-center gap-1.5 bg-transparent p-0 text-xs font-bold text-primary hover:opacity-80"
            >
              <RefreshCwIcon size={14} />
              <span>ارسال مجدد پیامک کد</span>
            </Button>
          )}
        </div>
      </motion.div>
  );
}
