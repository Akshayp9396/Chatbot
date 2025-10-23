


import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, catchError, timeout, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

// ================== TypeScript Types for Your API ==================
// These interfaces match the Pydantic models in your FastAPI backend.

export interface ChatRequest {
  text: string;
  session_id: string;
  chat_id?: string | null;
  doc_ids?: string[] | null;
}

export interface ChatResponse {
  text: string;
  chat_id?: string | null;
}

export interface UploadResponse {
  status: 'uploaded';
  doc_id: string;
  pages: number;
}

export interface STTResponse {
  text: string;
}

export interface ConverseResponse {
  transcript: string;
  reply_text: string;
  audio_url: string;
  duration_sec: number;
  chat_id?: string | null;
}

// ===================================================================

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly baseUrl = environment.apiBaseUrl; // e.g., 'http://100.x.x.x:8000'

  // --- API Paths (matching your FastAPI app.py) ---
  private readonly healthPath   = '/health';
  private readonly chatPath     = '/chat';
  private readonly uploadPath   = '/upload';
  private readonly sttPath      = '/stt';
  private readonly conversePath = '/converse';

  constructor(private http: HttpClient) {
    if (!this.baseUrl) {
      console.error('CRITICAL: `apiBaseUrl` is not set in your environment.ts file. The chat service will not work.');
      throw new Error('ChatService: `apiBaseUrl` is not configured.');
    }
  }

  /**
   * Automatically gets the session ID from localStorage or generates a new one.
   */
  private get sessionId(): string {
    const KEY = 'TUNNINGSPOT_SESSION_ID';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `sess-${crypto.randomUUID()}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  /**
   * Builds the headers for JSON requests.
   */
  private getJsonHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 
      'Accept': 'application/json',
      'Content-Type': 'application/json' // Explicitly set for JSON
    });
    const token = environment.backendApiKey;
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * MODIFICATION: Builds headers for FormData requests.
   * Critically, this does NOT set Content-Type, allowing the browser to set it automatically.
   */
  private getFormDataHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Accept': 'application/json'
    });
    const token = environment.backendApiKey;
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }


  // ================== API Methods ==================

  /**
   * Checks if the backend server is running.
   */
  async health(): Promise<{ status: string }> {
    return await firstValueFrom(
      this.http.get<{ status: string }>(`${this.baseUrl}${this.healthPath}`)
        .pipe(timeout(5000), catchError(e => throwError(() => this.formatError(e))))
    );
  }

  /**
   * Sends a text message to the chatbot and gets a text response.
   */
  async chat(message: string, docIds: string[] = []): Promise<ChatResponse> {
    const payload: ChatRequest = {
      text: message,
      session_id: this.sessionId,
      doc_ids: docIds.length > 0 ? docIds : undefined,
    };
    // MODIFICATION: Use JSON-specific headers.
    return await firstValueFrom(
      this.http.post<ChatResponse>(`${this.baseUrl}${this.chatPath}`, payload, { headers: this.getJsonHeaders() })
        .pipe(timeout(60000), catchError(e => throwError(() => this.formatError(e))))
    );
  }

  /**
   * Uploads a file (PDF, DOCX, image, etc.) to the server for OCR.
   */
  async uploadFile(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    // MODIFICATION: Use FormData-specific headers.
    return await firstValueFrom(
      this.http.post<UploadResponse>(`${this.baseUrl}${this.uploadPath}`, formData, { headers: this.getFormDataHeaders() })
        .pipe(timeout(120000), catchError(e => throwError(() => this.formatError(e))))
    );
  }

  /**
   * Sends recorded audio and gets a text-only response from the AI.
   */
  async stt(audioBlob: Blob, docIds: string[] = []): Promise<STTResponse> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('session_id', this.sessionId);
    docIds.forEach(id => formData.append('doc_ids', id));

    // MODIFICATION: Use FormData-specific headers.
    return await firstValueFrom(
      this.http.post<STTResponse>(`${this.baseUrl}${this.sttPath}`, formData, { headers: this.getFormDataHeaders() })
        .pipe(timeout(90000), catchError(e => throwError(() => this.formatError(e))))
    );
  }

  /**
   * Sends recorded audio and gets a full conversational response (text + speech).
   */
  async converse(audioBlob: Blob, voice: 'male' | 'female', docIds: string[] = []): Promise<ConverseResponse> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('session_id', this.sessionId);
    formData.append('voice', voice);
    docIds.forEach(id => formData.append('doc_ids', id));

    // MODIFICATION: Use FormData-specific headers.
    const response = await firstValueFrom(
      this.http.post<ConverseResponse>(`${this.baseUrl}${this.conversePath}`, formData, { headers: this.getFormDataHeaders() })
        .pipe(timeout(120000), catchError(e => throwError(() => this.formatError(e))))
    );

    if (response.audio_url) {
      response.audio_url = this.baseUrl + response.audio_url;
    }
    return response;
  }

  // ================== Error Handling ==================

  private formatError(e: any): Error {
    if (e instanceof HttpErrorResponse) {
      const errorDetail = e.error?.detail || e.statusText;
      return new Error(`API Error: ${errorDetail} (Status: ${e.status})`);
    }
    return new Error('An unexpected error occurred.');
  }
}
