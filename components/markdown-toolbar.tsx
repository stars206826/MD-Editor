"use client";

import { Button } from "@/components/ui/button";
import type { MarkdownFormat, TextSelection } from "@/lib/types";

interface MarkdownToolbarProps {
  onFormat: (format: MarkdownFormat, selection: TextSelection) => void;
  disabled?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function MarkdownToolbar({
  onFormat,
  disabled = false,
  textareaRef,
}: MarkdownToolbarProps) {
  function getSelection(): TextSelection {
    const textarea = textareaRef.current;
    if (!textarea) {
      return { start: 0, end: 0, text: "" };
    }

    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd),
    };
  }

  function handleFormat(format: MarkdownFormat) {
    if (disabled) return;
    const selection = getSelection();
    onFormat(format, selection);
  }

  const buttons: Array<{
    format: MarkdownFormat;
    label: string;
    icon: string;
    title: string;
  }> = [
    { format: "bold", label: "B", icon: "font-bold", title: "粗体 (Ctrl+B)" },
    { format: "italic", label: "I", icon: "italic", title: "斜体 (Ctrl+I)" },
    { format: "heading", label: "H", icon: "", title: "标题" },
    { format: "link", label: "🔗", icon: "", title: "链接 (Ctrl+K)" },
    { format: "code", label: "</>", icon: "", title: "代码" },
    { format: "quote", label: "❝", icon: "", title: "引用" },
    { format: "list", label: "•", icon: "", title: "列表" },
    { format: "image", label: "🖼️", icon: "", title: "插入图片" },
  ];

  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-slate-900/50 p-2">
      {buttons.map(({ format, label, title }) => (
        <Button
          key={format}
          onClick={() => handleFormat(format)}
          disabled={disabled}
          variant="ghost"
          className="h-8 min-w-[2rem] px-2 text-sm font-semibold"
          title={title}
          aria-label={title}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

// Helper function to apply markdown formatting
export function applyMarkdownFormat(
  format: MarkdownFormat,
  selection: TextSelection,
  content: string
): { newContent: string; newCursorPos: number } {
  const { start, end, text } = selection;
  const before = content.substring(0, start);
  const after = content.substring(end);

  let formatted: string;
  let cursorOffset: number;

  switch (format) {
    case "bold":
      if (text) {
        formatted = `**${text}**`;
        cursorOffset = formatted.length;
      } else {
        formatted = "****";
        cursorOffset = 2; // Place cursor between **|**
      }
      break;

    case "italic":
      if (text) {
        formatted = `*${text}*`;
        cursorOffset = formatted.length;
      } else {
        formatted = "**";
        cursorOffset = 1; // Place cursor between *|*
      }
      break;

    case "heading":
      if (text) {
        formatted = `## ${text}`;
        cursorOffset = formatted.length;
      } else {
        formatted = "## ";
        cursorOffset = 3; // Place cursor after "## "
      }
      break;

    case "link":
      if (text) {
        formatted = `[${text}](url)`;
        cursorOffset = formatted.length - 4; // Place cursor before "url)"
      } else {
        formatted = "[](url)";
        cursorOffset = 1; // Place cursor between [|]
      }
      break;

    case "code":
      if (text) {
        formatted = `\`${text}\``;
        cursorOffset = formatted.length;
      } else {
        formatted = "``";
        cursorOffset = 1; // Place cursor between `|`
      }
      break;

    case "quote":
      if (text) {
        formatted = `> ${text}`;
        cursorOffset = formatted.length;
      } else {
        formatted = "> ";
        cursorOffset = 2; // Place cursor after "> "
      }
      break;

    case "list":
      if (text) {
        formatted = `- ${text}`;
        cursorOffset = formatted.length;
      } else {
        formatted = "- ";
        cursorOffset = 2; // Place cursor after "- "
      }
      break;

    case "image":
      if (text) {
        formatted = `![${text}](url)`;
        cursorOffset = formatted.length - 4; // Place cursor before "url)"
      } else {
        formatted = "![](url)";
        cursorOffset = 3; // Place cursor between ![|]
      }
      break;

    default:
      formatted = text;
      cursorOffset = formatted.length;
  }

  const newContent = before + formatted + after;
  const newCursorPos = start + cursorOffset;

  return { newContent, newCursorPos };
}
