import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const parseMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];
    let key = 0;
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle code blocks
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          // Starting a code block
          inCodeBlock = true;
          codeLanguage = line.trim().substring(3).trim();
          codeBlockLines = [];
        } else {
          // Ending a code block
          inCodeBlock = false;

          // Determine common indentation to strip
          const nonEmptyLines = codeBlockLines.filter(l => l.trim().length > 0);
          let minIndent = 0;
          
          if (nonEmptyLines.length > 0) {
            minIndent = nonEmptyLines.reduce((min, line) => {
              const match = line.match(/^(\s*)/);
              return Math.min(min, match ? match[1].length : 0);
            }, Infinity);
          }

          const formattedLines = minIndent > 0 && minIndent !== Infinity
            ? codeBlockLines.map(line => line.length >= minIndent ? line.substring(minIndent) : line)
            : codeBlockLines;

          result.push(
            <div key={key++} className="my-3 bg-black/30 backdrop-blur-sm rounded-lg overflow-hidden border border-white/10">
              {codeLanguage && (
                <div className="bg-black/20 px-3 py-2 text-xs text-slate-300 border-b border-white/10 font-mono">
                  {codeLanguage}
                </div>
              )}
              <pre className="p-3 text-sm text-slate-100 whitespace-pre-wrap break-all max-w-full">
                <code className="font-mono leading-relaxed block">{formattedLines.join('\n')}</code>
              </pre>
            </div>
          );
          codeBlockLines = [];
          codeLanguage = '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Parse the line with inline formatting
      const parsedLine = parseInlineFormatting(line, key);
      
      // Check for headers
      if (line.startsWith('#### ')) {
        result.push(<h4 key={key++} className="text-base font-semibold text-white mt-3 mb-2 break-words">{parseInlineFormatting(line.substring(5), key)}</h4>);
      } else if (line.startsWith('### ')) {
        result.push(<h3 key={key++} className="text-lg font-semibold text-white mt-3 mb-2 break-words">{parseInlineFormatting(line.substring(4), key)}</h3>);
      } else if (line.startsWith('## ')) {
        result.push(<h2 key={key++} className="text-xl font-bold text-white mt-4 mb-2 break-words">{parseInlineFormatting(line.substring(3), key)}</h2>);
      } else if (line.startsWith('# ')) {
        result.push(<h1 key={key++} className="text-2xl font-bold text-white mt-4 mb-2 break-words">{parseInlineFormatting(line.substring(2), key)}</h1>);
      }
      // Check for lists
      else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        result.push(
          <div key={key++} className="flex items-start space-x-2 my-1 break-words">
            <span className="text-blue-400 mt-1">•</span>
            <span className="flex-1 break-words">{parseInlineFormatting(line.trim().substring(2), key)}</span>
          </div>
        );
      }
      // Check for numbered lists
      else if (/^\d+\.\s/.test(line.trim())) {
        const match = line.trim().match(/^(\d+)\.\s(.+)$/);
        if (match) {
          result.push(
            <div key={key++} className="flex items-start space-x-2 my-1 break-words">
              <span className="text-blue-400 font-medium">{match[1]}.</span>
              <span className="flex-1 break-words">{parseInlineFormatting(match[2], key)}</span>
            </div>
          );
        }
      }
      // Empty line
      else if (line.trim() === '') {
        result.push(<div key={key++} className="h-2" />);
      }
      // Regular paragraph
      else {
        result.push(<p key={key++} className="my-1 break-words">{parsedLine}</p>);
      }
    }

    return result;
  };

  const parseInlineFormatting = (text: string, startKey: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = startKey;

    // Process text with multiple inline formats
    while (remaining.length > 0) {
      // Try to match inline code first (highest priority)
      const inlineCodeMatch = remaining.match(/`([^`]+)`/);
      if (inlineCodeMatch && inlineCodeMatch.index !== undefined) {
        // Add text before the match
        if (inlineCodeMatch.index > 0) {
          parts.push(...parseTextFormatting(remaining.substring(0, inlineCodeMatch.index), key++));
        }
        // Add the inline code
        parts.push(
          <code 
            key={key++} 
            className="bg-black/30 backdrop-blur-sm text-slate-100 px-2 py-1 rounded border border-white/10 text-sm font-mono break-words"
          >
            {inlineCodeMatch[1]}
          </code>
        );
        remaining = remaining.substring(inlineCodeMatch.index + inlineCodeMatch[0].length);
        continue;
      }

      // No more special formatting, process remaining text
      parts.push(...parseTextFormatting(remaining, key++));
      break;
    }

    return parts;
  };

  const parseTextFormatting = (text: string, startKey: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = startKey;

    while (remaining.length > 0) {
      // Try bold (**text** or __text__)
      const boldMatch = remaining.match(/\*\*(.+?)\*\*|__(.+?)__/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(...parseItalic(remaining.substring(0, boldMatch.index), key++));
        }
        parts.push(
          <strong key={key++} className="font-bold text-white break-words">
            {boldMatch[1] || boldMatch[2]}
          </strong>
        );
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // No more bold, check for italic
      parts.push(...parseItalic(remaining, key++));
      break;
    }

    return parts;
  };

  const parseItalic = (text: string, startKey: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = startKey;

    while (remaining.length > 0) {
      // Try italic (*text* or _text_) - but not ** or __
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/);
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) {
          parts.push(<span key={key++} className="break-words">{remaining.substring(0, italicMatch.index)}</span>);
        }
        parts.push(
          <em key={key++} className="italic text-slate-200 break-words">
            {italicMatch[1] || italicMatch[2]}
          </em>
        );
        remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
        continue;
      }

      // No more formatting
      if (remaining) {
        parts.push(<span key={key++} className="break-words">{remaining}</span>);
      }
      break;
    }

    return parts;
  };

  return (
    <div className={`markdown-content break-words max-w-full [overflow-wrap:anywhere] ${className}`}>
      {parseMarkdown(content)}
    </div>
  );
} 