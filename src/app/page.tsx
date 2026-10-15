"use client";

import Auth from "@/components/Auth";
import Dashboard from "@/components/dashboard/Dashboard";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function Home() {
  const { user, loading } = useAuthUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Auth />;

  // `key` membuat dashboard dipasang ulang saat ganti akun, jadi data akun sebelumnya tidak terbawa
  return <Dashboard key={user.uid} user={user} />;
}
