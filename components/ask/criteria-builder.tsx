"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Criteria } from "@/lib/questions/criteria-schema";

// Controlled criteria editor: min-words, code-required (+language), topics.
export function CriteriaBuilder({
  value,
  onChange,
}: {
  value: Criteria;
  onChange: (c: Criteria) => void;
}) {
  const [topicInput, setTopicInput] = useState("");

  const addTopic = () => {
    const t = topicInput.trim();
    if (!t || value.topics.includes(t) || value.topics.length >= 10) return;
    onChange({ ...value, topics: [...value.topics, t] });
    setTopicInput("");
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-medium">Acceptance criteria</h3>

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="minWords" className="w-40 max-w-full">Minimum words</Label>
        <Input
          id="minWords"
          type="number"
          min={0}
          className="w-32"
          value={value.minWords}
          onChange={(e) =>
            onChange({ ...value, minWords: Math.max(0, Number(e.target.value) || 0) })
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="mustCode" className="w-40 max-w-full">Code sample required</Label>
        <Switch
          id="mustCode"
          checked={value.mustIncludeCode}
          onCheckedChange={(v) => onChange({ ...value, mustIncludeCode: v })}
        />
        {value.mustIncludeCode && (
          <Input
            placeholder="language (e.g. typescript)"
            className="w-48 max-w-full"
            value={value.codeLanguage ?? ""}
            onChange={(e) => onChange({ ...value, codeLanguage: e.target.value })}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic">Required topics (checked by the AI reviewer)</Label>
        <div className="flex gap-2">
          <Input
            id="topic"
            placeholder="e.g. chunked ranges"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTopic();
              }
            }}
          />
          <button
            type="button"
            className="rounded-md border px-3 text-sm hover:bg-accent"
            onClick={addTopic}
          >
            Add
          </button>
        </div>
        {/* Soft reminder only - never blocks submission. */}
        {value.topics.length === 0 && !value.mustIncludeCode && value.minWords < 10 && (
          <p className="text-xs text-amber-700">
            No criteria set: the agent will judge whether the answer directly
            answers your question. Add criteria for more reliable evaluation.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {value.topics.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"
            >
              {t}
              <button
                type="button"
                aria-label={`remove ${t}`}
                onClick={() =>
                  onChange({ ...value, topics: value.topics.filter((x) => x !== t) })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
