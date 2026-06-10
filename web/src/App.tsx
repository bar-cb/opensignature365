import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import Templates from "./pages/Templates";
import Assets from "./pages/Assets";
import Preview from "./pages/Preview";
import Deploy from "./pages/Deploy";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-1.5 rounded text-sm ${isActive ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`;

export default function App() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-white border-r border-slate-200 p-4">
        <div className="font-bold text-lg mb-1">OpenSignature365</div>
        <div className="text-[10px] text-slate-500 mb-6">v0.1.0 · local admin</div>
        <nav className="space-y-1">
          <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
          <NavLink to="/templates" className={linkClass}>Templates</NavLink>
          <NavLink to="/assets" className={linkClass}>Assets</NavLink>
          <NavLink to="/preview" className={linkClass}>Preview</NavLink>
          <NavLink to="/deploy" className={linkClass}>Deploy</NavLink>
          <NavLink to="/reports" className={linkClass}>Reports</NavLink>
          <NavLink to="/settings" className={linkClass}>Settings</NavLink>
        </nav>
        <div className="mt-8 text-[11px] text-slate-400 leading-relaxed">
          No login, no database. Run on a trusted host only.
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/signatures/:id" element={<Editor />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:id" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
