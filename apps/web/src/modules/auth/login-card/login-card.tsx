import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { match } from "ts-pattern";
import type { CodeSlotsStatus } from "@/components/ui/code-slots/code-slots";
import { useAuth } from "@/modules/auth/auth-store";
import { toast } from "@/components/feedback/toast";
import { toPersianDigits } from "@/lib/utils/currency";
import { LoginBrandHeader } from "./_login-brand-header";
import { LoginErrorBanner } from "./_login-error-banner";
import { LoginPhoneStep } from "./_login-phone-step";
import { LoginOtpStep } from "./_login-otp-step";
import { LoginFooterNotice } from "./_login-footer-notice";
import { startWebOtp } from "./_web-otp";

export function LoginCard() {
  const navigate = useNavigate();
  const { sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otpAttempt, setOtpAttempt] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [otpStatus, setOtpStatus] = useState<CodeSlotsStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(120);
  const isSubmitting = useRef(false);
  const webOtpController = useRef<AbortController | null>(null);

  useEffect(() => {
    const abort = () => webOtpController.current?.abort();
    window.addEventListener("pagehide", abort);
    return () => {
      window.removeEventListener("pagehide", abort);
      abort();
    };
  }, []);

  useEffect(() => {
    if (step !== "otp" || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleSendPhone = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting.current) return;
    setErrorMessage(null);

    const cleaned = phone.trim();

    if (!/^09\d{9}$/.test(cleaned)) {
      setErrorMessage(
        "لطفاً شماره موبایل معتبر ۱۱ رقمی (مانند ۰۹۱۲۳۴۵۶۷۸۹) وارد نمایید.",
      );
      return;
    }

    isSubmitting.current = true;
    setIsLoading(true);
    webOtpController.current?.abort();
    const webOtp = startWebOtp();
    webOtpController.current = webOtp?.controller ?? null;

    try {
      const resultMessage = await sendOtp(cleaned);

      setStep("otp");
      setCountdown(120);
      setOtpAttempt((attempt) => attempt + 1);
      setOtpCode("");
      setOtpStatus("idle");

      if (webOtp) {
        void webOtp.code.then((code) => {
          if (webOtp.controller.signal.aborted) return;
          webOtp.controller.abort();
          if (code) setOtpCode(code);
        });
      }

      toast.info(
        "کد تأیید ارسال شد",
        typeof resultMessage === "string"
          ? resultMessage
          : `پیامک حاوی کد تأیید ۴ رقمی برای شماره ${toPersianDigits(cleaned)} ارسال گردید.`,
      );
    } catch (err: unknown) {
      webOtp?.controller.abort();
      const msg =
        err instanceof Error ? err.message : "خطا در ارسال کد اعتبارسنجی";

      setErrorMessage(msg);
      toast.error("خطای ورود", msg);
    } finally {
      isSubmitting.current = false;
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    if (isSubmitting.current) return;
    const code = (codeToVerify ?? otpCode).trim();
    setErrorMessage(null);

    if (!/^\d{4}$/.test(code)) {
      setErrorMessage("کد تأیید یکبار مصرف باید ۴ رقم باشد.");
      setOtpStatus("error");
      return;
    }

    isSubmitting.current = true;
    webOtpController.current?.abort();
    setIsLoading(true);
    const loginRedirect = new URLSearchParams(window.location.search).get('redirect');

    try {
      await verifyOtp(code);
      setOtpStatus("success");

      toast.success(
        "ورود موفقیت‌آمیز",
        "به سامانه سفارش‌گذاری عمده پرشین‌پارت خوش آمدید.",
      );

      let destination = '/product';
      try {
        const url = new URL(loginRedirect || '/product', window.location.origin);
        if (url.origin === window.location.origin && url.pathname !== '/login') destination = url.pathname + url.search + url.hash;
      } catch { /* Fall back to the catalog. */ }
      await navigate({ href: destination, replace: true });
    } catch (err: unknown) {
      setOtpStatus("error");
      const msg =
        err instanceof Error ? err.message : "کد وارد شده اشتباه است.";

      setErrorMessage(msg);
      toast.error("خطای ورود", msg);
    } finally {
      isSubmitting.current = false;
      setIsLoading(false);
    }
  };

  const handleOtpChange = (val: string) => {
    setOtpCode(val);
    if (otpStatus !== "idle") setOtpStatus("idle");
    if (errorMessage) setErrorMessage(null);
  };

  const handleEditPhone = () => {
    webOtpController.current?.abort();
    setStep("phone");
    setErrorMessage(null);
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
        <LoginBrandHeader />

        {/* Inline Error Message */}
        <AnimatePresence initial={false}>
          {errorMessage && (
            <LoginErrorBanner key="login-error" message={errorMessage} />
          )}
        </AnimatePresence>

        {/* Step Transition */}
        <AnimatePresence mode="wait">
          {match(step)
            .with("phone", () => (
              <LoginPhoneStep
                key="step-phone"
                phone={phone}
                isLoading={isLoading}
                onPhoneChange={setPhone}
                onSubmit={handleSendPhone}
              />
            ))
            .with("otp", () => (
              <LoginOtpStep
                key="step-otp"
                phone={phone}
                otpAttempt={otpAttempt}
                otpCode={otpCode}
                otpStatus={otpStatus}
                isLoading={isLoading}
                countdown={countdown}
                onEditPhone={handleEditPhone}
                onCodeChange={handleOtpChange}
                onVerify={handleVerifyOtp}
                onResend={() => handleSendPhone()}
              />
            ))
            .exhaustive()}
        </AnimatePresence>

        {/* Footer B2B Notice */}
        <LoginFooterNotice />
      </div>
    </motion.div>
  );
}
