import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@heroui/react";
import { WiFiOffIcon } from "@solar-icons/react/linear";
import { registerSW } from "virtual:pwa-register";
import { match } from "ts-pattern";
import { flushDrafts } from "@/lib/drafts";
import { useWriteActivity, writeActivity } from "@/lib/write-activity";
import { PwaNotice } from "./pwa-notice";
import { offlineRecoveryEnabled } from "./read-source";
import { pauseOfflinePackage, useOfflinePackage } from "./offline-package";
import { OfflineProgress } from "./_offline-progress";
import { OfflineDownloadDialog } from "./_offline-download-dialog";
import { useAuth } from "@/modules/auth/auth-store";
import {
  getInstallPrompt,
  subscribeToInstallPrompt,
  takeInstallPrompt,
} from "./_install-prompt";
import { PwaDialog, type PwaDialogView } from "./pwa-dialog/pwa-dialog";

let waiting = false;
const serviceWorkers = navigator.serviceWorker;
let controller = serviceWorkers?.controller;
serviceWorkers?.addEventListener("controllerchange", () => {
  const previous = controller;
  const next = serviceWorkers.controller;
  controller = next;
  if (!previous || !next || previous === next) return;

  // controllerchange can arrive before the worker finishes its activate event.
  const reload = () => {
    if (next.state === "activating") return;
    next.removeEventListener("statechange", reload);
    if (next.state === "activated" && flushDrafts()) window.location.reload();
  };
  next.addEventListener("statechange", reload);
  reload();
});

const update = registerSW({
  onNeedRefresh() {
    waiting = true;
    window.dispatchEvent(new Event("persianpart:update-ready"));
  },
  onNeedReload() {
    /* The controller listener reloads once activation is complete. */
  },
  onRegisteredSW(_url, registration) {
    window.addEventListener(
      "online",
      () => void registration?.update().catch(() => {})
    );
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void registration?.update().catch(() => {});
    });
  },
});
const installed = () =>
  window.matchMedia(
    "(display-mode: standalone), (display-mode: window-controls-overlay)"
  ).matches ||
  ("standalone" in navigator && navigator.standalone === true);
const isAppleMobile =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isMacSafari =
  !isAppleMobile &&
  /Macintosh.+Version\/[^ ]+ Safari\//.test(navigator.userAgent);

