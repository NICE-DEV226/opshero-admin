"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { patternsApi, AdminApiError } from "@/lib/admin-api";
import { ArrowLeft, Plus, AlertTriangle } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const TEMPLATE = JSON.stringify(
  {
    pattern_id: "new_pattern_id",
    name: "Human-readable name",
    category: "docker",
    subcategory: "",
    severity: "medium",
    description: "What this pattern detects.",
    detection: {
      keywords_required: ["keyword1", "keyword2"],
      keywords_optional: [],
      regex: "(?i)your_regex_here",
      exclude_if: [],
      min_confidence: 0.75,
    },
    solutions: [
      {
        rank: 1,
        title: "Solution title",
        explanation: "Why this happens.",
        commands: ["command1", "command2"],
        prevention: "How to prevent this.",
      },
    ],
    metadata: {
      source: "core",
      author: "admin",
      tags: [],
    },
  },
  null,
  2,
);

export default function NewPatternPage() {
  const router = useRouter();
  const [raw, setRaw] = useState(TEMPLATE);
  const [validJson, setValidJson] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleEditorChange(val: string | undefined) {
    const v = val ?? "";
    setRaw(v);
    try { JSON.parse(v); setValidJson(true); }
    catch { setValidJson(false); }
  }

  async function handleCreate() {
    if (!validJson) return;
    setSaving(true);
    setError(null);
    try {
      const data = JSON.parse(raw);
      const created = await patternsApi.create(data);
      router.push(`/patterns/${created.pattern_id}`);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Create failed");
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/patterns")} className="btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold" style={{ color: "var(--text-1)" }}>
            New Pattern
          </h1>
          <span className="text-xs" style={{ color: validJson ? "#4ade80" : "#fca5a5" }}>
            {validJson ? "✓ Valid JSON" : "✗ Invalid JSON"}
          </span>
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

        <button
          onClick={handleCreate}
          disabled={!validJson || saving}
          className="btn-primary"
        >
          {saving ? (
            <>
              <span
                className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
              />
              Creating…
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Create Pattern
            </>
          )}
        </button>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="section-label">Pattern JSON — based on schema v2</span>
        </div>
        <MonacoEditor
          height="600px"
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
    </div>
  );
}
