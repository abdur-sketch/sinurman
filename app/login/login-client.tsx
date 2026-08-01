"use client";

import { useEffect, useState } from "react";
import {
  getMultiFactorResolver,
  type MultiFactorResolver,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  TotpMultiFactorGenerator,
} from "firebase/auth";
import { firebaseClient } from "../../lib/firebase/client";

const ownerEmail = "baikganteng88@gmail.com";

export default function AdminLoginClient() {
  const [email, setEmail] = useState(ownerEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mfaResolver,setMfaResolver]=useState<MultiFactorResolver|null>(null);
  const [mfaCode,setMfaCode]=useState("");

  useEffect(() => {
    void fetch("/api/firebase-auth", { cache: "no-store" })
      .then(response => response.json())
      .then(resultValue => {
        const result = resultValue as { authenticated?: boolean };
        if (result.authenticated) window.location.assign("/");
      })
      .finally(() => setChecking(false));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const credential = await signInWithEmailAndPassword(
        firebaseClient().auth,
        email.trim().toLowerCase(),
        password,
      );
      await createServerSession(await credential.user.getIdToken());
    } catch (caught) {
      const authError=caught as {code?:string};
      if(authError.code==="auth/multi-factor-auth-required") {
        const resolver=getMultiFactorResolver(firebaseClient().auth,caught as never);
        if(!resolver.hints.some(hint=>hint.factorId===TotpMultiFactorGenerator.FACTOR_ID)) {
          setError("Faktor keamanan akun ini belum didukung SINURMAN.");setLoading(false);return;
        }
        setMfaResolver(resolver);setLoading(false);return;
      }
      const raw = caught instanceof Error ? caught.message : "Login gagal.";
      setError(
        raw.includes("invalid-credential")
          ? "Email atau kata sandi tidak sesuai. Gunakan tautan lupa kata sandi bila baru pertama masuk."
          : raw,
      );
      setLoading(false);
    }
  }

  async function createServerSession(idToken:string) {
      const response = await fetch("/api/firebase-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const result = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(result.error || "Sesi admin gagal dibuat.");
      window.location.assign(result.redirectTo || "/");
  }

  async function completeMfa(event:React.FormEvent) {
    event.preventDefault();if(!mfaResolver)return;setLoading(true);setError("");
    try {
      const hint=mfaResolver.hints.find(item=>item.factorId===TotpMultiFactorGenerator.FACTOR_ID);
      if(!hint)throw new Error("Faktor authenticator tidak tersedia.");
      const credential=await mfaResolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid,mfaCode));
      await createServerSession(await credential.user.getIdToken());
    } catch(caught){setError(caught instanceof Error?caught.message:"Kode authenticator tidak valid.");setLoading(false);}
  }

  async function resetPassword() {
    setError("");
    setMessage("");
    try {
      await sendPasswordResetEmail(firebaseClient().auth, email.trim().toLowerCase());
      setMessage("Tautan pengaturan ulang kata sandi telah dikirim ke email Anda.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Email reset belum dapat dikirim.");
    }
  }

  if (checking) {
    return <div className="guardian-login-form guardian-login-checking">Memeriksa sesi Admin…</div>;
  }

  if(mfaResolver)return <form className="guardian-login-form admin-login-form" onSubmit={completeMfa}><h3>Verifikasi dua langkah</h3><p>Masukkan kode 6 angka dari aplikasi Authenticator.</p><label>Kode Authenticator<input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={mfaCode} onChange={event=>setMfaCode(event.target.value.replace(/\D/g,"").slice(0,6))}/></label>{error&&<div className="form-error">{error}</div>}<button className="primary-button guardian-login-primary" disabled={loading}>{loading?"Memverifikasi…":"Verifikasi & Masuk →"}</button><button type="button" className="text-button" onClick={()=>{setMfaResolver(null);setMfaCode("");setPassword("");}}>Kembali</button></form>;

  return (
    <form className="guardian-login-form admin-login-form" onSubmit={submit}>
      <label>
        Email akun sekolah
        <input
          required
          type="email"
          autoComplete="username"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
      </label>
      <label>
        Kata sandi
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          placeholder="Kata sandi Firebase"
        />
      </label>
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}
      <button className="primary-button guardian-login-primary" disabled={loading}>
        {loading ? "Memeriksa…" : "Masuk ke Dashboard →"}
      </button>
      <button className="text-button" type="button" onClick={() => void resetPassword()}>
        Lupa / buat kata sandi
      </button>
    </form>
  );
}
