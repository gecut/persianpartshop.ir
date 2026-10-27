import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Button, InputGroup } from "@heroui/react";
import {
  CodeSlots,
  type CodeSlotsStatus,
} from "../../components/ui/code-slots";

import { useAuth } from "./auth-store";
import { toast } from "../../components/feedback/toast";
import {
  RefreshCwIcon,
  AlertCircleIcon,
  PencilIcon,
  ShieldCheckIcon,
  LockIcon,
} from "../../components/ui/icons";
import { Smartphone2Icon } from "@solar-icons/react/outline/smartphone-2";

import { toPersianDigits } from "../../lib/utils/currency";

export function LoginCard() {
  const navigate = useNavigate();
  const { sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStatus, setOtpStatus] = useState<CodeSlotsStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(120);

  useEffect(() => {
    if (step !== "otp" || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleSendPhone = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMessage(null);

    const cleaned = phone.trim();

    if (!/^09\d{9}$/.test(cleaned)) {
      setErrorMessage(
        "لطفاً شماره موبایل معتبر ۱۱ رقمی (مانند ۰۹۱۲۳۴۵۶۷۸۹) وارد نمایید.",
      );
      return;
    }

    setIsLoading(true);

    try {
      await sendOtp(cleaned);

      setStep("otp");
      setCountdown(120);
      setOtpCode("");
      setOtpStatus("idle");

      toast.info(
        "کد تأیید ارسال شد",
        `پیامک حاوی کد تأیید ۴ رقمی برای شماره ${toPersianDigits(cleaned)} ارسال گردید.`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "خطا در ارسال کد اعتبارسنجی";

      setErrorMessage(msg);
      toast.error("خطای ورود", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify ?? otpCode).trim();
    setErrorMessage(null);

    if (!/^\d{4}$/.test(code)) {
      setErrorMessage("کد تأیید یکبار مصرف باید ۴ رقم باشد.");
      setOtpStatus("error");
      return;
    }

    setIsLoading(true);

    try {
      await verifyOtp(code);
      setOtpStatus("success");

      toast.success(
        "ورود موفقیت‌آمیز",
        "به سامانه سفارش‌گذاری عمده پرشین‌پارت خوش آمدید.",
      );

      const search = new URLSearchParams(window.location.search);
      const redirectUrl = search.get("redirect");

      setTimeout(() => {
        if (redirectUrl && !redirectUrl.includes("/login")) {
          try {
            const url = new URL(redirectUrl, window.location.origin);

            if (url.origin !== window.location.origin) {
              navigate({ to: "/product" });
              return;
            }

            navigate({
              to: url.pathname as any,
              search: Object.fromEntries(url.searchParams.entries()) as any,
            });
          } catch {
            navigate({ to: "/product" });
          }
        } else {
          navigate({ to: "/product" });
        }
      }, 1200);
    } catch (err: unknown) {
      setOtpStatus("error");
      const msg =
        err instanceof Error ? err.message : "کد وارد شده اشتباه است.";

      if (msg.includes("بیش از حد مجاز") || msg.includes("باطل شد")) {
        setErrorMessage(msg);
        toast.error("خطا", msg);
      } else {
        setErrorMessage(null);
        toast.error("کد وارد شده اشتباه است");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return toPersianDigits(
      `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      <div className="w-full rounded-3xl bg-background p-6 sm:p-8 py-20">
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 p-2.5">
            <img
              src="/assets/images/persian-part-logo.png"
              alt="پرشین‌پارت"
              className="size-10 object-contain"
            />
          </div>
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
            ورود به پرشین‌پارت
          </h1>
        </div>

        {/* Inline Error Message */}
        <AnimatePresence initial={false}>
          {errorMessage && (
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
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Transition */}
        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.form
              key="step-phone"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              onSubmit={handleSendPhone}
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

                      setPhone(cleaned);
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
          ) : (
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
                  onPress={() => {
                    setStep("phone");
                    setErrorMessage(null);
                  }}
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
                    onChange={(val) => {
                      setOtpCode(val);
                      if (otpStatus !== "idle") setOtpStatus("idle");
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onComplete={(code) => handleVerifyOtp(code)}
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
                onPress={() => handleVerifyOtp()}
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
                    onPress={() => handleSendPhone()}
                    isDisabled={isLoading}
                    className="flex h-auto min-w-0 cursor-pointer items-center gap-1.5 bg-transparent p-0 text-xs font-bold text-primary hover:opacity-80"
                  >
                    <RefreshCwIcon size={14} />
                    <span>ارسال مجدد پیامک کد</span>
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer B2B Notice */}
        <div className="mt-7 pt-4 text-center">
          <div className="mb-1 flex items-center justify-center gap-1.5 text-xs text-muted">
            <ShieldCheckIcon size={14} className="shrink-0 text-primary/70" />
            <span>
              افتتاح حساب مشتریان جدید منحصراً توسط مدیریت انجام می‌شود.
            </span>
          </div>

          <p className="text-xs text-muted/70">
            پشتیبانی امور نمایندگان:{" "}
            <span className="font-bold text-foreground/80" dir="ltr">
              ۰۲۱-۸۸۸۸۸۸۸۸
            </span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
