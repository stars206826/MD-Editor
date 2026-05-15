import { describe, it, expect } from "vitest";
import { applyMarkdownFormat, type TextSelection, type MarkdownFormat } from "./markdown-toolbar";

/**
 * Unit tests for MarkdownToolbar component
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.7**
 */
describe("applyMarkdownFormat", () => {
  describe("bold formatting", () => {
    it("should wrap selected text with bold syntax", () => {
      const selection: TextSelection = {
        start: 0,
        end: 5,
        text: "hello",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("bold", selection, content);

      expect(result.newContent).toBe("**hello** world");
      expect(result.cursorPosition).toBe(9); // After "**hello**"
    });

    it("should insert bold syntax at cursor position when no text selected", () => {
      const selection: TextSelection = {
        start: 5,
        end: 5,
        text: "",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("bold", selection, content);

      expect(result.newContent).toBe("hello**** world");
      expect(result.cursorPosition).toBe(7); // Between the asterisks
    });
  });

  describe("italic formatting", () => {
    it("should wrap selected text with italic syntax", () => {
      const selection: TextSelection = {
        start: 0,
        end: 5,
        text: "hello",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("italic", selection, content);

      expect(result.newContent).toBe("*hello* world");
      expect(result.cursorPosition).toBe(7); // After "*hello*"
    });

    it("should insert italic syntax at cursor position when no text selected", () => {
      const selection: TextSelection = {
        start: 5,
        end: 5,
        text: "",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("italic", selection, content);

      expect(result.newContent).toBe("hello** world");
      expect(result.cursorPosition).toBe(6); // Between the asterisks
    });
  });

  describe("heading formatting", () => {
    it("should add heading syntax before selected text", () => {
      const selection: TextSelection = {
        start: 0,
        end: 5,
        text: "hello",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("heading", selection, content);

      expect(result.newContent).toBe("## hello world");
      expect(result.cursorPosition).toBe(8); // After "## hello"
    });

    it("should insert heading syntax at cursor position when no text selected", () => {
      const selection: TextSelection = {
        start: 0,
        end: 0,
        text: "",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("heading", selection, content);

      expect(result.newContent).toBe("## hello world");
      expect(result.cursorPosition).toBe(3); // After "## "
    });
  });

  describe("link formatting", () => {
    it("should wrap selected text with link syntax", () => {
      const selection: TextSelection = {
        start: 0,
        end: 5,
        text: "hello",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("link", selection, content);

      expect(result.newContent).toBe("[hello](url) world");
      expect(result.cursorPosition).toBe(8); // At "url" position
    });

    it("should insert link syntax at cursor position when no text selected", () => {
      const selection: TextSelection = {
        start: 5,
        end: 5,
        text: "",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("link", selection, content);

      expect(result.newContent).toBe("hello[](url) world");
      expect(result.cursorPosition).toBe(6); // Between the brackets
    });
  });

  describe("code formatting", () => {
    it("should wrap selected text with code syntax", () => {
      const selection: TextSelection = {
        start: 0,
        end: 5,
        text: "hello",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("code", selection, content);

      expect(result.newContent).toBe("`hello` world");
      expect(result.cursorPosition).toBe(7); // After "`hello`"
    });

    it("should insert code syntax at cursor position when no text selected", () => {
      const selection: TextSelection = {
        start: 5,
        end: 5,
        text: "",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("code", selection, content);

      expect(result.newContent).toBe("hello`` world");
      expect(result.cursorPosition).toBe(6); // Between the backticks
    });
  });

  describe("quote formatting", () => {
    it("should add quote syntax before selected text", () => {
      const selection: TextSelection = {
        start: 0,
        end: 5,
        text: "hello",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("quote", selection, content);

      expect(result.newContent).toBe("> hello world");
      expect(result.cursorPosition).toBe(7); // After "> hello"
    });

    it("should insert quote syntax at cursor position when no text selected", () => {
      const selection: TextSelection = {
        start: 0,
        end: 0,
        text: "",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("quote", selection, content);

      expect(result.newContent).toBe("> hello world");
      expect(result.cursorPosition).toBe(2); // After "> "
    });
  });

  describe("list formatting", () => {
    it("should add list syntax before selected text", () => {
      const selection: TextSelection = {
        start: 0,
        end: 5,
        text: "hello",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("list", selection, content);

      expect(result.newContent).toBe("- hello world");
      expect(result.cursorPosition).toBe(7); // After "- hello"
    });

    it("should insert list syntax at cursor position when no text selected", () => {
      const selection: TextSelection = {
        start: 0,
        end: 0,
        text: "",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("list", selection, content);

      expect(result.newContent).toBe("- hello world");
      expect(result.cursorPosition).toBe(2); // After "- "
    });
  });

  describe("image formatting", () => {
    it("should wrap selected text with image syntax", () => {
      const selection: TextSelection = {
        start: 0,
        end: 5,
        text: "hello",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("image", selection, content);

      expect(result.newContent).toBe("![hello](url) world");
      expect(result.cursorPosition).toBe(9); // At "url" position
    });

    it("should insert image syntax at cursor position when no text selected", () => {
      const selection: TextSelection = {
        start: 5,
        end: 5,
        text: "",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("image", selection, content);

      expect(result.newContent).toBe("hello![](url) world");
      expect(result.cursorPosition).toBe(7); // Between the brackets
    });
  });

  describe("edge cases", () => {
    it("should handle empty content", () => {
      const selection: TextSelection = {
        start: 0,
        end: 0,
        text: "",
      };
      const content = "";

      const result = applyMarkdownFormat("bold", selection, content);

      expect(result.newContent).toBe("****");
      expect(result.cursorPosition).toBe(2);
    });

    it("should handle selection at end of content", () => {
      const selection: TextSelection = {
        start: 11,
        end: 11,
        text: "",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("bold", selection, content);

      expect(result.newContent).toBe("hello world****");
      expect(result.cursorPosition).toBe(13);
    });

    it("should handle full content selection", () => {
      const selection: TextSelection = {
        start: 0,
        end: 11,
        text: "hello world",
      };
      const content = "hello world";

      const result = applyMarkdownFormat("bold", selection, content);

      expect(result.newContent).toBe("**hello world**");
      expect(result.cursorPosition).toBe(15);
    });

    it("should handle selection in middle of content", () => {
      const selection: TextSelection = {
        start: 6,
        end: 11,
        text: "world",
      };
      const content = "hello world!";

      const result = applyMarkdownFormat("italic", selection, content);

      expect(result.newContent).toBe("hello *world*!");
      expect(result.cursorPosition).toBe(13);
    });
  });
});
