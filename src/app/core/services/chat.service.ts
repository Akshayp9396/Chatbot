

// // src/app/core/services/chat.service.ts
// import { Injectable } from '@angular/core';
// import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
// import { firstValueFrom, catchError, timeout, throwError } from 'rxjs';
// import { environment } from 'src/environments/environment';

// // ===== Types =====
// type ChatJson = { text: string; session_id: string; chat_id?: string | null; tts?: boolean; voice?: 'male' | 'female' };
// type ChatRes  = { text: string; chat_id?: string | null; audio_url?: string | null };
// type STTRes   = { text: string; duration_sec: number };
// type UploadRes = { status: 'uploaded' | 'indexed'; doc_id: string; pages: number };
// type ConverseRes = {
//   transcript: string;
//   reply_text: string;
//   audio_url?: string;
//   duration_sec: number;
//   chat_id?: string | null;
// };

// @Injectable({ providedIn: 'root' })
// export class ChatService {
//   // ========= Configure here =========
//   private readonly baseUrl = environment.apiBaseUrl; // e.g. 'http://192.168.29.120:8000'

//   // Backend routes
//   private readonly chatPath          = '/chat';
//   private readonly ttsPath           = '/tts';
//   private readonly sttPath           = '/stt';
//   private readonly uploadPath        = '/upload';
//   private readonly ingestRefreshPath = '/ingest/refresh';
//   private readonly healthPath        = '/health';
//   private readonly conversePath      = '/converse';

//   // Legacy/optional endpoints your UI referenced
//   private readonly historyPath       = '/chat/history';
//   private readonly quickRepliesPath  = '/chat/quick-replies';

//   // ========= Multi-session keys =========
//   private readonly SS_CURRENT = 'CURRENT_SESSION_ID';    // per-tab current session
//   private readonly LS_SESSIONS = 'SESSIONS_INDEX';       // [{id,label,createdAt}]
//   private readonly LS_CHATID_PREFIX = 'CHAT_ID::';       // CHAT_ID::<sessionId>

//   // Chat continuity for the current session
//   private chatId: string | null = null;

//   constructor(private http: HttpClient) {
//     const sid = this.resolveInitialSessionId();
//     this.setCurrentSessionInternal(sid);
//   }

//   // ========= Session core =========
//   private resolveInitialSessionId(): string {
//     const urlSid = new URLSearchParams(location.search).get('sid');
//     if (urlSid) {
//       this.ensureSessionIndexed(urlSid, '(from-url)');
//       sessionStorage.setItem(this.SS_CURRENT, urlSid);
//       return urlSid;
//     }
//     const existing = sessionStorage.getItem(this.SS_CURRENT);
//     if (existing) return existing;
//     const created = this.createSessionId();
//     this.ensureSessionIndexed(created, 'Tab Session');
//     sessionStorage.setItem(this.SS_CURRENT, created);
//     return created;
//   }

//   private createSessionId(): string {
//     return (crypto as any)?.randomUUID?.()
//       ?? (Math.random().toString(36).slice(2) + Date.now().toString(36));
//   }

//   private readIndex(): Array<{ id: string; label: string; createdAt: string }> {
//     try { return JSON.parse(localStorage.getItem(this.LS_SESSIONS) || '[]'); } catch { return []; }
//   }
//   private writeIndex(list: Array<{ id: string; label: string; createdAt: string }>) {
//     localStorage.setItem(this.LS_SESSIONS, JSON.stringify(list));
//   }
//   private ensureSessionIndexed(id: string, label = '') {
//     const idx = this.readIndex();
//     if (!idx.some(s => s.id === id)) {
//       idx.push({ id, label, createdAt: new Date().toISOString() });
//       this.writeIndex(idx);
//     }
//   }

//   get sessionId(): string {
//     return sessionStorage.getItem(this.SS_CURRENT)!;
//   }

