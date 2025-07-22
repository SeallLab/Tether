import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const parseMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let key = 0;

    // First, handle code blocks (```)
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const [fullMatch, language, code] = match;
      const beforeMatch = text.slice(currentIndex, match.index);
      
      // Add text before the code block
      if (beforeMatch) {
        parts.push(...parseInlineFormatting(beforeMatch, key));
        key += beforeMatch.length;
      }
      
      // Add the code block
      parts.push(
        <div key={key} className="my-3 bg-black/30 backdrop-blur-sm rounded-lg overflow-hidden border border-white/10">
          {language && (
            <div className="bg-black/20 px-3 py-2 text-xs text-slate-300 border-b border-white/10 font-mono">
              {language}
            </div>
          )}
          <pre className="p-4 text-sm text-slate-100 overflow-x-auto">
            <code className="font-mono leading-relaxed">{code.trim()}</code>
          </pre>
        </div>
      );
      key++;
      
      currentIndex = match.index + fullMatch.length;
    }
    
    // Add remaining text after the last code block
    const remainingText = text.slice(currentIndex);
    if (remainingText) {
      parts.push(...parseInlineFormatting(remainingText, key));
    }
    
    return parts;
  };

  const parseInlineFormatting = (text: string, startKey: number) => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let key = startKey;

    // Handle inline code (`code`)
    const inlineCodeRegex = /`([^`]+)`/g;
    let match;
    
    while ((match = inlineCodeRegex.exec(text)) !== null) {
      const [fullMatch, code] = match;
      const beforeMatch = text.slice(currentIndex, match.index);
      
      // Add text before the inline code
      if (beforeMatch) {
        parts.push(
          <span key={key}>{beforeMatch}</span>
        );
        key++;
      }
      
      // Add the inline code
      parts.push(
        <code 
          key={key} 
          className="bg-black/30 backdrop-blur-sm text-slate-100 px-2 py-1 rounded border border-white/10 text-sm font-mono"
        >
          {code}
        </code>
      );
      key++;
      
      currentIndex = match.index + fullMatch.length;
    }
    
    // Add remaining text after the last inline code
    const remainingText = text.slice(currentIndex);
    if (remainingText) {
      parts.push(
        <span key={key}>{remainingText}</span>
      );
    }
    
    return parts;
  };

  const renderContent = () => {
    // If no code blocks or inline code, return plain text
    if (!content.includes('```') && !content.includes('`')) {
      return content;
    }
    
    return parseMarkdown(content);
  };

  return (
    <div className={`markdown-content ${className}`}>
      {renderContent()}
    </div>
  );
} 