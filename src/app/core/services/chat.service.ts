// import { Injectable } from '@angular/core';
// import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
// import { firstValueFrom, catchError, timeout, throwError } from 'rxjs';
// import { environment } from 'src/environments/environment';

// @Injectable({ providedIn: 'root' })
// export class ChatService {
//   // ========= Configure here =========
//   private readonly baseUrl = environment.apiBaseUrl; // e.g. 'http://localhost:8080/api'

//   // Adjust ONLY these paths if your backend uses different routes
//   private readonly chatPath          = '/chat';                 // done POST { message, images?, docs? } -> { reply }
//   private readonly historyPath       = '/chat/history';         // GET -> Message[]
//   private readonly quickRepliesPath  = '/chat/quick-replies';   // GET -> string[] | {id,text}[]

//   private readonly uploadImagePath   = '/uploads/image';        // POST multipart -> { url, name, sizeKB, mimeType }
//   private readonly uploadDocPath     = '/uploads/doc';          // POST multipart -> { url, name, sizeKB, mimeType }

//   private readonly ocrImagePath      = '/ai/ocr';               // POST multipart -> { text }
//   private readonly docToTextPath     = '/ai/doc2text';          // POST multipart -> { text | pages: string[] }

//   private readonly sttPath           = '/stt';            // done POST multipart (audio) -> { text }
//   private readonly voiceChatPath     = '/voice/chat';           // POST multipart (audio) -> { reply, audioUrl? }
//   // ==================================

//   constructor(private http: HttpClient) {}

//   // Build headers per request (no interceptor)
//   private buildHeaders(): HttpHeaders {
//     let h = new HttpHeaders();
//     if (environment.publicClientKey) h = h.set('X-Client-Key', environment.publicClientKey);
//     if (environment.backendApiKey)   h = h.set('X-Api-Key',    environment.backendApiKey); // ⚠️ avoid secrets in FE if possible
//     const token = localStorage.getItem('access_token');
//     if (token) h = h.set('Authorization', `Bearer ${token}`);
//     return h;
//   }

//   // Common options (toggle withCredentials if using cookie auth + CSRF)
//   private opts() {
//     return {
//       headers: this.buildHeaders(),
//       // withCredentials: true,
//     } as const;
//   }

//   // -------- Uploads --------
//   async uploadImage(file: File) {
//     const form = new FormData(); form.append('file', file, file.name);
//     return await firstValueFrom(
//       this.http.post<{ url: string; name: string; sizeKB: number; mimeType: string }>(
//         `${this.baseUrl}${this.uploadImagePath}`, form, this.opts()
//       ).pipe(timeout(30000), catchError(e => throwError(() => this.err(e))))
//     );
//   }

//   async uploadDocument(file: File) {
//     const form = new FormData(); form.append('file', file, file.name);
//     return await firstValueFrom(
//       this.http.post<{ url: string; name: string; sizeKB: number; mimeType: string }>(
//         `${this.baseUrl}${this.uploadDocPath}`, form, this.opts()
//       ).pipe(timeout(30000), catchError(e => throwError(() => this.err(e))))
//     );
//   }

//   async uploadManyImages(files: File[]) { const urls: string[] = []; for (const f of files) urls.push((await this.uploadImage(f)).url); return urls; }
//   async uploadManyDocs(files: File[])   { const urls: string[] = []; for (const f of files) urls.push((await this.uploadDocument(f)).url); return urls; }

//   // -------- AI helpers --------
//   async ocrImage(file: File): Promise<string> {
//     const form = new FormData(); form.append('file', file, file.name);
//     const res = await firstValueFrom(
//       this.http.post<{ text: string }>(`${this.baseUrl}${this.ocrImagePath}`, form, this.opts())
//         .pipe(timeout(60000), catchError(e => throwError(() => this.err(e))))
//     );
//     return res?.text ?? '';
//   }