//   private setCurrentSessionInternal(id: string) {
//     sessionStorage.setItem(this.SS_CURRENT, id);
//     const stored = localStorage.getItem(this.LS_CHATID_PREFIX + id);
//     this.chatId = stored || null;
//   }

//   // ========= Public session API (use in components if you want UI for sessions) =========
//   public newSession(label = 'Session'): string {
//     const id = this.createSessionId();
//     this.ensureSessionIndexed(id, label);
//     this.setCurrentSessionInternal(id);
//     return id;
//   }
//   public useSession(id: string): boolean {
//     const found = this.readIndex().some(s => s.id === id);
//     if (!found) return false;
//     this.setCurrentSessionInternal(id);
//     return true;
//   }
//   public listSessions() { return this.readIndex(); }
//   public currentSession() {
//     const id = this.sessionId;
//     return this.readIndex().find(s => s.id === id) ?? { id, label: '(current)', createdAt: '' };
//   }
//   public deleteSession(id: string) {
//     const left = this.readIndex().filter(s => s.id !== id);
//     this.writeIndex(left);
//     localStorage.removeItem(this.LS_CHATID_PREFIX + id);
//     if (this.sessionId === id) {
//       const fresh = this.newSession('Session');
//       this.setCurrentSessionInternal(fresh);
//     }
//   }

//   // ========= Headers / opts =========
//   private buildHeaders(): HttpHeaders {
//     let h = new HttpHeaders({ Accept: 'application/json' });
//     const token =
//       environment.backendApiKey ||
//       localStorage.getItem('BACKEND_API_TOKEN') ||
//       localStorage.getItem('access_token');
//     if (token) h = h.set('Authorization', `Bearer ${token}`);
//     return h;
//   }
//   private opts() { return { headers: this.buildHeaders() } as const; }

//   // ========= API calls =========
//   async askBot(payload: { message: string; images?: string[]; docs?: string[] }): Promise<string> {
//     const body: ChatJson = {
//       text: payload.message,
//       session_id: this.sessionId,
//       chat_id: this.chatId ?? undefined,
//     };

//     const res = await firstValueFrom(
//       this.http.post<ChatRes>(`${this.baseUrl}${this.chatPath}`, body, this.opts())
//         .pipe(timeout(30000), catchError(e => throwError(() => this.err(e))))
//     );

//     if (res?.chat_id) {
//       this.chatId = res.chat_id;
//       if (this.chatId) {
//         localStorage.setItem(this.LS_CHATID_PREFIX + this.sessionId, this.chatId);
//       }
//     }
//     return res?.text ?? '';
//   }

//   async transcribeAudio(blob: Blob, language = 'en'): Promise<string> {
//     const form = new FormData();
//     form.append('audio', blob, 'audio.webm');
//     form.append('language', language);

//     const res = await firstValueFrom(
//       this.http.post<STTRes>(`${this.baseUrl}${this.sttPath}`, form, this.opts())
//         .pipe(timeout(90000), catchError(e => throwError(() => this.err(e))))
//     );
//     return res?.text ?? '';
//   }

//   async voiceToVoice(blob: Blob, language = 'en', voice: 'male' | 'female' = 'male') {
//     const form = new FormData();
//     form.append('audio', blob, 'audio.webm');
//     form.append('language', language);
//     form.append('voice', voice);
//     form.append('session_id', this.sessionId);
//     if (this.chatId) form.append('chat_id', this.chatId);

//     const res = await firstValueFrom(
//       this.http.post<ConverseRes>(`${this.baseUrl}${this.conversePath}`, form, this.opts())
//         .pipe(timeout(120000), catchError(e => throwError(() => this.err(e))))
//     );

//     if (res?.chat_id) {
//       this.chatId = res.chat_id ?? this.chatId;
//       if (this.chatId) {
//         localStorage.setItem(this.LS_CHATID_PREFIX + this.sessionId, this.chatId);
//       }
//     }

//     return {
//       reply: res?.reply_text ?? '',
//       audioUrl: res?.audio_url || undefined,
//       transcript: res?.transcript ?? '',
//       durationSec: res?.duration_sec ?? 0
//     };
//   }

