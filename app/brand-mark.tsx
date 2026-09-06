"use client";

/* Logo sekolah berasal dari penyimpanan terkelola dan memiliki fallback bawaan. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";

export default function BrandMark({ className = "" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setFailed(false);
      setLoaded(false);
      setVersion(Date.now());
    };
    window.addEventListener("sinurman-logo-updated", refresh);
    return () => window.removeEventListener("sinurman-logo-updated", refresh);
  }, []);

  return (
    <span className={`${className} custom-brand-mark`.trim()} aria-label="Logo SINURMAN">
      <span className="brand-fallback-mark" aria-hidden="true">N</span>
      {!failed && (
        <img
          src={`/api/branding/logo?v=${version}`}
          alt=""
          loading="eager"
          className={loaded ? "is-loaded" : ""}
          onLoad={() => setLoaded(true)}
          onError={(event) => {
            event.currentTarget.style.display = "none";
            setFailed(true);
          }}
        />
      )}
    </span>
  );
}