//   async docToText(file: File): Promise<{ text?: string; pages?: string[] }> {
//     const form = new FormData(); form.append('file', file, file.name);
//     return await firstValueFrom(
//       this.http.post<{ text?: string; pages?: string[] }>(`${this.baseUrl}${this.docToTextPath}`, form, this.opts())
//         .pipe(timeout(90000), catchError(e => throwError(() => this.err(e))))
//     );
//   }

//   async transcribeAudio(blob: Blob): Promise<string> {
//     const form = new FormData(); form.append('file', blob, 'audio.webm');
//     const res = await firstValueFrom(
//       this.http.post<{ text: string }>(`${this.baseUrl}${this.sttPath}`, form, this.opts())
//         .pipe(timeout(90000), catchError(e => throwError(() => this.err(e))))
//     );
//     return res?.text ?? '';
//   }

//   async voiceToVoice(blob: Blob) {
//     const form = new FormData(); form.append('file', blob, 'audio.webm');
//     return await firstValueFrom(
//       this.http.post<{ reply: string; audioUrl?: string }>(`${this.baseUrl}${this.voiceChatPath}`, form, this.opts())
//         .pipe(timeout(120000), catchError(e => throwError(() => this.err(e))))
//     );
//   }

//   // -------- Chat --------
//   async askBot(payload: { message: string; images?: string[]; docs?: string[] }): Promise<string> {
//     const res = await firstValueFrom(
//       this.http.post<{ reply: string }>(`${this.baseUrl}${this.chatPath}`, payload, this.opts())
//         .pipe(timeout(30000), catchError(e => throwError(() => this.err(e))))
//     );
//     return res?.reply ?? '';
//   }

//   async getHistory(): Promise<any[]> {
//     return await firstValueFrom(
//       this.http.get<any[]>(`${this.baseUrl}${this.historyPath}`, this.opts())
//         .pipe(timeout(15000), catchError(e => throwError(() => this.err(e))))
//     );
//   }

//   async getQuickReplies(): Promise<Array<string | { id: string; text: string }>> {
//     return await firstValueFrom(
//       this.http.get<Array<string | { id: string; text: string }>>(`${this.baseUrl}${this.quickRepliesPath}`, this.opts())
//         .pipe(timeout(15000), catchError(e => throwError(() => this.err(e))))
//     );
//   }

//   // -------- Utility --------
//   refreshWelcome(): { id: string; text: string; sender: 'bot'; createdAt: Date } {
//     return { id: this.uuid(), text: "Hello! Welcome to Tunningspot . I'm your virtual assistant. How can I help you today?", sender: 'bot', createdAt: new Date() };
//   }

//   private err(e: any): Error {
//     if (e instanceof HttpErrorResponse) {
//       const reqId = e.headers?.get?.('X-Request-Id') || e.error?.requestId;
//       const base = (e.error && (e.error.message || e.error.error)) || e.statusText || 'Network error';
//       return new Error(reqId ? `${base} (ref: ${reqId})` : base);
//     }
//     return new Error((e && e.message) || 'Unexpected error');
//   }

//   private uuid(): string {
//     return typeof crypto !== 'undefined' && 'randomUUID' in crypto
//       ? (crypto as any).randomUUID()
//       : Math.random().toString(36).slice(2) + Date.now().toString(36);
//   }
// }



import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, catchError, timeout, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

type ChatJson = { text: string; session_id: string; chat_id?: string | null; tts?: boolean; voice?: 'male' | 'female' };
type ChatRes  = { text: string; chat_id?: string | null; audio_url?: string | null };
type STTRes   = { text: string; duration_sec: number };
type UploadRes = { status: 'uploaded' | 'indexed'; doc_id: string; pages: number };
type ConverseRes = {
  transcript: string;
  reply_text: string;
  audio_url?: string;
  duration_sec: number;
  chat_id?: string | null;
};

@Injectable({ providedIn: 'root' })
export class ChatService {
  // ========= Configure here =========
  private readonly baseUrl = environment.apiBaseUrl; // e.g. 'http://localhost:8000'