//   /** Upload Image -> unified /upload */
//   async uploadImage(file: File) {
//     return await this._uploadCommon(file, 'eng', true);
//   }
//   /** Upload Document -> unified /upload */
//   async uploadDocument(file: File) {
//     return await this._uploadCommon(file, 'eng', true);
//   }
//   private async _uploadCommon(file: File, ocrLang: string, ingestNow: boolean) {
//     const form = new FormData();
//     form.append('file', file, file.name);
//     form.append('ocr_language', ocrLang);
//     form.append('ingest_now', String(ingestNow));

//     const r = await firstValueFrom(
//       this.http.post<UploadRes>(`${this.baseUrl}${this.uploadPath}`, form, this.opts())
//         .pipe(timeout(60000), catchError(e => throwError(() => this.err(e))))
//     );

//     // Return the shape your component expects
//     return {
//       url: r.doc_id,
//       name: file.name,
//       sizeKB: Math.max(1, Math.round(file.size / 1024)),
//       mimeType: file.type || 'application/octet-stream',
//     };
//   }
//   async uploadManyImages(files: File[]) {
//     const urls: string[] = [];
//     for (const f of files) urls.push((await this.uploadImage(f)).url);
//     return urls;
//   }
//   async uploadManyDocs(files: File[]) {
//     const urls: string[] = [];
//     for (const f of files) urls.push((await this.uploadDocument(f)).url);
//     return urls;
//   }

//   async ingestRefresh(): Promise<{ status: string }> {
//     return await firstValueFrom(
//       this.http.post<{ status: string }>(`${this.baseUrl}${this.ingestRefreshPath}`, {}, this.opts())
//         .pipe(timeout(20000), catchError(e => throwError(() => this.err(e))))
//     );
//   }

//   async health(): Promise<{ status: string }> {
//     return await firstValueFrom(
//       this.http.get<{ status: string }>(`${this.baseUrl}${this.healthPath}`, this.opts())
//         .pipe(timeout(10000), catchError(e => throwError(() => this.err(e))))
//     );
//   }

//   // ===== Optional helpers so your component compiles =====
//   async ocrImage(_file: File): Promise<string> { return ''; } // backend does OCR in /upload
//   async docToText(_file: File): Promise<{ text?: string; pages?: string[] }> { return {}; }

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

//   // ===== Utilities =====
//   refreshWelcome(): { id: string; text: string; sender: 'bot'; createdAt: Date } {
//     return {
//       id: this.uuid(),
//       text: "Hello! Welcome to Tunningspot . I'm your virtual assistant. How can I help you today?",
//       sender: 'bot',
//       createdAt: new Date(),
//     };
//   }

//   private err(e: any): Error {
//     if (e instanceof HttpErrorResponse) {
//       const reqId = e.headers?.get?.('X-Request-Id') || e.error?.requestId;
//       const base =
//         (e.error && (e.error.detail || e.error.message || e.error.error)) ||
//         e.statusText ||
//         'Network error';
//       return new Error(reqId ? `${base} (ref: ${reqId})` : base);
//     }
//     return new Error((e && e.message) || 'Unexpected error');
//   }

//   private uuid(): string {
//     return (crypto as any)?.randomUUID?.()
//       ?? (Math.random().toString(36).slice(2) + Date.now().toString(36));
//   }
// }


// src/app/core/services/chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, catchError, timeout, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

// ===== Types (backend contracts) =====
type ChatJson    = { text: string; session_id: string; chat_id?: string | null; tts?: boolean; voice?: 'male' | 'female' };
type ChatRes     = { text: string; chat_id?: string | null; audio_url?: string | null };
type STTRes      = { text: string; duration_sec?: number };
type UploadRes   = { status: 'uploaded' | 'indexed'; doc_id: string; pages: number };
type ConverseRes = {
  transcript: string;
  reply_text: string;
  audio_url?: string | null;
  duration_sec: number;
  chat_id?: string | null;
};

