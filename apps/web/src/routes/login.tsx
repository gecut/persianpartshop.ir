import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LoginCard } from "../features/auth/login-card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  // Sync Safari top & bottom safe areas and theme-color with login background
  useEffect(() => {
    const loginBgColor = "#f8f8fa";
    const metaTags = document.querySelectorAll('meta[name="theme-color"]');
    metaTags.forEach((el) => el.setAttribute("content", loginBgColor));

    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;

    document.documentElement.style.backgroundColor = loginBgColor;
    document.body.style.backgroundColor = loginBgColor;

    return () => {
      metaTags.forEach((el) => el.setAttribute("content", "#ffffff"));
      document.documentElement.style.backgroundColor = prevHtmlBg || "#ffffff";
      document.body.style.backgroundColor = prevBodyBg || "#ffffff";
    };
  }, []);

  return (
    <div className="relative h-full min-h-dvh w-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-[#f8f8fa] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      {/* Subtle ambient lighting */}
      <div
        className="absolute top-0 inset-x-0 h-full to-transparent pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md my-auto">
        <LoginCard />
      </div>
    </div>
  );
}
