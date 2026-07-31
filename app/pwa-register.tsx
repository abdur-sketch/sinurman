"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    sinurmanInstallPrompt?: BeforeInstallPromptEvent;
  }
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }
}

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const rememberPrompt = (event: Event) => {
      event.preventDefault();
      window.sinurmanInstallPrompt = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event("sinurman-install-ready"));
    };
    const installed = () => {
      window.sinurmanInstallPrompt = undefined;
      window.dispatchEvent(new Event("sinurman-installed"));
    };
    window.addEventListener("beforeinstallprompt", rememberPrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", rememberPrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return null;
}
