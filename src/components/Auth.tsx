"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { auth } from "@/lib/firebase";
import { addDefaultCategories } from "@/lib/categories";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    getAdditionalUserInfo,
    type UserCredential
} from "firebase/auth";
import { errorCode } from "@/lib/types";

// Pesan mentah Firebase ("Firebase: Error (auth/...)") tidak ramah untuk user
const AUTH_ERROR_MESSAGES: Record<string, string> = {
    "auth/invalid-credential": "Email atau password salah.",
    "auth/wrong-password": "Email atau password salah.",
    "auth/user-not-found": "Email atau password salah.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan login.",
    "auth/weak-password": "Password minimal 6 karakter.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
    "auth/network-request-failed": "Koneksi bermasalah. Periksa internet Anda.",
    "auth/user-disabled": "Akun ini telah dinonaktifkan.",
    "auth/missing-email": "Isi email terlebih dahulu.",
};

function authErrorMessage(err: unknown, fallback: string): string {
    const code = errorCode(err);
    return (code && AUTH_ERROR_MESSAGES[code]) || fallback;
}

// Akun yang baru dibuat langsung diberi kategori bawaan. Tidak ditunggu: saat offline tulisan
// diantrekan Firestore dan promise-nya baru selesai setelah tersinkron.
function setUpNewAccount(credential: UserCredential | null) {
    if (!credential || !getAdditionalUserInfo(credential)?.isNewUser) return;
    addDefaultCategories(credential.user.uid).catch((err) => console.error("Gagal membuat kategori bawaan:", err));
}

export default function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [redirectProcessing, setRedirectProcessing] = useState(true);

    // Selesaikan login redirect (cadangan kalau popup diblokir)
    useEffect(() => {
        getRedirectResult(auth)
            .then((credential) => {
                setUpNewAccount(credential);
                setRedirectProcessing(false);
            })
            .catch((err) => {
                console.error("Redirect Auth Error:", err);
                if (errorCode(err) !== "auth/no-auth-event") {
                    setError("Gagal menyelesaikan login otomatis. Silakan coba login manual.");
                }
                setRedirectProcessing(false);
            });
    }, []);

    const handleResetPassword = async () => {
        setError(null);
        setInfo(null);
        const target = email.trim();
        if (!target) {
            setError("Isi email Anda dulu, lalu ketuk \"Lupa password?\" lagi.");
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, target);
            // Firebase tidak memberi tahu apakah email terdaftar (perlindungan enumerasi email)
            setInfo(`Kalau ${target} terdaftar, link untuk membuat password baru sudah dikirim. Cek juga folder spam.`);
        } catch (err) {
            console.error(err);
            setError(authErrorMessage(err, "Gagal mengirim email reset password."));
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e: React.SubmitEvent) => {
        e.preventDefault();
        setError(null);
        setInfo(null);
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                setUpNewAccount(await createUserWithEmailAndPassword(auth, email, password));
            }
        } catch (err) {
            console.error(err);
            setError(authErrorMessage(err, "Gagal masuk. Silakan coba lagi."));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setInfo(null);
        setLoading(true);
        const provider = new GoogleAuthProvider();

        // Popup dipakai juga di HP: browser modern memblokir storage pihak ketiga, sehingga
        // signInWithRedirect sering kembali ke halaman login tanpa error kalau app tidak
        // di-host di authDomain Firebase. Redirect hanya cadangan saat popup diblokir.
        try {
            setUpNewAccount(await signInWithPopup(auth, provider));
        } catch (err) {
            console.error(err);
            const code = errorCode(err);
            if (code === "auth/popup-blocked") {
                setError("Popup diblokir. Mencoba metode lain...");
                try {
                    await signInWithRedirect(auth, provider);
                } catch (redirectErr) {
                    console.error(redirectErr);
                    setError(authErrorMessage(redirectErr, "Gagal login dengan Google."));
                }
            } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
                // Menutup popup sendiri bukan error yang perlu ditampilkan
                setError(authErrorMessage(err, "Gagal login dengan Google."));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] p-4 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-3xl" />

            <div className="glass w-full max-w-md p-8 sm:p-10 rounded-3xl shadow-2xl animate-[slide-up_0.6s_ease-out] relative z-10 border border-white/20">
                <div className="text-center mb-8">
                    <Image
                        src="/logo-spending-tracker.png"
                        alt=""
                        width={640}
                        height={600}
                        priority
                        className="w-20 h-auto mx-auto mb-4 drop-shadow-lg"
                    />
                    <h1 className="text-3xl font-bold bg-linear-to-r from-primary to-indigo-600 bg-clip-text text-transparent mb-2">
                        Spending Track
                    </h1>
                    <p className="text-muted-foreground font-medium">
                        {isLogin ? "Selamat datang kembali! Silakan masuk." : "Buat akun untuk mulai mencatat keuangan."}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-shake">
                        {error}
                    </div>
                )}

                {info && (
                    <div className="mb-6 p-4 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
                        {info}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5 ml-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-1.5 ml-1">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                autoComplete={isLogin ? "current-password" : "new-password"}
                                className="w-full pl-4 pr-12 py-3 rounded-xl bg-background/50 border border-border text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                aria-pressed={showPassword}
                                title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                )}
                            </button>
                        </div>
                        {isLogin && (
                            <button
                                type="button"
                                onClick={handleResetPassword}
                                disabled={loading}
                                className="mt-2 ml-1 text-xs font-bold text-primary hover:underline disabled:opacity-50"
                            >
                                Lupa password?
                            </button>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none mt-4 text-lg"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Memproses...
                            </span>
                        ) : (
                            isLogin ? "Masuk" : "Daftar"
                        )}
                    </button>
                </form>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#f0f4f8] px-4 text-muted-foreground font-bold tracking-widest">Atau masuk dengan</span>
                    </div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    type="button"
                    className="w-full flex items-center justify-center gap-3 bg-background border border-border hover:bg-muted/50 font-bold py-3 rounded-xl transition-all shadow-sm active:scale-[0.98] mb-8"
                >
                    <svg width="20" height="20" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                    </svg>
                    Akun Google
                </button>

                <p className="text-center text-sm font-medium text-muted-foreground">
                    {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(null); setInfo(null); }}
                        className="text-primary font-bold hover:underline"
                    >
                        {isLogin ? "Daftar" : "Masuk"}
                    </button>
                </p>
            </div>

            {/* Redirect Processing Overlay */}
            {redirectProcessing && (
                <div className="fixed inset-0 z-200 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center text-white gap-4 animate-fade-in">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                    <p className="font-bold tracking-wide animate-pulse uppercase text-xs">Menyelesaikan Login...</p>
                </div>
            )}
        </div>
    );
}