  // Backend routes (from your backend spec)
  private readonly chatPath          = '/chat';             // POST JSON -> { text, chat_id, audio_url? (null) }
  private readonly ttsPath           = '/tts';              // POST JSON -> { audio_url }  (kept for completeness)
  private readonly sttPath           = '/stt';              // POST multipart (audio, language?) -> { text, duration_sec }
  private readonly uploadPath        = '/upload';           // POST multipart (file, ocr_language, ingest_now) -> { status, doc_id, pages }
  private readonly ingestRefreshPath = '/ingest/refresh';   // POST {} -> { status:'ok' }
  private readonly healthPath        = '/health';           // GET -> { status:'ok' }
  private readonly conversePath      = '/converse';         // POST multipart (audio, language, voice, session_id, chat_id?) -> { ... }

  // Legacy/optional endpoints your UI referenced (may not exist on backend)
  private readonly historyPath       = '/chat/history';
  private readonly quickRepliesPath  = '/chat/quick-replies';

  // Keep chat continuity in the service
  private chatId: string | null = null;

  constructor(private http: HttpClient) {}

  // ----- Session ID (one per tab) -----
  private get sessionId(): string {
    const KEY = 'SESSION_ID';
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;

    const generated = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? (crypto as any).randomUUID()
      : (Math.random().toString(36).slice(2) + Date.now().toString(36));

    localStorage.setItem(KEY, generated);
    return generated;
  }

  // ----- Headers -----
  private buildHeaders(): HttpHeaders {
    // Keep it simple and aligned with backend: only Accept + Authorization
    // (Angular sets Content-Type automatically for JSON; never set it for FormData)
    let h = new HttpHeaders({ Accept: 'application/json' });

    // Prefer BACKEND_API_KEY in env, otherwise use a stored token if you keep one
    const token =
      environment.backendApiKey ||
      localStorage.getItem('BACKEND_API_TOKEN') ||
      localStorage.getItem('access_token');

    if (token) h = h.set('Authorization', `Bearer ${token}`);
    return h;
  }

  private opts() {
    return { headers: this.buildHeaders() } as const;
  }

  // ================== Core features (match backend) ==================

  /** Chat (text -> text). Keeps your current signature but sends backend JSON shape. */
  async askBot(payload: { message: string; images?: string[]; docs?: string[] }): Promise<string> {
    const body: ChatJson = {
      text: payload.message,
      session_id: this.sessionId,
      chat_id: this.chatId ?? undefined,
    };

    const res = await firstValueFrom(
      this.http.post<ChatRes>(`${this.baseUrl}${this.chatPath}`, body, this.opts())
        .pipe(timeout(30000), catchError(e => throwError(() => this.err(e))))
    );

    // Persist chat_id for continuity
    if (res?.chat_id) this.chatId = res.chat_id;
    return res?.text ?? '';
  }

  /** STT (audio -> text). Field must be named "audio" per backend. */
  async transcribeAudio(blob: Blob, language = 'en'): Promise<string> {
    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    form.append('language', language);

    const res = await firstValueFrom(
      this.http.post<STTRes>(`${this.baseUrl}${this.sttPath}`, form, this.opts())
        .pipe(timeout(90000), catchError(e => throwError(() => this.err(e))))
    );
    return res?.text ?? '';
  }

  /** Voice-to-voice (single call): audio -> STT -> RAG -> TTS via /converse. */
  async voiceToVoice(blob: Blob, language = 'en', voice: 'male' | 'female' = 'male') {
    const form = new FormData();
    form.append('audio', blob, 'audio.webm');
    form.append('language', language);
    form.append('voice', voice);
    form.append('session_id', this.sessionId);
    if (this.chatId) form.append('chat_id', this.chatId);

    const res = await firstValueFrom(
      this.http.post<ConverseRes>(`${this.baseUrl}${this.conversePath}`, form, this.opts())
        .pipe(timeout(120000), catchError(e => throwError(() => this.err(e))))
    );

    if (res?.chat_id) this.chatId = res.chat_id ?? this.chatId;

    // Map to your existing return shape so UI doesn’t change
    return {
      reply: res?.reply_text ?? '',
      audioUrl: res?.audio_url || undefined,
      transcript: res?.transcript ?? '',
      durationSec: res?.duration_sec ?? 0
    };
  }

