import React, { useEffect, useState } from "react";
import { User, api } from "./api";
import { StoredKit } from "../packages/shared/types";
import { Navbar } from "./components/Navbar";
import { AuthView } from "./components/AuthView";
import { DashboardView } from "./components/DashboardView";
import { CreateKitModal } from "./components/CreateKitModal";
import { BatchModal } from "./components/BatchModal";
import { GenerationProgressView } from "./components/GenerationProgressView";
import { KitDetailView } from "./components/KitDetailView";
import { Loader2 } from "lucide-react";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // View state: "dashboard" | "progress" | "kit"
  const [currentView, setCurrentView] = useState<"dashboard" | "progress" | "kit">("dashboard");
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [activeKit, setActiveKit] = useState<StoredKit | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check auth session
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.auth.me();
        setUser(res.user);
      } catch {
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore
    }
    setUser(null);
  };

  const handleKitSelected = async (kitId: string) => {
    setSelectedKitId(kitId);
    try {
      const res = await api.kits.get(kitId);
      if (res.kit.generation.status === "running") {
        setCurrentView("progress");
      } else {
        setActiveKit(res.kit);
        setCurrentView("kit");
      }
    } catch (err: any) {
      alert(err.message || "Failed to load kit");
    }
  };

  const handleKitCreated = (kitId: string) => {
    setSelectedKitId(kitId);
    setCurrentView("progress");
  };

  const handleGenerationComplete = (kit: StoredKit) => {
    setActiveKit(kit);
    setCurrentView("kit");
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <span className="text-sm font-medium">Loading Interview Prep Kit...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenCreateModal={() => setShowCreateModal(true)}
        onOpenBatchModal={() => setShowBatchModal(true)}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onGoHome={() => {
          setCurrentView("dashboard");
          setSelectedKitId(null);
          setActiveKit(null);
        }}
      />

      <main className="flex-1">
        {currentView === "dashboard" ? (
          <DashboardView
            onSelectKit={handleKitSelected}
            onOpenCreateModal={() => setShowCreateModal(true)}
            onOpenBatchModal={() => setShowBatchModal(true)}
          />
        ) : currentView === "progress" && selectedKitId ? (
          <GenerationProgressView
            kitId={selectedKitId}
            onComplete={handleGenerationComplete}
            onBack={() => {
              setCurrentView("dashboard");
              setSelectedKitId(null);
            }}
          />
        ) : currentView === "kit" && activeKit ? (
          <KitDetailView
            initialKit={activeKit}
            onBack={() => {
              setCurrentView("dashboard");
              setActiveKit(null);
              setSelectedKitId(null);
            }}
          />
        ) : null}
      </main>

      {/* Optional Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative max-w-md w-full">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white z-10 text-lg font-bold"
            >
              ✕
            </button>
            <AuthView
              onSuccess={(u) => {
                setUser(u);
                setShowAuthModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateKitModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onKitCreated={handleKitCreated}
      />

      <BatchModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onBatchProcessed={() => {
          setCurrentView("dashboard");
        }}
      />
    </div>
  );
}

export default App;
