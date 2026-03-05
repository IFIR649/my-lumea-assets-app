import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { adminApi, type AdminNetwork, type ListeningPort } from "../lib/api";
import { Card, CardBody, CardHeader } from "./Card";
import { VisitorsPanel } from "./VisitorsPanel";
import { UserDirectory } from "./UserDirectory";
import { ChatAuditPanel } from "./ChatAuditPanel";

function isLocalHost() {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function isPrivateIPv4(ip: string) {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    (ip.startsWith("172.") &&
      (() => {
        const n = Number(ip.split(".")[1]);
        return n >= 16 && n <= 31;
      })())
  );
}

export function AdminPanel({
  toast,
}: {
  toast: (kind: "success" | "error" | "info", msg: string) => void;
}) {
  const [net, setNet] = useState<AdminNetwork | null>(null);
  const [ports, setPorts] = useState<ListeningPort[]>([]);
  const [loadingPorts, setLoadingPorts] = useState(false);

  const [checkPort, setCheckPort] = useState(3005);
  const [checkResult, setCheckResult] = useState<{ inUse: boolean; raw: string } | null>(null);
  const [suggest, setSuggest] = useState<number[]>([]);
  const [setting, setSetting] = useState(false);
  const [selectedAdvertise, setSelectedAdvertise] = useState<string>("");
  const [selectedLanHost, setSelectedLanHost] = useState<string>("");
  const [blockVpn, setBlockVpn] = useState<boolean>(true);
  const [applyingNetwork, setApplyingNetwork] = useState(false);

  const canShow = useMemo(() => isLocalHost(), []);

  async function loadNetwork() {
    try {
      const data = await adminApi.network();
      const initialAdvertise = data.advertiseIp ?? data.ips[0]?.address ?? "";
      const privateCandidate =
        data.ips.find((x) => isPrivateIPv4(x.address))?.address ?? data.ips[0]?.address ?? "";
      setNet(data);
      setSelectedAdvertise(initialAdvertise);
      setSelectedLanHost(data.lanHost ?? privateCandidate);
      setBlockVpn(data.mode === "lan_only");
    } catch (e: any) {
      toast("error", `Admin no disponible: ${e?.message ?? "error"}`);
    }
  }

  async function loadPorts() {
    setLoadingPorts(true);
    try {
      const data = await adminApi.ports();
      setPorts(data.listening);
    } catch (e: any) {
      toast("error", `No pude listar puertos: ${e?.message ?? "error"}`);
    } finally {
      setLoadingPorts(false);
    }
  }

  async function runCheck() {
    try {
      const data = await adminApi.portCheck(checkPort);
      setCheckResult({ inUse: data.inUse, raw: data.raw });
      toast(data.inUse ? "info" : "success", data.inUse ? "Puerto en uso" : "Puerto libre");
    } catch (e: any) {
      toast("error", `No pude checar: ${e?.message ?? "error"}`);
    }
  }

  async function loadSuggest() {
    try {
      const data = await adminApi.suggestPorts();
      setSuggest(data.suggested);
      if (data.suggested.length === 0) toast("info", "No encontre puertos libres en la lista.");
      else toast("success", "Sugerencias listas.");
    } catch (e: any) {
      toast("error", `No pude sugerir: ${e?.message ?? "error"}`);
    }
  }

  async function applyPort() {
    setSetting(true);
    try {
      await adminApi.setPort(checkPort);
      const nextLink = selectedAdvertise ? `http://${selectedAdvertise}:${checkPort}` : "";
      toast(
        "success",
        nextLink
          ? `Puerto guardado. Reinicio automatico. Nuevo link: ${nextLink}`
          : "Puerto guardado. El server se reiniciara solo (launcher)."
      );
      setCheckResult(null);
    } catch (e: any) {
      toast("error", `No pude aplicar: ${e?.message ?? "error"}`);
    } finally {
      setSetting(false);
    }
  }

  const allIps = net?.ips ?? [];
  const privateIps = allIps.filter((x) => isPrivateIPv4(x.address));

  async function applyNetwork() {
    setApplyingNetwork(true);
    try {
      const mode = blockVpn ? "lan_only" : "all";
      const lanHost = blockVpn
        ? selectedLanHost && isPrivateIPv4(selectedLanHost)
          ? selectedLanHost
          : privateIps[0]?.address || selectedAdvertise
        : selectedLanHost || privateIps[0]?.address || "";

      if (!lanHost) {
        toast("error", "No hay IP LAN privada para bloquear VPN.");
        return;
      }

      await adminApi.setBind(mode, lanHost, selectedAdvertise);
      toast("success", "Aplicado. El server se reiniciara solo (launcher).");
      setTimeout(() => {
        loadNetwork();
      }, 600);
    } catch (e: any) {
      toast("error", `No pude aplicar red: ${e?.message ?? "error"}`);
    } finally {
      setApplyingNetwork(false);
    }
  }

  useEffect(() => {
    if (!canShow) return;
    loadNetwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShow]);

  if (!canShow) {
    return (
      <Card>
        <CardHeader title="Admin" subtitle="Solo disponible en localhost (tu maquina)" />
        <CardBody>
          <div className="text-sm text-slate-600">
            Abre la app en <span className="font-semibold">http://localhost:5173</span> para usar el panel Admin.
          </div>
        </CardBody>
      </Card>
    );
  }

  const appLink = net?.links?.app ?? (selectedAdvertise ? `http://${selectedAdvertise}:${net?.port}` : null);
  const nextAppLink = selectedAdvertise ? `http://${selectedAdvertise}:${checkPort}` : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Red (IP y links)"
          subtitle="Te doy el link completo para compartir en LAN."
          right={
            <button
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
              onClick={loadNetwork}
              type="button"
            >
              Refrescar
            </button>
          }
        />
        <CardBody>
          {!net ? (
            <div className="text-sm text-slate-600">Cargando...</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="text-sm font-semibold text-slate-900">Host</div>
                <div className="mt-1 text-sm text-slate-600">{net.hostname}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="text-sm font-semibold text-slate-900">IPs detectadas</div>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {net.ips.length === 0 ? (
                    <div className="text-slate-500">No encontre IPv4 LAN.</div>
                  ) : (
                    net.ips.map((x) => (
                      <div key={`${x.name}-${x.address}`} className="flex justify-between gap-3">
                        <span className="text-slate-500">{x.name}</span>
                        <span className="font-semibold">{x.address}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="text-sm font-semibold text-slate-900">Links LAN</div>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">App</span>
                      <span className="rounded bg-slate-100 px-2 py-1 font-mono text-slate-900">{appLink ?? "-"}</span>
                    </div>

                    {appLink ? (
                      <div className="mt-2 flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-700">Escanea para unirte</div>
                        <QRCodeSVG value={appLink} size={160} level="M" includeMargin />

                        <button
                          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          onClick={async () => {
                            await navigator.clipboard.writeText(appLink);
                            toast("success", "Link App copiado.");
                          }}
                          type="button"
                        >
                          Copiar Link Manualmente
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="text-sm font-semibold text-slate-900">Compartir por</div>

                <div className="mt-3 grid gap-3">
                  <label className="text-xs font-semibold text-slate-700">IP visible (link)</label>
                  <select
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                    value={selectedAdvertise}
                    onChange={(e) => setSelectedAdvertise(e.target.value)}
                  >
                    {allIps.map((x) => (
                      <option key={x.address} value={x.address}>
                        {x.name} - {x.address}
                        {isPrivateIPv4(x.address) ? " (LAN)" : " (VPN/otra)"}
                      </option>
                    ))}
                  </select>

                  <label className="text-xs font-semibold text-slate-700">LAN host (modo LAN only)</label>
                  <select
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                    value={selectedLanHost}
                    onChange={(e) => setSelectedLanHost(e.target.value)}
                  >
                    {allIps.map((x) => (
                      <option key={`lan-${x.address}`} value={x.address}>
                        {x.name} - {x.address}
                        {isPrivateIPv4(x.address) ? " (LAN)" : " (VPN/otra)"}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 p-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Bloquear VPN</div>
                      <div className="text-xs text-slate-500">
                        Si esta activo, el servidor solo escucha por tu IP LAN privada.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBlockVpn((v) => {
                          const next = !v;
                          if (next && !isPrivateIPv4(selectedLanHost)) {
                            const fallback = privateIps[0]?.address || selectedAdvertise;
                            if (fallback) setSelectedLanHost(fallback);
                          }
                          return next;
                        });
                      }}
                      className={[
                        "h-9 w-16 rounded-full border transition relative",
                        blockVpn ? "bg-slate-900 border-slate-900" : "bg-white border-slate-300",
                      ].join(" ")}
                      aria-pressed={blockVpn}
                    >
                      <span
                        className={[
                          "absolute top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white shadow-sm transition",
                          blockVpn ? "left-8" : "left-1",
                        ].join(" ")}
                      />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={applyNetwork}
                    disabled={applyingNetwork}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {applyingNetwork ? "Aplicando..." : "Aplicar (reinicio automatico)"}
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Nota: Admin esta bloqueado a localhost aunque compartas la UI por IP.
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Puertos (netstat)"
          subtitle="Ver LISTENING y checar un puerto especifico."
          right={
            <button
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
              onClick={loadPorts}
              type="button"
            >
              {loadingPorts ? "Cargando..." : "Listar"}
            </button>
          }
        />
        <CardBody>
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
            <div className="text-sm font-semibold text-slate-900">Checar puerto</div>
            <div className="mt-3 flex items-center gap-2">
              <input
                className="w-32 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none focus:border-slate-400"
                type="number"
                value={checkPort}
                onChange={(e) => setCheckPort(Number(e.target.value))}
                min={1}
                max={65535}
              />
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={runCheck}
                type="button"
              >
                Probar
              </button>
              <button
                className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                onClick={loadSuggest}
                type="button"
              >
                Sugerir libres
              </button>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                onClick={applyPort}
                disabled={setting}
                type="button"
              >
                {setting ? "Aplicando..." : "Aplicar puerto"}
              </button>
            </div>

            {nextAppLink && (
              <div className="mt-2 text-xs text-slate-600">
                App objetivo: <span className="font-mono text-slate-900">{nextAppLink}</span>
              </div>
            )}

            {checkResult && (
              <div className="mt-3 text-sm">
                <div
                  className={[
                    "inline-flex rounded-xl px-3 py-1 text-xs font-semibold",
                    checkResult.inUse
                      ? "bg-amber-100 text-amber-900"
                      : "bg-emerald-100 text-emerald-900",
                  ].join(" ")}
                >
                  {checkResult.inUse ? "EN USO" : "LIBRE"}
                </div>

                {checkResult.raw && (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-2xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-700">
{checkResult.raw}
                  </pre>
                )}
              </div>
            )}

            <div className="mt-3 text-xs text-slate-500">
              Tip: si el puerto que quieres esta en uso, elige otro (3001, 3005, 5050, 7001, 9000...)
            </div>

            {suggest.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-700">Puertos libres sugeridos</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggest.map((p) => (
                    <button
                      key={p}
                      className="rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                      onClick={() => setCheckPort(p)}
                      type="button"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold text-slate-900">
              LISTENING encontrados: {ports.length}
            </div>
            <div className="max-h-[320px] overflow-auto space-y-2 pr-1">
              {ports.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 text-sm text-slate-500">
                  Presiona "Listar" para cargar.
                </div>
              ) : (
                ports.map((p, idx) => (
                  <div key={`${p.local}-${p.pid}-${idx}`} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-900">{p.proto}</div>
                      <div className="text-xs text-slate-500">PID {p.pid}</div>
                    </div>
                    <div className="mt-1 font-mono text-xs text-slate-700">{p.local}</div>
                    <div className="mt-1 text-xs text-slate-500">{p.state}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="lg:col-span-2 grid gap-4">
        <VisitorsPanel toast={toast} />
        <UserDirectory toast={toast} />
        <ChatAuditPanel toast={toast} />
      </div>
    </div>
  );
}