@Injectable({ providedIn: 'root' })
export class ChatService {
  // ========= Configure here =========
  private readonly baseUrl = environment.apiBaseUrl; // e.g. 'http://192.168.29.120:8000'
  private readonly TIMEOUT_MS = 60000;               // baseline timeout like expected sample

  // Backend routes
  private readonly chatPath          = '/chat';
  private readonly ttsPath           = '/tts';
  private readonly sttPath           = '/stt';
  private readonly uploadPath        = '/upload';         // <— SAME URL used for image & document
  private readonly ingestRefreshPath = '/ingest/refresh';
  private readonly healthPath        = '/health';
  private readonly conversePath      = '/converse';

  // Legacy/optional endpoints your UI referenced
  private readonly historyPath       = '/chat/history';
  private readonly quickRepliesPath  = '/chat/quick-replies';

  // ========= Multi-session keys =========
  private readonly SS_CURRENT = 'CURRENT_SESSION_ID';    // per-tab current session
  private readonly LS_SESSIONS = 'SESSIONS_INDEX';       // [{id,label,createdAt}]
  private readonly LS_CHATID_PREFIX = 'CHAT_ID::';       // CHAT_ID::<sessionId>

  // Chat continuity for the current session
  private chatId: string | null = null;

  constructor(private http: HttpClient) {
    const sid = this.resolveInitialSessionId();
    this.setCurrentSessionInternal(sid);
  }

  // ========= Session core =========
  private resolveInitialSessionId(): string {
    const urlSid = new URLSearchParams(location.search).get('sid');
    if (urlSid) {
      this.ensureSessionIndexed(urlSid, '(from-url)');
      sessionStorage.setItem(this.SS_CURRENT, urlSid);
      return urlSid;
    }
    const existing = sessionStorage.getItem(this.SS_CURRENT);
    if (existing) return existing;
    const created = this.createSessionId();
    this.ensureSessionIndexed(created, 'Tab Session');
    sessionStorage.setItem(this.SS_CURRENT, created);
    return created;
  }

  private createSessionId(): string {
    return (crypto as any)?.randomUUID?.()
      ?? (Math.random().toString(36).slice(2) + Date.now().toString(36));
  }

  private readIndex(): Array<{ id: string; label: string; createdAt: string }> {
    try { return JSON.parse(localStorage.getItem(this.LS_SESSIONS) || '[]'); } catch { return []; }
  }
  private writeIndex(list: Array<{ id: string; label: string; createdAt: string }>) {
    localStorage.setItem(this.LS_SESSIONS, JSON.stringify(list));
  }
  private ensureSessionIndexed(id: string, label = '') {
    const idx = this.readIndex();
    if (!idx.some(s => s.id === id)) {
      idx.push({ id, label, createdAt: new Date().toISOString() });
      this.writeIndex(idx);
    }
  }

  get sessionId(): string {
    return sessionStorage.getItem(this.SS_CURRENT)!;
  }

  private setCurrentSessionInternal(id: string) {
    sessionStorage.setItem(this.SS_CURRENT, id);
    const stored = localStorage.getItem(this.LS_CHATID_PREFIX + id);
    this.chatId = stored || null;
  }

  // ========= Public session API (optional UI) =========
  public newSession(label = 'Session'): string {
    const id = this.createSessionId();
    this.ensureSessionIndexed(id, label);
    this.setCurrentSessionInternal(id);
    return id;
  }
  public useSession(id: string): boolean {
    const found = this.readIndex().some(s => s.id === id);
    if (!found) return false;
    this.setCurrentSessionInternal(id);
    return true;
  }
  public listSessions() { return this.readIndex(); }
  public currentSession() {
    const id = this.sessionId;
    return this.readIndex().find(s => s.id === id) ?? { id, label: '(current)', createdAt: '' };
  }
  public deleteSession(id: string) {
    const left = this.readIndex().filter(s => s.id !== id);
    this.writeIndex(left);
    localStorage.removeItem(this.LS_CHATID_PREFIX + id);
    if (this.sessionId === id) {
      const fresh = this.newSession('Session');
      this.setCurrentSessionInternal(fresh);
    }
  }

