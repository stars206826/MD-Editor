"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type SimpleRichEditorProps = {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onImageClick?: () => void;
};

type HistoryState = {
  content: string;
  timestamp: number;
};

export type SimpleRichEditorHandle = {
  getMarkdown: () => string;
  syncContent: () => string;
};

export const SimpleRichEditor = forwardRef<SimpleRichEditorHandle, SimpleRichEditorProps>(function SimpleRichEditor({
  content,
  onChange,
  placeholder = "开始输入内容...",
  disabled = false,
  onImageClick,
}, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // 撤销/重做历史记录
  const historyRef = useRef<HistoryState[]>([{ content, timestamp: Date.now() }]);
  const historyIndexRef = useRef(0);
  const isUndoRedoRef = useRef(false);
  
  // 保存当前选区
  const savedSelectionRef = useRef<Range | null>(null);
  
  // 强制更新按钮状态
  const [, forceUpdate] = useState({});

  // 初始化内容
  useEffect(() => {
    if (editorRef.current && !isFocused && !isUndoRedoRef.current) {
      // 将 Markdown 转换为简单的 HTML
      const html = markdownToHtml(content);
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = html;
      }
    }
  }, [content, isFocused]);

  // 当外部内容变化时，重置历史记录
  useEffect(() => {
    if (!isUndoRedoRef.current) {
      // 只在内容真正改变时重置历史
      const currentState = historyRef.current[historyIndexRef.current];
      if (!currentState || currentState.content !== content) {
        historyRef.current = [{ content, timestamp: Date.now() }];
        historyIndexRef.current = 0;
      }
    }
  }, [content]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('keydown', handleKeyDown);
      return () => editor.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  // 简单的 Markdown 到 HTML 转换
  function markdownToHtml(markdown: string): string {
    if (!markdown) return "";
    
    let html = markdown
      // 标题
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // 删除线（必须在粗体之前处理）
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      // 粗体
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // 代码
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // 链接
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      // 图片
      .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" />')
      // 换行
      .replace(/\n/g, '<br>');
    
    return html;
  }

  // HTML 到 Markdown 转换
  function htmlToMarkdown(html: string): string {
    if (!html) return "";

    const container = document.createElement("div");
    container.innerHTML = html;

    function applyStyledFormatting(value: string, element: HTMLElement): string {
      const style = (element.getAttribute("style") ?? "").toLowerCase();
      const fontWeight = style.match(/font-weight\s*:\s*([^;]+)/)?.[1] ?? "";
      const fontStyle = style.match(/font-style\s*:\s*([^;]+)/)?.[1] ?? "";
      const textDecoration = style.match(/text-decoration(?:-line)?\s*:\s*([^;]+)/)?.[1] ?? "";
      const numericFontWeight = Number.parseInt(fontWeight, 10);

      let result = value;

      if (textDecoration.includes("line-through")) {
        result = `~~${result}~~`;
      }

      if (textDecoration.includes("underline")) {
        result = `<u>${result}</u>`;
      }

      if (fontStyle.includes("italic")) {
        result = `*${result}*`;
      }

      if (fontWeight.includes("bold") || (!Number.isNaN(numericFontWeight) && numericFontWeight >= 600)) {
        result = `**${result}**`;
      }

      return result;
    }

    function serializeChildren(element: HTMLElement): string {
      return Array.from(element.childNodes).map(serializeNode).join("");
    }

    function serializeList(children: HTMLCollection, ordered: boolean): string {
      return Array.from(children)
        .map((child, index) => {
          const content = serializeNode(child).replace(/\n+$/g, "");
          const prefix = ordered ? `${index + 1}. ` : "- ";

          return content
            .split("\n")
            .map((line, lineIndex) => (lineIndex === 0 ? `${prefix}${line}` : `   ${line}`))
            .join("\n");
        })
        .join("\n");
    }

    function serializeElement(element: HTMLElement): string {
      const tag = element.tagName.toLowerCase();
      const content = serializeChildren(element);

      switch (tag) {
        case "h1":
          return `# ${content}\n`;
        case "h2":
          return `## ${content}\n`;
        case "h3":
          return `### ${content}\n`;
        case "strong":
        case "b":
          return `**${content}**`;
        case "em":
        case "i":
          return `*${content}*`;
        case "s":
        case "del":
        case "strike":
          return `~~${content}~~`;
        case "u":
          return `<u>${content}</u>`;
        case "code":
          return `\`${content}\``;
        case "a": {
          const href = element.getAttribute("href") ?? "";
          return `[${content}](${href})`;
        }
        case "img": {
          const src = element.getAttribute("src") ?? "";
          const alt = element.getAttribute("alt") ?? "";
          return `![${alt}](${src})`;
        }
        case "p":
        case "div":
          return `${applyStyledFormatting(content, element)}\n`;
        case "ul":
          return `${serializeList(element.children, false)}\n`;
        case "ol":
          return `${serializeList(element.children, true)}\n`;
        case "li":
          return content;
        case "blockquote":
          return `${content
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map((line) => `> ${line}`)
            .join("\n")}\n`;
        default:
          return applyStyledFormatting(content, element);
      }
    }

    function serializeNode(node: ChildNode): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? "";
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const element = node as HTMLElement;

      if (element.tagName.toLowerCase() === "br") {
        return "\n";
      }

      return serializeElement(element);
    }

    return Array.from(container.childNodes)
      .map(serializeNode)
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

   function getCurrentMarkdown() {
     if (!editorRef.current) {
       return content;
     }

     return htmlToMarkdown(editorRef.current.innerHTML);
   }

   function syncContent() {
     const markdown = getCurrentMarkdown();
     onChange(markdown);
     return markdown;
   }

   useImperativeHandle(ref, () => ({
     getMarkdown: getCurrentMarkdown,
     syncContent,
   }), [content]);

  function handleInput() {
    if (editorRef.current && !isUndoRedoRef.current) {
      const html = editorRef.current.innerHTML;
      const markdown = htmlToMarkdown(html);
      
      // 添加到历史记录
      const now = Date.now();
      const currentIndex = historyIndexRef.current;
      const lastState = historyRef.current[currentIndex];
      
      // 如果内容没有变化，不记录
      if (lastState && markdown === lastState.content) {
        onChange(markdown);
        return;
      }
      
      // 如果距离上次记录超过 800ms，创建新的历史记录
      // 否则更新当前记录（合并快速连续的输入）
      const shouldCreateNewEntry = !lastState || now - lastState.timestamp > 800;
      
      if (shouldCreateNewEntry) {
        // 删除当前索引之后的所有历史记录（因为有新的编辑）
        historyRef.current = historyRef.current.slice(0, currentIndex + 1);
        
        // 添加新的历史记录
        historyRef.current.push({ content: markdown, timestamp: now });
        historyIndexRef.current = historyRef.current.length - 1;
        
        // 限制历史记录数量为 100
        if (historyRef.current.length > 100) {
          historyRef.current.shift();
          historyIndexRef.current--;
        }
        
        // 更新按钮状态
        forceUpdate({});
      } else {
        // 更新当前历史记录（合并连续的小改动）
        historyRef.current[currentIndex] = { content: markdown, timestamp: now };
      }
      
      onChange(markdown);
    }
  }

  function handleUndo() {
    const currentIndex = historyIndexRef.current;
    
    // 如果当前索引大于 0，可以撤销
    if (currentIndex > 0) {
      // 先保存当前状态（如果还没保存）
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        const markdown = htmlToMarkdown(html);
        const currentState = historyRef.current[currentIndex];
        
        // 如果当前内容与历史记录不同，更新历史记录
        if (currentState && markdown !== currentState.content) {
          historyRef.current[currentIndex] = { 
            content: markdown, 
            timestamp: Date.now() 
          };
        }
      }
      
      // 回退到上一个状态
      historyIndexRef.current = currentIndex - 1;
      const state = historyRef.current[historyIndexRef.current];
      
      isUndoRedoRef.current = true;
      
      // 更新编辑器内容
      if (editorRef.current && state) {
        const html = markdownToHtml(state.content);
        editorRef.current.innerHTML = html;
      }
      
      // 通知父组件
      if (state) {
        onChange(state.content);
      }
      
      // 更新按钮状态
      forceUpdate({});
      
      // 延迟重置标志
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 100);
    }
  }

  function handleRedo() {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const state = historyRef.current[historyIndexRef.current];
      
      isUndoRedoRef.current = true;
      
      // 更新编辑器内容
      if (editorRef.current) {
        const html = markdownToHtml(state.content);
        editorRef.current.innerHTML = html;
      }
      
      // 通知父组件
      onChange(state.content);
      
      // 更新按钮状态
      forceUpdate({});
      
      // 延迟重置标志
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 100);
    }
  }

  // 保存选区
  function saveSelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0);
    }
  }

  // 恢复选区
  function restoreSelection() {
    if (savedSelectionRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
  }

  function execCommand(command: string, value?: string) {
    // 阻止默认的撤销/重做命令
    if (command === 'undo' || command === 'redo') {
      return;
    }
    
    // 恢复选区
    restoreSelection();
    
    // 执行命令
    document.execCommand(command, false, value);
    
    // 重新聚焦编辑器
    editorRef.current?.focus();
    
    // 更新内容
    handleInput();
  }

  function isSelectionInsideEditor(selection: Selection) {
    const editor = editorRef.current;

    if (!editor || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);

    return editor.contains(range.commonAncestorContainer);
  }

  function moveCursorAfter(node: Node) {
    const selection = window.getSelection();

    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.setStartAfter(node);
    range.setEndAfter(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function applyBold() {
    restoreSelection();

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || !isSelectionInsideEditor(selection)) {
      return;
    }

    const range = selection.getRangeAt(0);
    const strong = document.createElement("strong");

    if (range.collapsed) {
      strong.textContent = "粗体";
    } else {
      strong.appendChild(range.extractContents());
    }

    range.deleteContents();
    range.insertNode(strong);
    moveCursorAfter(strong);
    editorRef.current?.focus();
    handleInput();
  }

  function findEditableBlock(node: Node | null): HTMLElement | null {
    const editor = editorRef.current;
    let current = node;

    while (current && current !== editor) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as HTMLElement;
        const tag = element.tagName.toLowerCase();

        if (["p", "div", "h1", "h2", "h3", "li", "blockquote"].includes(tag)) {
          return element;
        }
      }

      current = current.parentNode;
    }

    return null;
  }

  function insertHeading(level: number) {
    restoreSelection();

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || !isSelectionInsideEditor(selection)) {
      return;
    }

    const range = selection.getRangeAt(0);
    const heading = document.createElement(`h${level}`);

    if (range.collapsed) {
      const block = findEditableBlock(range.startContainer);

      if (block) {
        heading.innerHTML = block.innerHTML || `标题 ${level}`;
        block.replaceWith(heading);
      } else {
        heading.textContent = `标题 ${level}`;
        range.insertNode(heading);
      }
    } else {
      heading.appendChild(range.extractContents());
      range.deleteContents();
      range.insertNode(heading);
    }

    moveCursorAfter(heading);
    editorRef.current?.focus();
    handleInput();
  }

  function insertLink() {
    // 保存选区
    saveSelection();
    
    const url = window.prompt("请输入链接地址:");
    if (url) {
      execCommand("createLink", url);
    }
  }

  function insertImage() {
    // 调用父组件的图片点击处理函数
    if (onImageClick) {
      onImageClick();
    } else {
      // 如果没有提供处理函数，使用默认的 URL 输入方式
      saveSelection();
      const url = window.prompt("请输入图片地址:");
      if (url) {
        execCommand("insertImage", url);
      }
    }
  }

  return (
    <div className="space-y-2">
      {/* 工具栏 */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-slate-900/50 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault(); // 防止失去焦点
            saveSelection();
          }}
          onClick={applyBold}
          disabled={disabled}
          title="粗体 (Ctrl+B)"
        >
          <strong>粗体</strong>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => execCommand("italic")}
          disabled={disabled}
          title="斜体 (Ctrl+I)"
        >
          <em>斜体</em>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => execCommand("underline")}
          disabled={disabled}
          title="下划线 (Ctrl+U)"
        >
          <u>下划线</u>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => execCommand("strikeThrough")}
          disabled={disabled}
          title="删除线"
        >
          <s>删除线</s>
        </Button>
        
        <div className="mx-1 w-px bg-slate-700" />
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => insertHeading(1)}
          disabled={disabled}
        >
          H1
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => insertHeading(2)}
          disabled={disabled}
        >
          H2
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => insertHeading(3)}
          disabled={disabled}
        >
          H3
        </Button>
        
        <div className="mx-1 w-px bg-slate-700" />
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => execCommand("insertUnorderedList")}
          disabled={disabled}
        >
          • 列表
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => execCommand("insertOrderedList")}
          disabled={disabled}
        >
          1. 编号
        </Button>
        
        <div className="mx-1 w-px bg-slate-700" />
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={insertLink}
          disabled={disabled}
        >
          🔗 链接
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={insertImage}
          disabled={disabled}
        >
          🖼️ 图片
        </Button>
        
        <div className="mx-1 w-px bg-slate-700" />
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          disabled={disabled || historyIndexRef.current <= 0}
          title="撤销 (Ctrl+Z)"
        >
          ↶ 撤销
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRedo}
          disabled={disabled || historyIndexRef.current >= historyRef.current.length - 1}
          title="重做 (Ctrl+Y)"
        >
          ↷ 重做
        </Button>
      </div>

      {/* 编辑器内容区 */}
      <div className="rounded-lg border border-border bg-slate-900/70 shadow-panel">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            handleInput();
            setIsFocused(false);
            saveSelection(); // 失去焦点时保存选区
          }}
          onMouseUp={saveSelection} // 鼠标选择后保存选区
          onKeyUp={saveSelection} // 键盘选择后保存选区
          className="prose prose-invert max-w-none min-h-[45vh] px-4 py-3 focus:outline-none prose-headings:text-white prose-p:text-slate-300 prose-strong:text-white prose-code:text-sky-200 prose-pre:bg-slate-950/80 prose-blockquote:text-slate-300 prose-ul:text-slate-300 prose-ol:text-slate-300 prose-li:text-slate-300 prose-a:text-sky-400 prose-a:underline"
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
});
