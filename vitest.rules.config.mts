import { defineConfig } from "vitest/config";

// Dijalankan lewat `npm run test:rules`, yang menyalakan emulator Firestore lebih dulu
export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/rules/**/*.test.ts"],
        // Semua file memakai emulator yang sama, jadi jangan berjalan paralel
        fileParallelism: false,
        // Emulator yang baru menyala bisa lambat saat memuat rules pertama kali
        hookTimeout: 60_000,
        testTimeout: 30_000,
    },
});
