"use client";

/* Logo sekolah berasal dari penyimpanan terkelola dan memiliki fallback bawaan. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";

export default function BrandMark({ className = "" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setFailed(false);
      setVersion(Date.now());
    };
    window.addEventListener("sinurman-logo-updated", refresh);
    return () => window.removeEventListener("sinurman-logo-updated", refresh);
  }, []);

  return (
    <span className={`${className} custom-brand-mark`.trim()} aria-label="Logo SINURMAN">
      {failed ? (
        "ن"
      ) : (
        <img
          src={`/api/branding/logo?v=${version}`}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
