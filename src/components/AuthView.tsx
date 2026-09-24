import React, { useState } from "react";
import { api, User } from "../api";
import { Sparkles, ArrowRight, Lock, Mail, User as UserIcon, AlertCircle } from "lucide-react";

interface AuthViewProps {
  onSuccess: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.auth.login({ email, password });
        onSuccess(res.user);
      } else {
        const res = await api.auth.register({ email, password, name });
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic multi-stage AI interview prep kit generator
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-sm flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Your Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>{loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
            >
              {isLogin
                ? "Don't have an account? Create one now"
                : "Already registered? Sign in here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
