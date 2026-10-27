import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  GridIcon,
  PackageIcon,
  UserIcon,
  ClipboardListIcon,
} from "../ui/icons";
import { PillNav, type PillNavItem } from "../ui/pill-nav";

export function MobileBottomNav() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  // Do not show bottom nav on product quantity configuration page
  if (
    pathname.startsWith("/product/new") ||
    pathname.startsWith("/products/new")
  ) {
    return null;
  }

  const activeHref = useMemo(() => {
    if (pathname.startsWith("/plans")) return "/plans";
    if (pathname.startsWith("/orders")) return "/orders";
    if (pathname.startsWith("/account")) return "/account";
    return "/product";
  }, [pathname]);

  const navItems: PillNavItem[] = useMemo(
    () => [
      {
        href: "/product",
        label: "محصولات",
        icon: <GridIcon size={19} className="shrink-0" />,
      },
      {
        href: "/plans",
        label: "طرح‌ها",
        icon: <ClipboardListIcon size={19} className="shrink-0" />,
      },
      {
        href: "/orders",
        label: "سفارش‌ها",
        icon: <PackageIcon size={19} className="shrink-0" />,
      },
      {
        href: "/account",
        label: "حساب من",
        icon: <UserIcon size={19} className="shrink-0" />,
      },
    ],
    [],
  );

  return (
    <>
      <nav
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] inset-x-0 mx-auto w-[calc(100%-32px)] max-w-xl z-40 p-1.5 rounded-2xl bg-[#252745] backdrop-blur-xl border-none shadow-none"
        aria-label="منوی ناوبری"
      >
        <PillNav
          items={navItems}
          activeHref={activeHref}
          linkComponent={Link}
          layout="joined"
          itemStyle="pill"
          hoverEffect="fill"
          indicator="pill"
          collapse="never"
          bounce={0.7}
          stretch={1}
          surface="none"
          tileColor="#252745"
          highlightColor="#ffffff"
          highlightTextColor="#1c1696"
          textColor="#ffffff"
          orientation="vertical"
          className="w-full h-14 whitespace-nowrap text-xs border-none! shadow-none! [box-shadow:none]!"
        />
      </nav>
      {/* Solid white underlay for the space below nav bottom */}
      <div
        className="fixed bottom-0 inset-x-0 h-[calc(1.5rem+env(safe-area-inset-bottom,0px))] bg-white z-30 pointer-events-none"
        aria-hidden="true"
      />
    </>
  );
}