export function PwaControls({
  allowInstallInvitation,
}: {
  allowInstallInvitation: boolean;
}) {
  const { user } = useAuth();
  const { progress, active, restoring } = useOfflinePackage();
  const [offerOffline, setOfferOffline] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [needUpdate, setNeedUpdate] = useState(waiting);
  const [dismissed, setDismissed] = useState(false);
  const [mode, setMode] = useState<"install" | "update" | null>(null);
  const prompt = useSyncExternalStore(
    subscribeToInstallPrompt,
    getInstallPrompt
  );
  const [isInstalled, setInstalled] = useState(installed);
  const [busy, setBusy] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState(false);
  const writes = useWriteActivity();
  const showUpdate = needUpdate && !dismissed;
  const showInvitation =
    allowInstallInvitation &&
    !needUpdate &&
    invitation &&
    !isInstalled &&
    (prompt !== null || isAppleMobile || isMacSafari);
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const ready = () => setNeedUpdate(true);
    const completed = () => {
      setInstalled(true);
      setInstalling(false);
    };
    const open = () => {
      setUpdateError(null);
      setMode(waiting ? "update" : "install");
    };
    const showProgress = () => {
      setMode(null);
      setShowDownload(true);
    };
    window.addEventListener(
      "persianpart:offline-download-started",
      showProgress
    );
    const login = () => {
      try {
        if (
          offlineRecoveryEnabled &&
          !localStorage.getItem("persianpart_offline_offered")
        )
          setOfferOffline(true);
        if (
          !installed() &&
          !localStorage.getItem("persianpart_install_offered")
        ) {
          setInvitation(true);
        }
      } catch {
        /* Optional invitation must not interfere with login. */
      }
    };
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("persianpart:update-ready", ready);
    window.addEventListener("appinstalled", completed);
    window.addEventListener("persianpart:pwa-open", open);
    window.addEventListener("persianpart:login-success", login);
    return () => {
      window.removeEventListener(
        "persianpart:offline-download-started",
        showProgress
      );
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("persianpart:update-ready", ready);
      window.removeEventListener("appinstalled", completed);
      window.removeEventListener("persianpart:pwa-open", open);
      window.removeEventListener("persianpart:login-success", login);
    };
  }, []);

  useEffect(() => {
    if (!showInvitation) return;
    try {
      if (localStorage.getItem("persianpart_install_offered")) return;
      localStorage.setItem("persianpart_install_offered", "1");
      window.dispatchEvent(new Event("persianpart:install-invitation"));
    } catch {
      /* The invitation still works when storage is unavailable. */
    }
  }, [showInvitation]);

  const requestInstall = async () => {
    if (installing) return;
    setInvitation(false);
    const nativePrompt = takeInstallPrompt();
    if (!nativePrompt) return;

    setInstalling(true);
    try {
      await nativePrompt.prompt();
    } catch {
      // The consumed prompt falls back to the browser guide when it settles.
    } finally {
      setInstalling(false);
    }
  };

  const applyUpdate = async () => {
    if (!needUpdate || busy || writeActivity.count()) return;
    setUpdateError(null);
    if (!flushDrafts()) {
      setUpdateError("پیش‌نویس‌ها ذخیره نشدند. دوباره تلاش کنید.");
      return;
    }

    setBusy(true);
    const worker = navigator.serviceWorker;
    let timeout: number | undefined;
    let onControllerChange: (() => void) | undefined;
    try {
      // The PWA helper sends the message; it does not wait for the new worker.
      const activated = new Promise<void>((resolve, reject) => {
        onControllerChange = () => resolve();
        worker.addEventListener("controllerchange", onControllerChange, {
          once: true,
        });
        timeout = window.setTimeout(
          () => reject(new Error("Update activation timed out")),
          15_000
        );
      });
      await Promise.all([activated, update(true)]);
    } catch {
      setUpdateError("به‌روزرسانی انجام نشد. دوباره تلاش کنید.");
    } finally {
      window.clearTimeout(timeout);
      if (onControllerChange)
        worker.removeEventListener("controllerchange", onControllerChange);
      setBusy(false);
    }
  };

  const view = match({
    mode,
    isInstalled,
    canPrompt: prompt !== null || installing,
    isAppleMobile,
    isMacSafari,
  })
    .returnType<PwaDialogView | null>()
    .with({ mode: null }, () => null)
    .with({ mode: "update" }, () => ({
      kind: "update",
      canUpdate: needUpdate,
      hasWrites: writes > 0,
      busy,
      error: updateError,
      onUpdate: () => void applyUpdate(),
    }))
    .with({ mode: "install", isInstalled: true }, () => ({ kind: "installed" }))
    .with({ mode: "install", canPrompt: true }, () => ({
      kind: "native",
      installing,
      onInstall: () => void requestInstall(),
    }))
    .with({ mode: "install", isAppleMobile: true }, () => ({
      kind: "apple-mobile",
    }))
    .with({ mode: "install", isMacSafari: true }, () => ({
      kind: "mac-safari",
    }))
    .with({ mode: "install" }, () => ({ kind: "manual" }))
    .exhaustive();

  const notice = match({ showUpdate, showInvitation })
    .with({ showUpdate: true }, () => (
      <PwaNotice
        kind="update"
        onOpen={() => {
          setUpdateError(null);
          setMode("update");
        }}
        onDismiss={() => setDismissed(true)}
      />
    ))
    .with({ showInvitation: true }, () => (
      <PwaNotice
        kind="install"
        onOpen={() => {
          setInvitation(false);
          setMode("install");
        }}
        onDismiss={() => setInvitation(false)}
      />
    ))
    .otherwise(() => null);

  return (
    <>
      {!online && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-warning/15 px-3 py-2 text-xs leading-5 text-warning-foreground"
        >
          <WiFiOffIcon
            aria-hidden="true"
            size={16}
            className="shrink-0 text-warning"
          />
          <span>اتصال اینترنت قطع است.</span>
        </div>
      )}

      {notice && (
        <div className="mx-auto w-full max-w-xl px-4 py-3">{notice}</div>
      )}

      {offlineRecoveryEnabled &&
        offerOffline &&
        user &&
        !restoring &&
        !active && (
          <aside
            className="mx-auto flex w-full max-w-xl flex-wrap items-center gap-2 px-4 py-2"
            aria-label="پیشنهاد آماده‌سازی آفلاین"
          >
            <p className="text-sm">
              برای استفاده بدون اینترنت، داده‌ها را روی دستگاه ذخیره کنید.
            </p>

            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                localStorage.setItem("persianpart_offline_offered", "true");
                setOfferOffline(false);
                setMode(waiting ? "update" : "install");
              }}
            >
              بررسی بستهٔ آفلاین
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                localStorage.setItem("persianpart_offline_offered", "true");
                setOfferOffline(false);
              }}
            >
              بعداً
            </Button>
          </aside>
        )}

      {offlineRecoveryEnabled && showDownload && progress && (
        <OfflineDownloadDialog
          progress={progress}
          onPause={() => {
            pauseOfflinePackage();
            setShowDownload(false);
          }}
          onClose={() => setShowDownload(false)}
        />
      )}

      <PwaDialog
        view={view}
        onClose={() => setMode(null)}
        offlineContent={user && <OfflineProgress online={online} showHeading />}
      />
    </>
  );
}
