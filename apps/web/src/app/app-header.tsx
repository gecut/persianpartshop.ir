import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/modules/auth/auth-store";
import { UserIcon } from "@/components/ui/icons";
import { useOfflineAccountStatus } from "@/modules/pwa/offline-account-card";
import { offlineRecoveryEnabled } from "@/modules/pwa/read-source";
import { match, P } from "ts-pattern";

export function AppHeader() {
  const { user, isAuthenticated } = useAuth();
  const { expiresSoon, updateAvailable } = useOfflineAccountStatus();
  const offlineAttention = offlineRecoveryEnabled && (expiresSoon || updateAvailable);
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const pageName = match(pathname)
    .with(P.when((p: string) => p.startsWith("/product") || p === "/"), () => "محصولات")
    .with(P.when((p: string) => p.startsWith("/plans")), () => "طرح‌ها")
    .with(P.when((p: string) => p.startsWith("/orders")), () => "سفارش‌ها")
    .with(P.when((p: string) => p.startsWith("/login")), () => "ورود")
    .with("/account", () => "حساب من")
    .otherwise(() => "");

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full px-4 h-14 max-w-xl mx-auto flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <Link
          to="/product"
          className="flex items-center gap-2 group cursor-pointer shrink-0 active:scale-98 transition-transform"
        >
          <div className="flex items-center gap-1.5 size-8 rounded-xl overflow-hidden">
            <img
              src="/icon-192.png"
              alt="پرشین‌پارت"
              className="size-full object-contain"
            />
          </div>
        </Link>
        <span className="font-bold text-foreground text-sm">{pageName}</span>
        {/* Actions: Profile */}
        {isAuthenticated && user ? (
          <Link
            to="/account"
            className="relative size-10 rounded-2xl px-2 ms-1 bg-muted/5 hover:bg-muted/15 text-foreground transition-all flex items-center justify-center active:scale-95"
            aria-label="حساب کاربری"
          >
            <UserIcon size={20} className="text-primary" />
            {offlineAttention && <span className="absolute end-1 top-1 size-2 rounded-full bg-warning"
              aria-label={updateAvailable ? "نسخهٔ جدید داده‌های آفلاین" : "مهلت بستهٔ آفلاین رو به پایان است"} />}
          </Link>
        ) : (
          <Link
            to="/login"
            className="size-10 rounded-2xl bg-muted/10 hover:bg-muted/20 text-foreground transition-all flex items-center justify-center active:scale-95"
            aria-label="ورود همکاران"
          >
            <UserIcon size={20} className="text-primary" />
          </Link>
        )}
      </div>
    </header>
  );
}