  // ========= Headers / opts =========
  private buildHeaders(): HttpHeaders {
    let h = new HttpHeaders({ Accept: 'application/json' });
    const token =
      environment.backendApiKey ||
      localStorage.getItem('BACKEND_API_TOKEN') ||
      localStorage.getItem('access_token');
    if (token) h = h.set('Authorization', `Bearer ${token}`);
    return h;
  }
  private opts() { return { headers: this.buildHeaders() } as const; }

  // ========= EXPECTED RAW API (added & aligned with backend spec) =========

  /** GET /health — backend status check */
  async checkHealth(): Promise<any> {
    return await firstValueFrom(
      this.http.get(`${this.baseUrl}${this.healthPath}`, this.opts())
        .pipe(timeout(this.TIMEOUT_MS), catchError(e => throwError(() => this.err(e))))
    );
  }

  /** POST /chat — send text to LLM (JSON body) */
  async sendChat(text: string, sessionId: string, chatId?: string | null): Promise<{ text: string; chat_id?: string }> {
    const body = { text, session_id: sessionId, chat_id: chatId ?? null } as ChatJson;
    return await firstValueFrom(
      this.http.post<{ text: string; chat_id?: string }>(`${this.baseUrl}${this.chatPath}`, body, this.opts())
        .pipe(timeout(this.TIMEOUT_MS), catchError(e => throwError(() => this.err(e))))
    );
  }

