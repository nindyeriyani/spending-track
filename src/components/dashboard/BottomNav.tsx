import type { Tab } from "./types";

const tabClass = (active: boolean) =>
    `flex items-center justify-center gap-2 flex-1 py-4 px-2 rounded-full transition-all duration-300 ${active ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-muted-foreground hover:bg-muted"}`;

export default function BottomNav({ activeTab, onChange, budgetAlert }: {
    activeTab: Tab;
    onChange: (tab: Tab) => void;
    budgetAlert: boolean; // titik merah di tab Budget kalau ada budget yang perlu perhatian
}) {
    return (
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[75%] max-w-sm glass rounded-[2.5rem] p-2 flex justify-center items-center shadow-2xl shadow-primary/20 z-50 border border-white/40 gap-2 animate-[slide-up_0.3s_ease-out]">
            <button onClick={() => onChange("overview")} aria-label="Beranda" className={tabClass(activeTab === "overview")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            </button>
            <button onClick={() => onChange("budget")} aria-label="Budget" className={`relative ${tabClass(activeTab === "budget")}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                {activeTab !== "budget" && budgetAlert && <span className="absolute top-3 right-[30%] w-2 h-2 rounded-full bg-destructive" />}
            </button>
            <button onClick={() => onChange("goals")} aria-label="Target" className={tabClass(activeTab === "goals")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </button>
        </nav>
    );
}
