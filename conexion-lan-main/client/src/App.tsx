import { useEffect, useMemo, useState } from "react";
import { Shell } from "./components/Shell";
import { Tabs, type TabKey } from "./components/Tabs";
import { NotesPanel } from "./components/NotesPanel";
import { FilesPanel } from "./components/FilesPanel";
import { ChatPanel } from "./components/ChatPanel";
import { AdminPanel } from "./components/AdminPanel";
import { Toast, type ToastKind } from "./components/Toast";
import { WhoAmI } from "./components/WhoAmI";
import { WhoAmIModal } from "./components/WhoAmIModal";
import { apiFetch } from "./lib/api";
import { getClientName } from "./lib/identity";

function isLocalHost() {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("notes");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastKind, setToastKind] = useState<ToastKind>("info");
  const [toastMsg, setToastMsg] = useState("");
  const [whoOpen, setWhoOpen] = useState(false);
  const [accessReady, setAccessReady] = useState(() => {
    try {
      return Boolean(window.localStorage.getItem("lan_app_key"));
    } catch {
      return false;
    }
  });

  const showAdmin = useMemo(() => isLocalHost(), []);
  const currentName = getClientName();

  useEffect(() => {
    if (accessReady) return;

    const currentKey = window.localStorage.getItem("lan_app_key");
    if (!currentKey) {
      const input = window.prompt("Bienvenido a LAN Share. Por favor ingresa la clave de acceso del equipo:");
      if (input) {
        window.localStorage.setItem("lan_app_key", input);
        window.location.reload();
        return;
      }
    }

    setAccessReady(Boolean(currentKey));
  }, [accessReady]);

  useEffect(() => {
    if (!accessReady) return;

    const ping = async () => {
      try {
        await apiFetch("/api/ping", { method: "POST" });
      } catch {
        // noop
      }
    };

    ping();
    const t = setInterval(ping, 10000);
    return () => clearInterval(t);
  }, [accessReady]);

  const toast = (kind: ToastKind, msg: string) => {
    setToastKind(kind);
    setToastMsg(msg);
    setToastOpen(true);
  };

  const subtitle = useMemo(() => {
    if (tab === "notes") return "Comparte textos, comandos y notas en tu red local.";
    if (tab === "files") return "Sube y descarga archivos dentro de tu LAN.";
    if (tab === "chat") return "Chat LAN en tiempo real para todos los usuarios conectados.";
    return "Admin local: puertos, IP y links completos.";
  }, [tab]);

  if (!accessReady) {
    return (
      <Shell>
        <div className="rounded-3xl border border-slate-200/70 bg-white/75 p-6 text-center shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="text-xl font-semibold text-slate-900">LAN Share</div>
          <div className="mt-2 text-sm text-slate-500">
            Necesitas la clave de acceso del equipo para entrar.
          </div>
          <button
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => {
              const input = window.prompt("Bienvenido a LAN Share. Por favor ingresa la clave de acceso del equipo:");
              if (input) {
                window.localStorage.setItem("lan_app_key", input);
                window.location.reload();
              }
            }}
            type="button"
          >
            Ingresar clave
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-slate-900">
              LAN Share
            </div>
            <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={tab} onChange={setTab} showAdmin={showAdmin} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWhoOpen(true)}
                className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                type="button"
              >
                {currentName ? `Usuario: ${currentName}` : "Quien soy?"}
              </button>
            </div>
          </div>
        </header>

        {tab === "notes" && <NotesPanel toast={toast} />}
        {tab === "files" && <FilesPanel toast={toast} />}
        {tab === "chat" && <ChatPanel toast={toast} />}
        {tab === "admin" && <AdminPanel toast={toast} />}
      </div>

      <Toast
        open={toastOpen}
        kind={toastKind}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
      />
      <WhoAmI onDone={() => {}} />
      <WhoAmIModal
        open={whoOpen}
        onClose={() => setWhoOpen(false)}
        onSaved={() => {
          window.location.reload();
        }}
      />
    </Shell>
  );
}
