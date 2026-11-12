import { useEffect } from "react";

import { LoginCard } from "./login-card/login-card";

export function LoginView() {
  // Sync Safari top & bottom safe areas and theme-color with login background
  useEffect(() => {
    const { documentElement, body } = document;
    const loginBackground = getComputedStyle(documentElement)
      .getPropertyValue("--color-login-background")
      .trim();
    const themeColors = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
      (element) => ({ element, content: element.content }),
    );
    const previousHtmlBackground = documentElement.style.backgroundColor;
    const previousBodyBackground = body.style.backgroundColor;

    for (const { element } of themeColors) element.content = loginBackground;
    documentElement.style.backgroundColor = loginBackground;
    body.style.backgroundColor = loginBackground;

    return () => {
      for (const { element, content } of themeColors) element.content = content;
      documentElement.style.backgroundColor = previousHtmlBackground;
      body.style.backgroundColor = previousBodyBackground;
    };
  }, []);

  return (
    <div className="relative h-full min-h-dvh w-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-login-background pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
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
