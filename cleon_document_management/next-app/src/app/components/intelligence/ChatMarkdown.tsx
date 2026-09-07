import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g);
  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code key={index} className="rounded bg-slate-200/80 px-1 py-0.5 text-[0.9em]">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }
    return <span key={index}>{token}</span>;
  });
}

export default function ChatMarkdown({ text }: { text: string }) {
  const blocks = (text || "").replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-6 text-slate-800">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter((line) => line.length > 0);
        const list = lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));
        const numbered = lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line));
        if (list) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInline(line.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (numbered) {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInline(line.replace(/^\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        const heading = block.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          const Tag = heading[1].length === 1 ? "h3" : "h4";
          return (
            <Tag key={index} className="font-semibold text-slate-900">
              {renderInline(heading[2])}
            </Tag>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}
