import { AfterViewInit, Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { AnimationOptions } from 'ngx-lottie';
import type { AnimationItem } from 'lottie-web';
import { ChatService } from './core/services/chat.service';
import { environment } from 'src/environments/environment';


type Sender = 'user' | 'bot' | 'system' | 'typing';

interface MsgImage { url: string; thumbUrl?: string; name: string; sizeKB: number; }
interface MsgDoc   { url: string; name: string; sizeKB: number; }
interface Message  {
  id: string; text?: string | null; sender: Sender; createdAt: Date;
  images?: MsgImage[]; docs?: MsgDoc[];
}

declare global {
  interface Window { webkitSpeechRecognition?: any; SpeechRecognition?: any; }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  constructor(private chatApi: ChatService) {}

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('imgInput') imgInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('docInput') docInputRef!: ElementRef<HTMLInputElement>;

  // ===== General state =====
  title = 'Frontend';
  isSending = false;
  private lastQuickAt = 0;

  private readonly MAX_MB = 25;
  private readonly MAX_FILES = 5;
  private readonly ALLOWED_IMG = ['image/png','image/jpeg','image/webp'];
  private readonly ALLOWED_DOC = [
    'application/pdf','text/plain','text/markdown',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  private readonly BLOCKED_EXT = ['exe','bat','cmd','sh','js','msi','apk','com','scr','pif','jar','vbs','ps1','zip','rar','7z','tar','gz'];

  text = '';
  attachCount = 0;

  messages: Message[] = [
    { id: this.uuid(), text: "Hello! Welcome to Tunningspot. I'm your virtual assistant. How can I help you today?", sender: 'bot', createdAt: new Date() }
  ];

  userTyping = false;
  private userTypingTimer: any = null;

  isAttachOpen = false;
  pendingPick: 'images' | 'docs' | null = null;
  imagesSelected: File[] = [];
  docsSelected: File[] = [];
  ttsEnabled = false;

  imagePreviews: { url: string; name: string; sizeKB: number }[] = [];
  docPreviews:   { url: string; name: string; ext: string; sizeKB: number }[] = [];

  // ===== Composer recorder (separate from overlay PTT) =====
  isRecording = false;
  isRecUI = false;
  private audioStream?: MediaStream;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  lastAudioUrl: string | null = null;

  // Composer STT (browser)
  recognition?: any;
  sttSupported = false;
  sttLang = 'en-IN';
  interimTranscript = '';
  finalTranscript = '';

  recStartMs = 0;
  recElapsedMs = 0;
  private recTimerId: any = null;

  waveBars = new Array(14);
  chatOpen = true;

  robotOpts: AnimationOptions = { path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true } as const;
  searchToolOpts: AnimationOptions = { path: 'assets/lottie/search.json', renderer: 'svg', autoplay: true, loop: true } as const;
  botAvatarOpts: AnimationOptions = { path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true } as const;
  botTypingOpts: AnimationOptions = { path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true } as const;
  brandLottieOpts: AnimationOptions = { path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true } as const;

  /* ========================= Voice-to-Voice Overlay (PTT ONLY) ========================= */
  showVoiceOverlay = false;
  isSpeaking = false;

  // PTT recording (server-side STT+TTS via /converse)
  private pttStream?: MediaStream;
  private pttRecorder?: MediaRecorder;
  private pttChunks: Blob[] = [];
  isPTTActive = false;
  processingPTT = false;
  private lastPTTAudio?: HTMLAudioElement;

  selectedGender: 'male' | 'female' = 'female';
  allVoices: SpeechSynthesisVoice[] = [];
  femaleVoice: SpeechSynthesisVoice | null = null;
  maleVoice: SpeechSynthesisVoice | null = null;
  private currentUtterance?: SpeechSynthesisUtterance;

  ngAfterViewInit(): void { this.scrollCanvasToBottom(); }
  ngOnDestroy(): void {
    this.revokeImagePreviews();
    this.revokeDocPreviews();
    if (this.lastAudioUrl) { try { URL.revokeObjectURL(this.lastAudioUrl); } catch {} }
    this.teardownOverlayAudio();
  }

  onBrandAnimCreated(anim: AnimationItem) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) anim.pause();
  }
  onClose(): void { this.chatOpen = false; }

  // ===== Header actions =====
  onRefresh(): void {
    this.messages = [{
      id: this.uuid(),
      text: "Hi! I’m online—ask me anything.",
      sender: 'system',
      createdAt: new Date()
    }];
    this.userTyping = false; this.text = '';
    this.lastAudioUrl = null; this.imagesSelected = []; this.docsSelected = [];
    this.ttsEnabled = false; this.isAttachOpen = false;
    this.revokeImagePreviews(); this.revokeDocPreviews(); this.scrollCanvasToBottom();
  }

  // ===== Attach popover =====
  toggleAttachMenu(): void { this.isAttachOpen = !this.isAttachOpen; }
  closeAttachMenu(): void { this.isAttachOpen = false; }
  pickImages(): void { this.pendingPick = 'images'; this.imgInputRef?.nativeElement?.click(); }
  pickDocs(): void {
    this.pendingPick = 'docs';
    if (this.docInputRef?.nativeElement) {
      this.docInputRef.nativeElement.accept = '.pdf,.doc,.docx,.txt,.md,.xls,.xlsx';
      this.docInputRef.nativeElement.click();
    }
  }
  enableTTS(): void { this.ttsEnabled = true; this.closeAttachMenu(); }
  disableTTS(): void { this.ttsEnabled = false; }
  clearImages(): void { this.revokeImagePreviews(); this.imagesSelected = []; }
  clearDocs(): void { this.revokeDocPreviews(); this.docsSelected = []; }

  // ===== Files =====
  private isBlocked(name: string) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    return this.BLOCKED_EXT.includes(ext);
  }
  private validateFile(file: File, allowed: string[]) {
    const okType = allowed.includes(file.type);
    const okSize = file.size <= this.MAX_MB * 1024 * 1024;
    return okType && okSize && !this.isBlocked(file.name);
  }
  public onImagesSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    let files = Array.from(input.files ?? []);
    if (files.length > this.MAX_FILES) files = files.slice(0, this.MAX_FILES);
    const good = files.filter(f => this.validateFile(f, this.ALLOWED_IMG));
    if (good.length !== files.length) alert('Some images were blocked (type/size).');
    this.imagesSelected = good; this.buildImagePreviews(good); this.isAttachOpen = false; input.value = '';
  }
  public onDocsSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    let files = Array.from(input.files ?? []);
    if (files.length > this.MAX_FILES) files = files.slice(0, this.MAX_FILES);
    const good = files.filter(f => this.validateFile(f, this.ALLOWED_DOC));
    if (good.length !== files.length) alert('Some documents were blocked (type/size).');
    this.docsSelected = good; this.buildDocPreviews(good); this.isAttachOpen = false; input.value = '';
  }
  private buildImagePreviews(files: File[]) {
    this.revokeImagePreviews();
    this.imagePreviews = files.map(f => ({ url: URL.createObjectURL(f), name: f.name, sizeKB: Math.max(1, Math.round(f.size / 1024)) }));
  }
  private revokeImagePreviews() { for (const p of this.imagePreviews) { try { URL.revokeObjectURL(p.url); } catch {} } this.imagePreviews = []; }
  private buildDocPreviews(files: File[]) {
    this.revokeDocPreviews();
    this.docPreviews = files.map(f => ({ url: URL.createObjectURL(f), name: f.name, ext: (f.name.split('.').pop() || '').toLowerCase(), sizeKB: Math.max(1, Math.round(f.size / 1024)) }));
  }
  private revokeDocPreviews() { for (const d of this.docPreviews) { try { URL.revokeObjectURL(d.url); } catch {} } this.docPreviews = []; }

  // ===== remove buttons used by template =====
  removeImage(idx: number): void {
    const p = this.imagePreviews[idx];
    try { URL.revokeObjectURL(p.url); } catch {}
    this.imagePreviews.splice(idx, 1);
    this.imagesSelected.splice(idx, 1);
  }
  removeDoc(idx: number): void {
    const d = this.docPreviews[idx];
    try { URL.revokeObjectURL(d.url); } catch {}
    this.docPreviews.splice(idx, 1);
    this.docsSelected.splice(idx, 1);
  }

  // ===== Composer mic (local STT) =====
  async onMicClick() { if (!this.isRecUI) await this.startRecordingUI(); }
  private async startRecordingUI() {
    try { this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { alert('Microphone permission denied or unsupported.'); return; }

    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(this.audioStream);
    this.mediaRecorder.ondataavailable = (ev) => { if (ev.data.size > 0) this.audioChunks.push(ev.data); };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.lastAudioUrl = URL.createObjectURL(blob);
      this.audioStream?.getTracks().forEach(t => t.stop());
      this.audioStream = undefined; this.isRecording = false;
    };
    this.mediaRecorder.start();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.sttSupported = !!SR;
    if (this.sttSupported) {
      this.recognition = new SR();
      this.recognition.lang = this.sttLang;
      this.recognition.interimResults = true;
      this.recognition.continuous = true;
      this.recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) this.finalTranscript += res[0].transcript + ' ';
          else interim += res[0].transcript;
        }
        this.interimTranscript = interim.trim();
      };
      this.recognition.onerror = () => {};
      this.recognition.onend = () => { if (this.isRecUI) { try { this.recognition.start(); } catch {} } };
      try { this.recognition.start(); } catch {}
    }

    this.isRecUI = true; this.isRecording = true;
    this.interimTranscript = ''; this.finalTranscript = '';
    this.recStartMs = Date.now(); this.recElapsedMs = 0;

    this.recTimerId = setInterval(() => {
      this.recElapsedMs = Date.now() - this.recStartMs;
      if (this.recElapsedMs > 60000) this.confirmRecording();
    }, 250);
  }
  cancelRecording() {
    try { this.recognition?.stop(); } catch {}
    this.recognition = undefined;
    try { this.mediaRecorder?.stop(); } catch {}
    this.mediaRecorder = undefined;
    if (this.lastAudioUrl) { URL.revokeObjectURL(this.lastAudioUrl); this.lastAudioUrl = null; }
    if (this.recTimerId) { clearInterval(this.recTimerId); this.recTimerId = null; }
    this.isRecUI = false; this.isRecording = false;
    this.interimTranscript = ''; this.finalTranscript = ''; this.recElapsedMs = 0;
  }
  confirmRecording() {
    try { this.recognition?.stop(); } catch {}
    this.recognition = undefined;
    try { this.mediaRecorder?.stop(); } catch {}
    this.mediaRecorder = undefined;
    if (this.recTimerId) { clearInterval(this.recTimerId); this.recTimerId = null; }
    this.isRecUI = false; this.isRecording = false;

    const textOut = (this.finalTranscript || this.interimTranscript || '').trim();
    this.text = textOut; this.interimTranscript = ''; this.finalTranscript = ''; this.recElapsedMs = 0;
  }
  get recElapsedLabel(): string {
    const s = Math.floor(this.recElapsedMs / 1000); const m = Math.floor(s / 60);
    const sec = (s % 60).toString().padStart(2, '0'); return `${m}:${sec}`;
  }

  // ===== Quick replies =====
  async sendQuick(raw: string): Promise<void> {
    if (Date.now() - this.lastQuickAt < 500) return;
    this.lastQuickAt = Date.now();

    const msg = (raw || '').trim(); if (!msg) return;
    this.push({ id: this.uuid(), text: msg, sender: 'user', createdAt: new Date() });

    if (!this.showVoiceOverlay) this.showBotTyping();
    try {
      // Call real /chat
      const chatRes = await this.chatApi.chat(msg, []);
      const reply = chatRes?.text || '(no reply)';
      if (!this.showVoiceOverlay) this.hideBotTyping();
      this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });
      this.maybeSpeak(reply);
    } catch (e: any) {
      if (!this.showVoiceOverlay) this.hideBotTyping();
      this.push({ id: this.uuid(), text: e?.message || 'Failed to get reply.', sender: 'bot', createdAt: new Date() });
    }
  }

  onUserTyping(): void {
    this.userTyping = true;
    if (this.userTypingTimer) clearTimeout(this.userTypingTimer);
    this.userTypingTimer = setTimeout(() => { this.userTyping = false; }, 800);
  }
  stopUserTyping(immediate = false): void {
    if (this.userTypingTimer) { clearTimeout(this.userTypingTimer); this.userTypingTimer = null; }
    if (immediate) this.userTyping = false;
  }

  // ===== Send message (text + attachments) =====
  async send() {
    if (this.isSending) return;

    const trimmed = this.text.trim();
    const hasImages = this.imagesSelected.length > 0;
    const hasDocs   = this.docsSelected.length   > 0;
    const hasText   = !!trimmed;
    if (!hasText && !hasImages && !hasDocs) return;

    this.isSending = true;
    let typingShown = false;

    try {
      if (this.isRecUI) this.cancelRecording();
      this.stopUserTyping(true);

      // show user's message immediately
      const images = this.imagePreviews.map(p => ({ url: p.url, thumbUrl: p.url, name: p.name, sizeKB: p.sizeKB }));
      const docs   = this.docPreviews.map(d => ({ url: d.url, name: d.name, sizeKB: d.sizeKB }));
      this.push({
        id: this.uuid(),
        text: hasText ? trimmed : null,
        images: images.length ? images : undefined,
        docs:   docs.length   ? docs   : undefined,
        sender: 'user',
        createdAt: new Date()
      });

      // show typing before uploads
      if (!this.showVoiceOverlay) { this.showBotTyping(); typingShown = true; }

      // copy files & clear UI state for the composer
      const imageFiles = [...this.imagesSelected];
      const docFiles   = [...this.docsSelected];
      this.text = '';
      this.attachCount = 0;
      this.isAttachOpen = false;
      this.imagesSelected = [];
      this.docsSelected = [];
      this.imagePreviews = [];
      this.docPreviews = [];

      // 1) Upload selected files -> collect doc_ids
      const docIds = await this.uploadSelectedFilesAndGetDocIds(imageFiles, docFiles);

      // 2) Ask the bot with optional doc_ids
      const chatRes = await this.chatApi.chat(hasText ? trimmed : '', docIds);
      const reply = (chatRes?.text ?? (chatRes as any)) || '(no reply)';

      // render bot reply
      if (typingShown) this.hideBotTyping();
      typingShown = false;
      this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });
      this.maybeSpeak(reply);
    } catch (e: any) {
      if (typingShown) this.hideBotTyping();
      this.push({ id: this.uuid(), text: e?.message || 'Failed to get reply.', sender: 'bot', createdAt: new Date() });
    } finally {
      this.isSending = false;
    }
  }

  // ===== Helpers =====
  public get imgCount(): number { return this.imagePreviews.length; }
  public get docCount(): number { return this.docPreviews.length; }

  public get showAttachMenu(): boolean { return this.isAttachOpen; }
  public set showAttachMenu(v: boolean) { this.isAttachOpen = v; }

  private push(m: Message) { this.messages = [...this.messages, m]; this.scrollCanvasToBottom(); }
  private showBotTyping() {
    if (this.showVoiceOverlay) return; // suppress during overlay
    if (!this.messages.some(x => x.sender === 'typing')) {
      this.messages = [...this.messages, { id: 'typing', text: 'typing', sender: 'typing', createdAt: new Date() }];
    }
    this.scrollCanvasToBottom();
  }
  private hideBotTyping() { this.messages = this.messages.filter(m => m.sender !== 'typing'); }
  private scrollCanvasToBottom() {
    setTimeout(() => {
      const el = this.canvasRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  openImage(img: MsgImage) { try { window.open(img.url, '_blank'); } catch {} }
  private maybeSpeak(reply: string) {
    if (this.ttsEnabled && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(reply);
      u.lang = 'en-IN';
      window.speechSynthesis.speak(u);
    }
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  
  /* ========================= Overlay open/close (PTT only) ========================= */
  openVoiceOverlay() {
    this.closeAttachMenu();
    this.showVoiceOverlay = true;
    this.hideBotTyping();
    this.loadVoices();
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.teardownOverlayAudio();
  }
  closeVoiceOverlay() {
    this.teardownOverlayAudio();
    this.showVoiceOverlay = false;
  }
  private teardownOverlayAudio() {
    // this.stopSpeaking();
    this.stopAnyPlayback();
    try { this.pttRecorder?.stop(); } catch {}
    this.pttRecorder = undefined;
    try { this.pttStream?.getTracks().forEach(t => t.stop()); } catch {}
    this.pttStream = undefined;
    this.pttChunks = [];
    this.isPTTActive = false;
    this.isRecording = false;
  }

  setGender(g: 'male' | 'female') { this.selectedGender = g; }

  loadVoices() {
    try {
      const synth = window.speechSynthesis;
      const pick = () => {
        this.allVoices = synth.getVoices() || [];
        const en = this.allVoices.filter(v => /en[-_]/i.test(v.lang));
        const fallback = this.allVoices[0] ?? null;
        this.femaleVoice = (en.find(v => /female|woman|salli|joanna|olivia|natalie/i.test(v.name)) ?? en[0] ?? fallback);
        this.maleVoice   = (en.find(v => /male|man|matthew|joey|brian|adam|david/i.test(v.name)) ?? en[1] ?? this.allVoices[1] ?? this.femaleVoice ?? fallback);
      };
      pick();
      if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = () => pick();
    } catch {}
  }

  private speak(text: string) {
    if (!text) return;
    this.stopSpeaking();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1; utter.pitch = 1; utter.volume = 1;
    const chosen = this.selectedGender === 'female' ? this.femaleVoice : this.maleVoice;
    utter.voice = chosen ?? null;

    utter.onstart = () => { this.isSpeaking = true; };
    const finish = () => { this.isSpeaking = false; this.currentUtterance = undefined; };
    utter.onend = finish;
    utter.onerror = finish;

    this.currentUtterance = utter;
    window.speechSynthesis.speak(utter);
  }
  private stopSpeaking() {
    try { if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel(); } catch {}
    this.isSpeaking = false; this.currentUtterance = undefined;
  }

// audio refresh
private stopAnyPlayback() {
  // stop browser TTS
  this.stopSpeaking();

  // stop server audio element (mp3) if it’s playing
  try {
    if (this.lastPTTAudio) {
      this.lastPTTAudio.pause();
      this.lastPTTAudio.currentTime = 0;
      this.lastPTTAudio = undefined;
    }
  } catch {}
}





  

  // -------------------- PUSH-TO-TALK (overlay mic button ONLY) --------------------
  async startPTT() {
    if (!this.showVoiceOverlay) return;
    // if (this.isSpeaking) this.stopAnyPlayback();
     this.stopAnyPlayback();

    try {
      this.pttStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.push({ id: this.uuid(), text: 'Microphone permission denied or unsupported.', sender: 'system', createdAt: new Date() });
      return;
    }

    this.pttChunks = [];
    try {
      this.pttRecorder = new MediaRecorder(this.pttStream);
    } catch {
      this.push({ id: this.uuid(), text: 'MediaRecorder is not supported in this browser.', sender: 'system', createdAt: new Date() });
      try { this.pttStream.getTracks().forEach(t => t.stop()); } catch {}
      this.pttStream = undefined;
      return;
    }

    this.pttRecorder.ondataavailable = (ev) => { if (ev.data.size > 0) this.pttChunks.push(ev.data); };
    this.pttRecorder.onstop = () => { /* blob consumed in stopPTT */ };

    this.isPTTActive = true;
    this.isRecording = true;
    try { this.pttRecorder.start(); } catch {}
  }

  /** stopPTT(true) => send to backend & play AI audio; stopPTT(false) => just stop */
  async stopPTT(confirm: boolean) {
    if (!this.isPTTActive) return;

    try { this.pttRecorder?.stop(); } catch {}
    this.isPTTActive = false;
    this.isRecording = false;

    await new Promise(r => setTimeout(r, 10));

    const tracks = this.pttStream?.getTracks() || [];
    tracks.forEach(t => { try { t.stop(); } catch {} });
    this.pttStream = undefined;

    if (!confirm) { this.pttChunks = []; return; }
    if (!this.pttChunks.length) { this.speak('I did not catch that.'); return; }

    const audioBlob = new Blob(this.pttChunks, { type: 'audio/webm' });
    this.pttChunks = [];
    this.processingPTT = true;

    try {
      // Call backend /converse
      const res = await this.chatApi.converse(audioBlob, this.selectedGender /*, [] if you want to pass doc_ids */);

      if (res.transcript) {
        this.push({ id: this.uuid(), text: res.transcript, sender: 'user', createdAt: new Date() });
      }
      this.push({ id: this.uuid(), text: res.reply_text || '(no reply)', sender: 'bot', createdAt: new Date() });

      // const playUrl = this.absoluteUrl(res.audio_url);
      const playUrl = res.audio_url || null;  // <-- no double prefix
      if (playUrl) {
        try { this.lastPTTAudio?.pause(); } catch {}
        this.lastPTTAudio = new Audio(playUrl);
        try { await this.lastPTTAudio.play(); } catch {}
      } else {
        this.speak(res.reply_text || '');
      }
    } catch (e: any) {
      const reason = e?.message || 'Voice processing failed.';
      this.push({ id: this.uuid(), text: `Voice error: ${reason}`, sender: 'system', createdAt: new Date() });
      this.speak('Sorry, I could not process your voice.');
    } finally {
      this.processingPTT = false;
    }
  }
  cancelPTT() { this.stopPTT(false); }
  // ---------------------------------------------------------------------------

  private absoluteUrl(path?: string | null): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    const base = environment.apiBaseUrl.replace(/\/+$/, '');
    const rel  = path.startsWith('/') ? path : '/' + path;
    return `${base}${rel}`;
  }

  // ===== template aliases =====
  get interimText(): string { return this.interimTranscript; } set interimText(v: string) { this.interimTranscript = v; }
  get finalText(): string { return this.finalTranscript; }   set finalText(v: string) { this.finalTranscript = v; }

  // ===================== Helpers to integrate uploads =====================
  /** Upload all selected files and collect doc_ids from the backend */
  private async uploadSelectedFilesAndGetDocIds(imageFiles: File[], docFiles: File[]): Promise<string[]> {
    const docIds: string[] = [];

    const uploadOne = async (f: File) => {
      if (!f) return;
      try {
        const res = await this.chatApi.uploadFile(f); // POST /upload
        if (res?.doc_id) docIds.push(res.doc_id);
        console.log('[upload] OK', f.name, '->', res?.doc_id);
      } catch (e) {
        console.warn('[upload] FAIL', f?.name, e);
      }
    };

    for (const f of imageFiles) await uploadOne(f);
    for (const f of docFiles)   await uploadOne(f);

    return docIds;
  }
}



