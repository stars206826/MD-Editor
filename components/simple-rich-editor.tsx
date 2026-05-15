"use client";

import { useEffect, useRef, useState } from "react";
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

export function SimpleRichEditor({
  content,
  onChange,
  placeholder = "开始输入内容...",
  disabled = false,
  onImageClick,
}: SimpleRichEditorProps) {
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
    
    let markdown = html
      // 标题
      .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n')
      // 粗体
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b>(.*?)<\/b>/gi, '**$1**')
      // 斜体
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i>(.*?)<\/i>/gi, '*$1*')
      // 删除线 - 添加对 <s> 和 <del> 标签的支持
      .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
      .replace(/<del>(.*?)<\/del>/gi, '~~$1~~')
      .replace(/<strike>(.*?)<\/strike>/gi, '~~$1~~')
      // 下划线 - 注意：Markdown 不支持下划线，转换为 HTML
      .replace(/<u>(.*?)<\/u>/gi, '<u>$1</u>')
      // 代码
      .replace(/<code>(.*?)<\/code>/gi, '`$1`')
      // 链接
      .replace(/<a href="(.*?)">(.*?)<\/a>/gi, '[$2]($1)')
      // 图片
      .replace(/<img src="(.*?)" alt="(.*?)".*?>/gi, '![$2]($1)')
      // 换行
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p>/gi, '')
      // 清理其他 HTML 标签
      .replace(/<[^>]+>/g, '');
    
    return markdown.trim();
  }

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

  function insertHeading(level: number) {
    // 恢复选区
    restoreSelection();
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const heading = document.createElement(`h${level}`);
      heading.textContent = selection.toString() || `标题 ${level}`;
      range.deleteContents();
      range.insertNode(heading);
      
      // 将光标移到标题后面
      range.setStartAfter(heading);
      range.setEndAfter(heading);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleInput();
    }
    
    editorRef.current?.focus();
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
          onClick={() => execCommand("bold")}
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
}
