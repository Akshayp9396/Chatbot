import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown'
})
export class MarkdownPipe implements PipeTransform {
  
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';
    
    let html = value;

    // Escape HTML entities for safety
    html = this.escapeHtml(html);

    // Convert headers first
    html = html.replace(/^### (.*)$/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gim, '<h1>$1</h1>');

    // Bold & Italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');

    // Code blocks (``````)
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    
    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Properly handle unordered lists
    html = html.replace(/^\s*[-*+]\s+(.*)$/gm, '<li>$1</li>');
    // Properly handle ordered lists
    html = html.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');

    // Group consecutive <li> elements into a <ul>
    html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, function(match) {
      return '<ul>' + match + '</ul>';
    });

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Remove new line to <br> replacement for better spacing control (Use CSS instead)
    // html = html.replace(/\n/g, '<br>');

    return this.sanitizer.sanitize(1, html) || '';
  }

  private escapeHtml(text: string): string {
    const map: { [key:string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
