import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Parse inline elements like **bold** and `code`
  const renderInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[SOURCE \d+\])/g);

    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-xs border border-zinc-700/60"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (/^\[SOURCE \d+\]$/.test(part)) {
        return (
          <span
            key={idx}
            className="inline-block px-1.5 py-0.5 mx-1 text-[10px] font-mono rounded bg-zinc-800 border border-zinc-700 text-zinc-300 align-baseline"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2.5 space-y-2 pl-1">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h4
          key={`h4-${idx}`}
          className="text-sm font-semibold text-zinc-100 mt-4 mb-1.5 tracking-wide"
        >
          {trimmed.slice(4)}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h3
          key={`h3-${idx}`}
          className="text-base font-semibold text-white mt-5 mb-2"
        >
          {trimmed.slice(3)}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h2
          key={`h2-${idx}`}
          className="text-lg font-bold text-white mt-5 mb-2.5"
        >
          {trimmed.slice(2)}
        </h2>
      );
      return;
    }

    // Bullet points (handles "* ", "- ", and accidental "***" or "* **")
    const isBullet =
      trimmed.startsWith("* ") ||
      trimmed.startsWith("- ") ||
      trimmed.startsWith("***") ||
      trimmed.startsWith("• ");

    if (isBullet) {
      let cleanBulletText = trimmed;
      if (cleanBulletText.startsWith("***")) {
        cleanBulletText = "**" + cleanBulletText.slice(3);
      } else if (cleanBulletText.startsWith("* ") || cleanBulletText.startsWith("- ") || cleanBulletText.startsWith("• ")) {
        cleanBulletText = cleanBulletText.slice(2);
      }

      currentList.push(
        <li key={`li-${idx}`} className="flex items-start space-x-2.5 text-sm text-zinc-300 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-2 shrink-0" />
          <div className="flex-1">{renderInline(cleanBulletText)}</div>
        </li>
      );
      return;
    }

    // Normal paragraph
    flushList();
    elements.push(
      <p key={`p-${idx}`} className="text-sm text-zinc-200 leading-relaxed my-2">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
}
