const WEB_OTP_TIMEOUT_MS = 120_000;

async function readSmsCode(signal: AbortSignal): Promise<string | null> {
  try {
    const options = { otp: { transport: ["sms"] }, signal };
    const credential = await navigator.credentials.get(options);
    if (
      credential &&
      "code" in credential &&
      typeof credential.code === "string" &&
      /^\d{4}$/.test(credential.code)
    ) {
      return credential.code;
    }
  } catch {
    // WebOTP is optional. The user can still enter the code directly.
  }
  return null;
}

export function startWebOtp() {
  if (!window.isSecureContext || !("OTPCredential" in window)) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), WEB_OTP_TIMEOUT_MS);
  controller.signal.addEventListener("abort", () => window.clearTimeout(timeout), { once: true });

  return { controller, code: readSmsCode(controller.signal) };
}
