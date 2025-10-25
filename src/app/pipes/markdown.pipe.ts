import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown'
})
export class MarkdownPipe implements PipeTransform {
  
  constructor(private sanitizer: DomSanitizer) {}

 // REPLACE THE ENTIRE transform METHOD WITH THIS ENHANCED VERSION:
  transform(value: string): SafeHtml {
    if (!value) return '';
    
    let html = value;

    // Split by lines for better processing
    const lines = html.split('\n');
    const processed: string[] = [];
    let inList = false;
    let listType = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Check for unordered list
      if (/^\s*[-*+]\s+/.test(line)) {
        if (!inList || listType !== 'ul') {
          if (inList) processed.push(`</${listType}>`);
          processed.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        line = line.replace(/^\s*[-*+]\s+/, '<li>') + '</li>';
      }
      // Check for ordered list
      else if (/^\s*\d+\.\s+/.test(line)) {
        if (!inList || listType !== 'ol') {
          if (inList) processed.push(`</${listType}>`);
          processed.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        line = line.replace(/^\s*\d+\.\s+/, '<li>') + '</li>';
      }
      // Not a list item
      else {
        if (inList) {
          processed.push(`</${listType}>`);
          inList = false;
        }
      }
      
      processed.push(line);
    }
    
    if (inList) {
      processed.push(`</${listType}>`);
    }

    html = processed.join('\n');

    // Apply other formatting (headers, bold, italic, code)
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/``````/g, '<pre><code>$1</code></pre>');
    html = html.replace(/\n/g, '<br>');

    return this.sanitizer.sanitize(1, html) || '';
  }

  // Keep the escapeHtml method if you want extra security
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}