import React from "react";
import { User } from "../api";
import { Sparkles, Plus, Layers, LogOut, User as UserIcon, BookOpen } from "lucide-react";

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  onOpenCreateModal: () => void;
  onOpenBatchModal: () => void;
  onGoHome: () => void;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  onOpenCreateModal,
  onOpenBatchModal,
  onGoHome,
  onOpenAuthModal,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <button
          onClick={onGoHome}
          className="flex items-center space-x-3 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-100 tracking-tight text-lg">
              AI Interview Prep Kit
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Deterministic Research &amp; Study Engine
            </div>
          </div>
        </button>

        {/* Actions - Always accessible */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenBatchModal}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors cursor-pointer"
            title="Batch import JD cases"
          >
            <Layers className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Batch Import</span>
          </button>

          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-sm shadow-indigo-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Kit</span>
          </button>

          <div className="h-6 w-px bg-slate-800 mx-1" />

          {user ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 text-slate-300 text-sm pl-1">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <span className="hidden md:inline font-medium text-slate-300 max-w-[140px] truncate">
                  {user.name || user.email}
                </span>
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : onOpenAuthModal ? (
            <button
              onClick={onOpenAuthModal}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            >
              Sign In
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};
