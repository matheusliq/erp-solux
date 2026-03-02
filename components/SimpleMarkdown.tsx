import React from "react";

/**
 * Simple inline markdown renderer — replaces react-markdown.
 * Supports: **bold**, *italic*, bullet lists, numbered lists, headers (## ###), code inline.
 */
export function SimpleMarkdown({ children: text }: { children: string }) {
    if (!text) return null;

    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith("## ")) {
            elements.push(<h2 key={i} className="text-white font-bold text-sm mb-1">{inline(line.slice(3))}</h2>);
        } else if (line.startsWith("### ")) {
            elements.push(<h3 key={i} className="text-zinc-100 font-semibold text-sm mb-1">{inline(line.slice(4))}</h3>);
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
            const items: React.ReactNode[] = [];
            while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
                items.push(<li key={i} className="text-zinc-300">{inline(lines[i].slice(2))}</li>);
                i++;
            }
            elements.push(<ul key={`ul-${i}`} className="list-disc pl-4 mb-2 space-y-0.5">{items}</ul>);
            continue;
        } else if (/^\d+\. /.test(line)) {
            const items: React.ReactNode[] = [];
            while (i < lines.length && /^\d+\. /.test(lines[i])) {
                items.push(<li key={i} className="text-zinc-300">{inline(lines[i].replace(/^\d+\. /, ""))}</li>);
                i++;
            }
            elements.push(<ol key={`ol-${i}`} className="list-decimal pl-4 mb-2 space-y-0.5">{items}</ol>);
            continue;
        } else if (line.trim() === "") {
            // skip empty lines (they act as paragraph breaks)
        } else {
            elements.push(<p key={i} className="mb-1.5 last:mb-0">{inline(line)}</p>);
        }
        i++;
    }

    return <>{elements}</>;
}

/** Render inline styles: **bold**, *italic*, `code` */
function inline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > last) parts.push(text.slice(last, match.index));
        if (match[2]) parts.push(<strong key={match.index} className="text-white font-bold">{match[2]}</strong>);
        else if (match[3]) parts.push(<em key={match.index} className="italic text-zinc-200">{match[3]}</em>);
        else if (match[4]) parts.push(<code key={match.index} className="bg-zinc-800 px-1 rounded text-xs text-blue-300">{match[4]}</code>);
        last = match.index + match[0].length;
    }

    if (last < text.length) parts.push(text.slice(last));
    return parts;
}
