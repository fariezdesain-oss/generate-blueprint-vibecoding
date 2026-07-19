'use client';

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import dynamic from 'next/dynamic';
import { Copy, Check , Wand2} from 'lucide-react';
import type { Components } from 'react-markdown';

const MermaidBlock = dynamic(
  () => import('./MermaidBlock').then((m) => m.MermaidBlock),
  { ssr: false, loading: () => (
    <div className="my-4 flex items-center gap-2 rounded-xl border border-subtle bg-tertiary p-4">
      <Wand2 className="size-3 animate-wand-swing text-gemini-blue" />
      <span className="text-xs text-tertiary">Memuat diagram...</span>
    </div>
  )}
);

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-lg border border-subtle bg-[rgba(255,255,255,0.05)] px-2 py-1 text-[10px] font-semibold text-tertiary transition-all hover:text-primary hover:bg-[rgba(255,255,255,0.1)]"
    >
      {copied ? <Check size={10} className="text-gemini-green" /> : <Copy size={10} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 mb-4 text-2xl font-extrabold text-primary border-b border-subtle pb-3">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 mb-3 text-lg font-extrabold text-primary">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-base font-extrabold text-primary">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-1.5 text-sm font-bold text-secondary">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-secondary">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 ml-5 list-disc space-y-1 text-secondary marker:text-secondary">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 ml-5 list-decimal space-y-1 text-secondary marker:text-secondary">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-gemini-blue/40 bg-gemini-blue/5 py-2 pl-4 pr-3 rounded-r-xl">
      <div className="text-sm italic text-secondary">{children}</div>
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-gemini-blue underline underline-offset-2 hover:text-gemini-teal transition-colors"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-primary">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-secondary">{children}</em>
  ),
  hr: () => (
    <hr className="my-6 border-subtle" />
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-subtle">
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--bg-tertiary)]">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-subtle">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="transition-colors hover:bg-[rgba(59,130,246,0.03)]">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-xs font-bold text-primary border-b border-subtle">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-xs text-secondary">
      {children}
    </td>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="rounded-md bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-xs text-gemini-blue border border-subtle"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={`${className ?? ''} font-mono text-xs`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => {
    const codeEl = (children as React.ReactElement<{ className?: string; children?: string }>);
    const className = codeEl?.props?.className ?? '';
    const rawCode = String(codeEl?.props?.children ?? '').replace(/\n$/, '');
    const lang = className.replace(/language-/, '');

    if (lang === 'mermaid') {
      return <MermaidBlock code={rawCode} />;
    }

    return (
      <div className="group relative my-4 overflow-hidden rounded-xl border border-subtle bg-[var(--bg-tertiary)]">
        <div className="flex items-center justify-between border-b border-subtle px-4 py-2">
          {lang && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-tertiary">
              {lang}
            </span>
          )}
          <div className={lang ? '' : 'ml-auto'}>
            <CopyButton text={rawCode} />
          </div>
        </div>
        <pre className="overflow-x-auto p-4 leading-relaxed" {...props}>
          {children}
        </pre>
      </div>
    );
  },
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
