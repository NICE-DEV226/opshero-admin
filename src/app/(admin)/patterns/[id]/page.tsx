"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { patternsApi, AdminApiError } from "@/lib/admin-api";
import {
  ArrowLeft, Save, RotateCcw, Play, Check, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";

// Monaco editor loaded client-side only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface TestResult {
  matched: boolean;
  confidence: number;
  extracted_vars: Record<string, string>;
}

export default function PatternEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [raw, setRaw] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validJson, setValidJson] = useState(true);

  // Test pane
  const [testLog, setTestLog] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bump, setBump] = useState<"patch" | "minor" | "major">("patch");

  useEffect(() => {
    patternsApi.get(id)
      .then(p => {
        const s = JSON.stringify(p, null, 2);
        setRaw(s);
        setOriginal(s);
      })
      .catch(() => setError("Pattern not found."))
      .finally(() => setLoading(false));
  }, [id]);

  function handleEditorChange(val: string | undefined) {
    const v = val ?? "";
    setRaw(v);
    try {
      JSON.parse(v);
      setValidJson(true);
    } catch {
      setValidJson(false);
    }
  }

  const isDirty = raw !== original;

  async function handleSave() {
    if (!validJson) return;
    setSaving(true);
    setError(null);
    try {
      const data = JSON.parse(raw);
      await patternsApi.update(id, data, bump);
      setOriginal(raw);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!validJson || !testLog.trim()) return;
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const data = JSON.parse(raw);
      const res = await patternsApi.test(data, testLog);
      setTestResult(res);
    } catch (err) {
      setTestError(err instanceof AdminApiError ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="skeleton h-8 w-48 rounded mb-4" />
        <div className="skeleton h-[500px] rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/patterns")} className="btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold" style={{ color: "var(--text-1)" }}>
            {id}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span
              className="text-xs"
              style={{ color: validJson ? "#4ade80" : "#fca5a5" }}
            >
              {validJson ? "✓ Valid JSON" : "✗ Invalid JSON"}
            </span>
            {isDirty && (
              <span className="text-xs" style={{ color: "var(--text-3)" }}>
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        {/* Version bump selector */}
        <select
          value={bump}
          onChange={e => setBump(e.target.value as typeof bump)}
          className="input text-xs py-1.5"
          style={{ width: "auto", minWidth: 100 }}
        >
          <option value="patch">Bump patch</option>
          <option value="minor">Bump minor</option>
          <option value="major">Bump major</option>
        </select>

        <button
          onClick={handleSave}
          disabled={!isDirty || !validJson || saving}
          className="btn-primary"
        >
          {saving ? (
            <>
              <span
                className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
              />
              Saving…
            </>
          ) : saveOk ? (
            <>
              <Check className="w-4 h-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save & Publish
            </>
          )}
        </button>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Monaco editor */}
        <div
          className="panel overflow-hidden"
          style={{ minHeight: 520 }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="section-label">JSON Editor</span>
            <button
              onClick={() => { setRaw(original); setValidJson(true); }}
              disabled={!isDirty}
              className="btn-ghost btn-sm py-0.5"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
          <MonacoEditor
            height="480px"
            language="json"
            theme="vs-dark"
            value={raw}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              lineHeight: 20,
              fontFamily: "'JetBrains Mono', monospace",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              formatOnPaste: true,
              tabSize: 2,
            }}
          />
        </div>

        {/* Live test pane */}
        <div className="space-y-4">
          <div className="panel p-4 space-y-3">
            <span className="section-label">Live Test</span>
            <textarea
              value={testLog}
              onChange={e => setTestLog(e.target.value)}
              placeholder={`Paste a CI/CD log snippet here…\n\nE.g.:\nE: Unable to locate package nginx\nSee apt-get install documentation`}
              rows={8}
              className="input-mono w-full resize-none"
              style={{ fontSize: "0.75rem" }}
            />
            <button
              onClick={handleTest}
              disabled={!testLog.trim() || !validJson || testing}
              className="btn-outline w-full justify-center"
            >
              {testing ? (
                <>
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                    style={{ borderColor: "rgba(99,102,241,0.3)", borderTopColor: "var(--accent)" }}
                  />
                  Testing…
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Run Test
                </>
              )}
            </button>

            {testError && (
              <p className="text-xs" style={{ color: "#fca5a5" }}>
                {testError}
              </p>
            )}

            {testResult && (
              <div
                className="rounded-xl p-3 space-y-2"
                style={{
                  background: testResult.matched
                    ? "rgba(74,222,128,0.06)"
                    : "rgba(239,68,68,0.06)",
                  border: `1px solid ${testResult.matched ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: testResult.matched ? "#4ade80" : "#fca5a5" }}
                  >
                    {testResult.matched ? "✓ Matched" : "✗ No match"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>
                    confidence: {(testResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {Object.keys(testResult.extracted_vars).length > 0 && (
                  <div>
                    <div className="text-xs mb-1" style={{ color: "var(--text-3)" }}>
                      Extracted vars:
                    </div>
                    {Object.entries(testResult.extracted_vars).map(([k, v]) => (
                      <div key={k} className="font-mono text-xs" style={{ color: "var(--accent)" }}>
                        {k}: <span style={{ color: "var(--text-2)" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Version history */}
          <div className="panel">
            <button
              onClick={() => setHistoryOpen(v => !v)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium"
              style={{ color: "var(--text-2)" }}
            >
              <span>Version History</span>
              {historyOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {historyOpen && (
              <div className="px-4 pb-3 text-xs" style={{ color: "var(--text-3)" }}>
                {/* History loaded on demand */}
                <p className="py-2">Load history from the API to view previous versions and rollback options.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
