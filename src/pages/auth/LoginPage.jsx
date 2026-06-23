import { useState } from "react";
import { authApi } from "../../api";
import { useAuthStore } from "../../store/authStore";

const QUICK_USERS = [
  { username: "tran.minh",  label: "Trần Minh",    role: "Main Planner", color: "blue",  emoji: "🔵" },
  { username: "nguyen.van", label: "Nguyễn Văn A",  role: "Sub (B_L01, B_L02)", color: "green", emoji: "🟢" },
  { username: "le.thi",     label: "Lê Thị B",      role: "Sub (B_L03, B_L04)", color: "green", emoji: "🟢" },
  { username: "pham.duc",   label: "Phạm Đức C",    role: "Sub (C_L01, C_L02)", color: "green", emoji: "🟢" },
  { username: "hoang.mai",  label: "Hoàng Mai D",   role: "Sub (A_L01, A_L02)", color: "green", emoji: "🟢" },
];

export default function LoginPage() {
  const [username, setUsername] = useState("tran.minh");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login } = useAuthStore();

  const doLogin = async (uname, pass = "password123") => {
    setLoading(true); setError(null);
    try {
      const resp = await authApi.login(uname, pass);
      login(resp.user, resp.access_token);
    } catch (err) {
      setError(err.response?.data?.detail || "Đăng nhập thất bại. Kiểm tra lại thông tin.");
    } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    await doLogin(username, password);
  };

  const quickLogin = async (uname) => {
    setUsername(uname);
    await doLogin(uname);
  };

  return (
    <div className="grid min-h-screen grid-cols-2">
      {/* Hero */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-blue-700 p-12 text-white">
        <div className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(circle at 80% 10%, #7c3aed 0%, transparent 50%), radial-gradient(circle at 10% 90%, #10b981 0%, transparent 50%)" }} />
        <div className="relative">
          <div className="mb-12 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-lg font-bold">AP</div>
            <span className="text-lg font-semibold">AutoPlanning Suite</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Production planning,<br />made spreadsheet‑simple.</h1>
          <p className="mt-5 max-w-md text-blue-200">Quản lý KHX, BAO_CAO_SO_DUOI và GA scheduling trong một giao diện. Một workbook mỗi factory — đúng cách team kế hoạch đang làm với Excel.</p>
          <div className="mt-10 grid grid-cols-3 gap-6">
            {[["5", "Factories live"], ["480", "Orders tracked"], ["98.4%", "On-time rate"]].map(([n, l]) => (
              <div key={l}>
                <div className="text-3xl font-bold">{n}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-blue-300">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-blue-400">© 2026 GA Planning Engine · ERP integrated</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-white p-12 overflow-auto">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your ERP / Active Directory credentials.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">Username</label>
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input type="password"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition">
              {loading ? "Đang đăng nhập…" : "Sign in"}
            </button>
          </form>

          {/* Quick login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-400">Đăng nhập nhanh (Demo)</span>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {QUICK_USERS.map((u) => (
                <button
                  key={u.username}
                  onClick={() => quickLogin(u.username)}
                  disabled={loading}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition text-sm disabled:opacity-50 ${
                    u.color === "blue"
                      ? "border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                      : "border-green-200 hover:bg-green-50 hover:border-green-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="mr-2">{u.emoji}</span>
                      <span className="font-semibold text-slate-800">{u.label}</span>
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.color === "blue"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {u.color === "blue" ? "Main" : "Sub"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 ml-6">{u.role}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
            <strong className="block mb-1">Demo mode</strong>
            Backend unreachable → falls back to mock data. Any credentials work in mock mode.
          </div>
        </div>
      </div>
    </div>
  );
}