  /** POST /upload — document upload + OCR (FormData). Same URL used for images too. */
  async uploadDocumentRaw(file: File, language = 'eng'): Promise<UploadRes> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('ocr_language', language);
    // optional hint for backend (safe to remove if unused):
    form.append('kind', 'document');
    return await firstValueFrom(
      this.http.post<UploadRes>(`${this.baseUrl}${this.uploadPath}`, form, this.opts())
        .pipe(timeout(this.TIMEOUT_MS), catchError(e => throwError(() => this.err(e))))
    );
  }

  /** POST /upload — image upload + OCR (FormData). SAME URL, separate method for UI clarity. */
  async uploadImageRaw(file: File, language = 'eng'): Promise<UploadRes> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('ocr_language', language);
    // optional hint for backend (safe to remove if unused):
    form.append('kind', 'image');
    return await firstValueFrom(
      this.http.post<UploadRes>(`${this.baseUrl}${this.uploadPath}`, form, this.opts())
        .pipe(timeout(this.TIMEOUT_MS), catchError(e => throwError(() => this.err(e))))
    );
  }

  /** POST /stt — voice → text (FormData) */
  async sendVoiceForSTT(audioBlob: Blob, sessionId: string, chatId?: string | null, language = 'en'): Promise<{ text: string }> {
    const form = new FormData();
    form.append('audio', audioBlob, 'recording.webm');
    form.append('language', language);
    form.append('session_id', sessionId);
    if (chatId) form.append('chat_id', chatId);
    const res = await firstValueFrom(
      this.http.post<STTRes>(`${this.baseUrl}${this.sttPath}`, form, this.opts())
        .pipe(timeout(this.TIMEOUT_MS), catchError(e => throwError(() => this.err(e))))
    );
    return { text: res?.text ?? '' };
  }

  /** POST /converse — voice → text → RAG → voice (FormData) */
  async converse(
    audioBlob: Blob,
    sessionId: string,
    chatId?: string | null,
    language = 'en',
    voice: 'male' | 'female' = 'male'
  ): Promise<ConverseRes> {
    const form = new FormData();
    form.append('audio', audioBlob, 'audio.webm'); // keeping your client filename
    form.append('language', language);
    form.append('voice', voice);
    form.append('session_id', sessionId);
    if (chatId) form.append('chat_id', chatId);
    return await firstValueFrom(
      this.http.post<ConverseRes>(`${this.baseUrl}${this.conversePath}`, form, this.opts())
        .pipe(timeout(120000), catchError(e => throwError(() => this.err(e)))) // converse may take longer
    );
  }

  // ========= Your existing API (kept), now mapped to expected where needed =========

  /** Keeps your UI stable; internally calls expected /chat */
  async askBot(payload: { message: string; images?: string[]; docs?: string[] }): Promise<string> {
    const res = await this.sendChat(payload.message, this.sessionId, this.chatId);
    if (res?.chat_id) {
      this.chatId = res.chat_id;
      if (this.chatId) localStorage.setItem(this.LS_CHATID_PREFIX + this.sessionId, this.chatId);
    }
    return res?.text ?? '';
  }

  /** Keeps UI name; now sends session_id/chat_id to /stt via sendVoiceForSTT */
  async transcribeAudio(blob: Blob, language = 'en'): Promise<string> {
    const res = await this.sendVoiceForSTT(blob, this.sessionId, this.chatId, language);
    return res.text ?? '';
  }

  /** Keeps UI name; now calls /converse and adapts shape */
  async voiceToVoice(blob: Blob, language = 'en', voice: 'male' | 'female' = 'male') {
    const res = await this.converse(blob, this.sessionId, this.chatId, language, voice);
    if (res?.chat_id) {
      this.chatId = res.chat_id ?? this.chatId;
      if (this.chatId) localStorage.setItem(this.LS_CHATID_PREFIX + this.sessionId, this.chatId);
    }
    return {
      reply:       res?.reply_text ?? '',
      audioUrl:    res?.audio_url || undefined,
      transcript:  res?.transcript ?? '',
      durationSec: res?.duration_sec ?? 0
    };
  }

  /** UI-friendly uploads (returning normalized shape) — BOTH hit the SAME /upload URL */
  async uploadImage(file: File) {
    return await this._uploadCommon(file, 'eng', true, 'image');
  }
  async uploadDocument(file: File) {
    return await this._uploadCommon(file, 'eng', true, 'document');
  }

  private async _uploadCommon(file: File, ocrLang: string, ingestNow: boolean, kind: 'image' | 'document') {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('ocr_language', ocrLang);
    form.append('ingest_now', String(ingestNow));
    // optional hint for backend:
    form.append('kind', kind);

    const r = await firstValueFrom(
      this.http.post<UploadRes>(`${this.baseUrl}${this.uploadPath}`, form, this.opts())
        .pipe(timeout(this.TIMEOUT_MS), catchError(e => throwError(() => this.err(e))))
    );

    // Return the shape your component expects
    return {
      url: r.doc_id,
      name: file.name,
      sizeKB: Math.max(1, Math.round(file.size / 1024)),
      mimeType: file.type || 'application/octet-stream',
    };
    // If you want the raw backend shape instead, call uploadImageRaw/uploadDocumentRaw
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

  // ========= Extras you already had =========
  async ingestRefresh(): Promise<{ status: string }> {
    return await firstValueFrom(
      this.http.post<{ status: string }>(`${this.baseUrl}${this.ingestRefreshPath}`, {}, this.opts())
        .pipe(timeout(20000), catchError(e => throwError(() => this.err(e))))
    );
  }

  async health(): Promise<{ status: string }> {
    return await firstValueFrom(
      this.http.get<{ status: string }>(`${this.baseUrl}${this.healthPath}`, this.opts())
        .pipe(timeout(10000), catchError(e => throwError(() => this.err(e))))
    );
  }

  // ===== Optional helpers so your component compiles =====
  async ocrImage(_file: File): Promise<string> { return ''; } // backend does OCR in /upload
  async docToText(_file: File): Promise<{ text?: string; pages?: string[] }> { return {}; }

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

  // ===== Utilities =====
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
    return (crypto as any)?.randomUUID?.()
      ?? (Math.random().toString(36).slice(2) + Date.now().toString(36));
  }
}
