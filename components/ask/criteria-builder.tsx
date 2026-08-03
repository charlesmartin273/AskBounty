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
    <div className="space-y-4 rounded-xl bg-paper p-6">
      <h3 className="t-display-20 text-ink">Acceptance criteria</h3>

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
            className="t-body-14-medium shrink-0 cursor-pointer rounded-full border border-line-3 px-4 text-ink transition-colors duration-300 hover:bg-muted"
            onClick={addTopic}
          >
            Add
          </button>
        </div>
        {/* Soft reminder only - never blocks submission. */}
        {value.topics.length === 0 && !value.mustIncludeCode && value.minWords < 10 && (
          <p className="t-body-12-medium text-pending">
            No criteria set: the agent will judge whether the answer directly
            answers your question. Add criteria for more reliable evaluation.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {value.topics.map((t) => (
            // Quiet gray tag chip (bg-secondary is now pure white - invisible
            // on the paper card, so use the black/6% tag fill instead)
            <span
              key={t}
              className="t-body-12-medium inline-flex items-center gap-1.5 rounded-full bg-line-2 px-3 py-1 text-ink"
            >
              {t}
              <button
                type="button"
                aria-label={`remove ${t}`}
                className="cursor-pointer text-muted-ink transition-colors duration-300 hover:text-ink"
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
