import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
        environment: "node",
        // Tes aturan Firestore butuh emulator, jadi dijalankan terpisah (npm run test:rules)
        include: ["src/**/*.test.ts"],
    },
});