  /** Upload Image -> use unified /upload under the hood, keep separate method for UI. */
  async uploadImage(file: File) {
    return await this._uploadCommon(file, 'eng', true);
  }

  /** Upload Document -> use unified /upload under the hood, keep separate method for UI. */
  async uploadDocument(file: File) {
    return await this._uploadCommon(file, 'eng', true);
  }

  private async _uploadCommon(file: File, ocrLang: string, ingestNow: boolean) {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('ocr_language', ocrLang);
    form.append('ingest_now', String(ingestNow));

    const r = await firstValueFrom(
      this.http.post<UploadRes>(`${this.baseUrl}${this.uploadPath}`, form, this.opts())
        .pipe(timeout(60000), catchError(e => throwError(() => this.err(e))))
    );

    // Return the shape your component expects
    return {
      url: r.doc_id, // stand-in "url" so your component logic keeps working
      name: file.name,
      sizeKB: Math.max(1, Math.round(file.size / 1024)),
      mimeType: file.type || 'application/octet-stream',
    };
  }

  async uploadManyImages(files: File[]) {
    const urls: string[] = [];
    for (const f of files) urls.push((await this.uploadImage(f)).url);
    return urls;
  }

  async uploadManyDocs(files: File[]) {
    const urls: string[] = [];
    for (const f of files) urls.push((await this.uploadDocument(f)).url);
    return urls;
  }

  /** Ingestion refresh (incremental embeddings). */
  async ingestRefresh(): Promise<{ status: string }> {
    return await firstValueFrom(
      this.http.post<{ status: string }>(`${this.baseUrl}${this.ingestRefreshPath}`, {}, this.opts())
        .pipe(timeout(20000), catchError(e => throwError(() => this.err(e))))
    );
  }

  /** Health probe. */
  async health(): Promise<{ status: string }> {
    return await firstValueFrom(
      this.http.get<{ status: string }>(`${this.baseUrl}${this.healthPath}`, this.opts())
        .pipe(timeout(10000), catchError(e => throwError(() => this.err(e))))
    );
  }

  // ================== Optional / compatibility helpers ==================

  /** TTS helper (kept for completeness; not used if you don’t need TTS from backend). */
  async tts(text: string, voice: 'male' | 'female' = 'male'): Promise<string | undefined> {
    const body = { text, voice };
    const res = await firstValueFrom(
      this.http.post<{ audio_url: string }>(`${this.baseUrl}${this.ttsPath}`, body, this.opts())
        .pipe(timeout(45000), catchError(e => throwError(() => this.err(e))))
    );
    return res?.audio_url;
  }

  /** These two are no-ops now because backend does OCR inside /upload. */
  async ocrImage(_file: File): Promise<string> { return ''; }
  async docToText(_file: File): Promise<{ text?: string; pages?: string[] }> { return {}; }

  /** Legacy endpoints; only keep if your UI really calls them. */
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

  // ================== Utilities ==================
  refreshWelcome(): { id: string; text: string; sender: 'bot'; createdAt: Date } {
    return {
      id: this.uuid(),
      text: "Hello! Welcome to Tunningspot . I'm your virtual assistant. How can I help you today?",
      sender: 'bot',
      createdAt: new Date(),
    };
  }

  private err(e: any): Error {
    if (e instanceof HttpErrorResponse) {
      const reqId = e.headers?.get?.('X-Request-Id') || e.error?.requestId;
      const base =
        (e.error && (e.error.detail || e.error.message || e.error.error)) ||
        e.statusText ||
        'Network error';
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


