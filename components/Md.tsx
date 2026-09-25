import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/** Markdown with $…$ / $$…$$ math (KaTeX) and GitHub-style tables. Works on server and client. */
export function Md({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Inline markdown (no wrapping paragraph), for answer choices. */
export function MdInline({ children }: { children: string }) {
  return (
    <span className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ p: ({ children }) => <>{children}</> }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}
