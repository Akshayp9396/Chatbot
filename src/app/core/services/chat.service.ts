import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, catchError, timeout, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  // ========= Configure here =========
  private readonly baseUrl = environment.apiBaseUrl; // e.g. 'http://localhost:8080/api'

  // Adjust ONLY these paths if your backend uses different routes
  private readonly chatPath          = '/chat';                 // POST { message, images?, docs? } -> { reply }
  private readonly historyPath       = '/chat/history';         // GET -> Message[]
  private readonly quickRepliesPath  = '/chat/quick-replies';   // GET -> string[] | {id,text}[]

  private readonly uploadImagePath   = '/uploads/image';        // POST multipart -> { url, name, sizeKB, mimeType }
  private readonly uploadDocPath     = '/uploads/doc';          // POST multipart -> { url, name, sizeKB, mimeType }

  private readonly ocrImagePath      = '/ai/ocr';               // POST multipart -> { text }
  private readonly docToTextPath     = '/ai/doc2text';          // POST multipart -> { text | pages: string[] }

  private readonly sttPath           = '/voice/stt';            // POST multipart (audio) -> { text }
  private readonly voiceChatPath     = '/voice/chat';           // POST multipart (audio) -> { reply, audioUrl? }
  // ==================================

  constructor(private http: HttpClient) {}

  // Build headers per request (no interceptor)
  private buildHeaders(): HttpHeaders {
    let h = new HttpHeaders();
    if (environment.publicClientKey) h = h.set('X-Client-Key', environment.publicClientKey);
    if (environment.backendApiKey)   h = h.set('X-Api-Key',    environment.backendApiKey); // ⚠️ avoid secrets in FE if possible
    const token = localStorage.getItem('access_token');
    if (token) h = h.set('Authorization', `Bearer ${token}`);
    return h;
  }

  // Common options (toggle withCredentials if using cookie auth + CSRF)
  private opts() {
    return {
      headers: this.buildHeaders(),
      // withCredentials: true,
    } as const;
  }

  // -------- Uploads --------
  async uploadImage(file: File) {
    const form = new FormData(); form.append('file', file, file.name);
    return await firstValueFrom(
      this.http.post<{ url: string; name: string; sizeKB: number; mimeType: string }>(
        `${this.baseUrl}${this.uploadImagePath}`, form, this.opts()
      ).pipe(timeout(30000), catchError(e => throwError(() => this.err(e))))
    );
  }

  async uploadDocument(file: File) {
    const form = new FormData(); form.append('file', file, file.name);
    return await firstValueFrom(
      this.http.post<{ url: string; name: string; sizeKB: number; mimeType: string }>(
        `${this.baseUrl}${this.uploadDocPath}`, form, this.opts()
      ).pipe(timeout(30000), catchError(e => throwError(() => this.err(e))))
    );
  }

  async uploadManyImages(files: File[]) { const urls: string[] = []; for (const f of files) urls.push((await this.uploadImage(f)).url); return urls; }
  async uploadManyDocs(files: File[])   { const urls: string[] = []; for (const f of files) urls.push((await this.uploadDocument(f)).url); return urls; }

  // -------- AI helpers --------
  async ocrImage(file: File): Promise<string> {
    const form = new FormData(); form.append('file', file, file.name);
    const res = await firstValueFrom(
      this.http.post<{ text: string }>(`${this.baseUrl}${this.ocrImagePath}`, form, this.opts())
        .pipe(timeout(60000), catchError(e => throwError(() => this.err(e))))
    );
    return res?.text ?? '';
  }

  async docToText(file: File): Promise<{ text?: string; pages?: string[] }> {
    const form = new FormData(); form.append('file', file, file.name);
    return await firstValueFrom(
      this.http.post<{ text?: string; pages?: string[] }>(`${this.baseUrl}${this.docToTextPath}`, form, this.opts())
        .pipe(timeout(90000), catchError(e => throwError(() => this.err(e))))
    );
  }

  async transcribeAudio(blob: Blob): Promise<string> {
    const form = new FormData(); form.append('file', blob, 'audio.webm');
    const res = await firstValueFrom(
      this.http.post<{ text: string }>(`${this.baseUrl}${this.sttPath}`, form, this.opts())
        .pipe(timeout(90000), catchError(e => throwError(() => this.err(e))))
    );
    return res?.text ?? '';
  }

  async voiceToVoice(blob: Blob) {
    const form = new FormData(); form.append('file', blob, 'audio.webm');
    return await firstValueFrom(
      this.http.post<{ reply: string; audioUrl?: string }>(`${this.baseUrl}${this.voiceChatPath}`, form, this.opts())
        .pipe(timeout(120000), catchError(e => throwError(() => this.err(e))))
    );
  }

  // -------- Chat --------
  async askBot(payload: { message: string; images?: string[]; docs?: string[] }): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ reply: string }>(`${this.baseUrl}${this.chatPath}`, payload, this.opts())
        .pipe(timeout(30000), catchError(e => throwError(() => this.err(e))))
    );
    return res?.reply ?? '';
  }

  async getHistory(): Promise<any[]> {
    return await firstValueFrom(
      this.http.get<any[]>(`${this.baseUrl}${this.historyPath}`, this.opts())
        .pipe(timeout(15000), catchError(e => throwError(() => this.err(e))))
    );
  }

  async getQuickReplies(): Promise<Array<string | { id: string; text: string }>> {
    return await firstValueFrom(
      this.http.get<Array<string | { id: string; text: string }>>(`${this.baseUrl}${this.quickRepliesPath}`, this.opts())
        .pipe(timeout(15000), catchError(e => throwError(() => this.err(e))))
    );
  }

  // -------- Utility --------
  refreshWelcome(): { id: string; text: string; sender: 'bot'; createdAt: Date } {
    return { id: this.uuid(), text: "Hello! Welcome to Tunningspot . I'm your virtual assistant. How can I help you today?", sender: 'bot', createdAt: new Date() };
  }

  private err(e: any): Error {
    if (e instanceof HttpErrorResponse) {
      const reqId = e.headers?.get?.('X-Request-Id') || e.error?.requestId;
      const base = (e.error && (e.error.message || e.error.error)) || e.statusText || 'Network error';
      return new Error(reqId ? `${base} (ref: ${reqId})` : base);
    }
    return new Error((e && e.message) || 'Unexpected error');
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

