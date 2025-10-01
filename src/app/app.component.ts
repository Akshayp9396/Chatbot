// import { AfterViewInit, Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
// import { AnimationOptions } from 'ngx-lottie';
// import type { AnimationItem } from 'lottie-web';
// import { ChatService } from './core/services/chat.service';

// type Sender = 'user' | 'bot' | 'system' | 'typing';

// interface MsgImage { url: string; thumbUrl?: string; name?: string; sizeKB?: number; }
// interface MsgDoc   { url: string; name: string; sizeKB?: number; }
// interface Message  {
//   id: string; text?: string | null; sender: Sender; createdAt: Date;
//   images?: MsgImage[]; docs?: MsgDoc[];
// }

// declare global { interface Window { webkitSpeechRecognition?: any; SpeechRecognition?: any; } }

// @Component({
//   selector: 'app-root',
//   templateUrl: './app.component.html',
//   styleUrls: ['./app.component.css'],
// })
// export class AppComponent implements AfterViewInit, OnDestroy {
//   constructor(private chatApi: ChatService) {}

//   @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;
//   @ViewChild('imgInput') imgInputRef!: ElementRef<HTMLInputElement>;
//   @ViewChild('docInput') docInputRef!: ElementRef<HTMLInputElement>;

//   title = 'Frontend';

//   // === Safety/UX controls ===
//   isSending = false;
//   private lastQuickAt = 0;

//   // Upload limits (mirror backend)
//   private readonly MAX_MB = 25;
//   private readonly MAX_FILES = 5;
//   private readonly ALLOWED_IMG = ['image/png','image/jpeg','image/webp'];
//   private readonly ALLOWED_DOC = [
//     'application/pdf','text/plain','text/markdown',
//     'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//     'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//   ];
//   private readonly BLOCKED_EXT = ['exe','bat','cmd','sh','js','msi','apk','com','scr','pif','jar','vbs','ps1','zip','rar','7z','tar','gz'];

//   // composer state
//   text = '';
//   attachCount = 0;

//   // chat state
//   messages: Message[] = [
//     { id: this.uuid(), text: "Hello! Welcome to Tunningspot . I'm your virtual assistant. How can I help you today?", sender: 'bot', createdAt: new Date() }
//   ];

//   // typing indicators
//   userTyping = false;
//   private userTypingTimer: any = null;

//   // attach menu
//   isAttachOpen = false;
//   pendingPick: 'images' | 'docs' | null = null;
//   imagesSelected: File[] = [];
//   docsSelected: File[] = [];
//   ttsEnabled = false;

//   // previews
//   imagePreviews: { url: string; name: string; sizeKB: number }[] = [];
//   docPreviews:   { url: string; name: string; ext: string; sizeKB: number }[] = [];

//   // Recorder / STT state
//   isRecording = false;
//   isRecUI = false;
//   private audioStream?: MediaStream;
//   private mediaRecorder?: MediaRecorder;
//   private audioChunks: Blob[] = [];
//   lastAudioUrl: string | null = null;

//   recognition?: any;
//   sttSupported = false;
//   sttLang = 'en-IN';
//   interimTranscript = '';
//   finalTranscript = '';

//   recStartMs = 0;
//   recElapsedMs = 0;
//   private recTimerId: any = null;

//   waveBars = new Array(14);
//   chatOpen = true;

//   robotOpts: AnimationOptions = { path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true } as const;
//   searchToolOpts: AnimationOptions = { path: 'assets/lottie/search.json', renderer: 'svg', autoplay: true, loop: true } as const;
//   botAvatarOpts: AnimationOptions = { path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true } as const;
//   botTypingOpts: AnimationOptions = { path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true } as const;
//   brandLottieOpts: AnimationOptions = { path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true } as const;

//   /* ========================= Voice-to-Voice Overlay ========================= */
//   showVoiceOverlay = false;
//   isSpeaking = false;
//   isConversing = false;
//   private resumeAfterTTS = false;

//   selectedGender: 'male' | 'female' = 'female';
//   allVoices: SpeechSynthesisVoice[] = [];
//   femaleVoice: SpeechSynthesisVoice | null = null;
//   maleVoice: SpeechSynthesisVoice | null = null;
//   private currentUtterance?: SpeechSynthesisUtterance;

//   ngAfterViewInit(): void { this.scrollCanvasToBottom(); }
//   ngOnDestroy(): void {
//     this.revokeImagePreviews();
//     this.revokeDocPreviews();
//     if (this.lastAudioUrl) { try { URL.revokeObjectURL(this.lastAudioUrl); } catch {} }
//     this.stopConversation();
//   }

//   onBrandAnimCreated(anim: AnimationItem) {
//     if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) anim.pause();
//   }
//   onClose(): void { this.chatOpen = false; }

//   // ===== Header actions =====
//   onRefresh(): void {
//     this.messages = [ this.chatApi.refreshWelcome() as any ];
//     this.userTyping = false; this.text = '';
//     this.lastAudioUrl = null; this.imagesSelected = []; this.docsSelected = [];
//     this.ttsEnabled = false; this.isAttachOpen = false;
//     this.revokeImagePreviews(); this.revokeDocPreviews(); this.scrollCanvasToBottom();
//   }

//   // ===== Attach popover =====
//   toggleAttachMenu(): void { this.isAttachOpen = !this.isAttachOpen; }
//   closeAttachMenu(): void { this.isAttachOpen = false; }
//   pickImages(): void { this.pendingPick = 'images'; this.imgInputRef?.nativeElement?.click(); }
//   pickDocs(): void {
//     this.pendingPick = 'docs';
//     if (this.docInputRef?.nativeElement) {
//       this.docInputRef.nativeElement.accept = '.pdf,.doc,.docx,.txt,.md,.xls,.xlsx';
//       this.docInputRef.nativeElement.click();
//     }
//   }
//   enableTTS(): void { this.ttsEnabled = true; this.closeAttachMenu(); }
//   disableTTS(): void { this.ttsEnabled = false; }
//   clearImages(): void { this.revokeImagePreviews(); this.imagesSelected = []; }
//   clearDocs(): void { this.revokeDocPreviews(); this.docsSelected = []; }

//   // --- File validation helpers ---
//   private isBlocked(name: string) {
//     const ext = (name.split('.').pop() || '').toLowerCase();
//     return this.BLOCKED_EXT.includes(ext);
//   }
//   private validateFile(file: File, allowed: string[]) {
//     const okType = allowed.includes(file.type);
//     const okSize = file.size <= this.MAX_MB * 1024 * 1024;
//     return okType && okSize && !this.isBlocked(file.name);
//   }

//   public onImagesSelected(e: Event): void {
//     const input = e.target as HTMLInputElement;
//     let files = Array.from(input.files ?? []);
//     if (files.length > this.MAX_FILES) files = files.slice(0, this.MAX_FILES);
//     const good = files.filter(f => this.validateFile(f, this.ALLOWED_IMG));
//     if (good.length !== files.length) alert('Some images were blocked (type/size).');
//     this.imagesSelected = good; this.buildImagePreviews(good); this.isAttachOpen = false; input.value = '';
//   }
//   public onDocsSelected(e: Event): void {
//     const input = e.target as HTMLInputElement;
//     let files = Array.from(input.files ?? []);
//     if (files.length > this.MAX_FILES) files = files.slice(0, this.MAX_FILES);
//     const good = files.filter(f => this.validateFile(f, this.ALLOWED_DOC));
//     if (good.length !== files.length) alert('Some documents were blocked (type/size).');
//     this.docsSelected = good; this.buildDocPreviews(good); this.isAttachOpen = false; input.value = '';
//   }

//   private buildImagePreviews(files: File[]) {
//     this.revokeImagePreviews();
//     this.imagePreviews = files.map(f => ({ url: URL.createObjectURL(f), name: f.name, sizeKB: Math.max(1, Math.round(f.size / 1024)) }));
//   }
//   private revokeImagePreviews() { for (const p of this.imagePreviews) { try { URL.revokeObjectURL(p.url); } catch {} } this.imagePreviews = []; }
//   private buildDocPreviews(files: File[]) {
//     this.revokeDocPreviews();
//     this.docPreviews = files.map(f => ({ url: URL.createObjectURL(f), name: f.name, ext: (f.name.split('.').pop() || '').toLowerCase(), sizeKB: Math.max(1, Math.round(f.size / 1024)) }));
//   }
//   private revokeDocPreviews() { for (const d of this.docPreviews) { try { URL.revokeObjectURL(d.url); } catch {} } this.docPreviews = []; }

//   // ===== Composer recorder (not used in overlay loop) =====
//   async onMicClick() { if (!this.isRecUI) await this.startRecordingUI(); }
//   private async startRecordingUI() {
//     try { this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
//     catch { alert('Microphone permission denied or unsupported.'); return; }

//     this.audioChunks = [];
//     this.mediaRecorder = new MediaRecorder(this.audioStream);
//     this.mediaRecorder.ondataavailable = (ev) => { if (ev.data.size > 0) this.audioChunks.push(ev.data); };
//     this.mediaRecorder.onstop = () => {
//       const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
//       this.lastAudioUrl = URL.createObjectURL(blob);
//       this.audioStream?.getTracks().forEach(t => t.stop());
//       this.audioStream = undefined; this.isRecording = false;
//     };
//     this.mediaRecorder.start();

//     const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
//     this.sttSupported = !!SR;
//     if (this.sttSupported) {
//       this.recognition = new SR();
//       this.recognition.lang = this.sttLang;
//       this.recognition.interimResults = true;
//       this.recognition.continuous = true;
//       this.recognition.onresult = (event: any) => {
//         let interim = '';
//         for (let i = event.resultIndex; i < event.results.length; i++) {
//           const res = event.results[i];
//           if (res.isFinal) this.finalTranscript += res[0].transcript + ' ';
//           else interim += res[0].transcript;
//         }
//         this.interimTranscript = interim.trim();
//       };
//       this.recognition.onerror = () => {};
//       this.recognition.onend = () => { if (this.isRecUI) { try { this.recognition.start(); } catch {} } };
//       try { this.recognition.start(); } catch {}
//     }

//     this.isRecUI = true; this.isRecording = true;
//     this.interimTranscript = ''; this.finalTranscript = '';
//     this.recStartMs = Date.now(); this.recElapsedMs = 0;

//     this.recTimerId = setInterval(() => {
//       this.recElapsedMs = Date.now() - this.recStartMs;
//       if (this.recElapsedMs > 60000) this.confirmRecording();
//     }, 250);
//   }
//   cancelRecording() {
//     try { this.recognition?.stop(); } catch {}
//     this.recognition = undefined;
//     try { this.mediaRecorder?.stop(); } catch {}
//     this.mediaRecorder = undefined;
//     if (this.lastAudioUrl) { URL.revokeObjectURL(this.lastAudioUrl); this.lastAudioUrl = null; }
//     if (this.recTimerId) { clearInterval(this.recTimerId); this.recTimerId = null; }
//     this.isRecUI = false; this.isRecording = false;
//     this.interimTranscript = ''; this.finalTranscript = ''; this.recElapsedMs = 0;
//   }
//   confirmRecording() {
//     try { this.recognition?.stop(); } catch {}
//     this.recognition = undefined;
//     try { this.mediaRecorder?.stop(); } catch {}
//     this.mediaRecorder = undefined;
//     if (this.recTimerId) { clearInterval(this.recTimerId); this.recTimerId = null; }
//     this.isRecUI = false; this.isRecording = false;

//     const textOut = (this.finalTranscript || this.interimTranscript || '').trim();
//     this.text = textOut; this.interimTranscript = ''; this.finalTranscript = ''; this.recElapsedMs = 0;
//   }
//   removeImage(idx: number): void { const p = this.imagePreviews[idx]; try { URL.revokeObjectURL(p.url); } catch {} this.imagePreviews.splice(idx, 1); this.imagesSelected.splice(idx, 1); }
//   removeDoc(idx: number): void { const d = this.docPreviews[idx]; try { URL.revokeObjectURL(d.url); } catch {} this.docPreviews.splice(idx, 1); this.docsSelected.splice(idx, 1); }

//   get recElapsedLabel(): string { const s = Math.floor(this.recElapsedMs / 1000); const m = Math.floor(s / 60); const sec = (s % 60).toString().padStart(2, '0'); return `${m}:${sec}`; }

//   /** Quick replies -> backend (throttled) */
//   async sendQuick(raw: string): Promise<void> {
//     if (Date.now() - this.lastQuickAt < 500) return;
//     this.lastQuickAt = Date.now();

//     const msg = (raw || '').trim(); if (!msg) return;
//     this.push({ id: this.uuid(), text: msg, sender: 'user', createdAt: new Date() });

//     this.showBotTyping();
//     try {
//       const reply = await this.chatApi.askBot({ message: msg });
//       this.hideBotTyping();
//       this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });
//       this.maybeSpeak(reply);
//     } catch (e: any) {
//       this.hideBotTyping();
//       this.push({ id: this.uuid(), text: e?.message || 'Failed to get reply.', sender: 'bot', createdAt: new Date() });
//     }
//   }

//   onUserTyping(): void {
//     this.userTyping = true;
//     if (this.userTypingTimer) clearTimeout(this.userTypingTimer);
//     this.userTypingTimer = setTimeout(() => { this.userTyping = false; }, 800);
//   }
//   stopUserTyping(immediate = false): void {
//     if (this.userTypingTimer) { clearTimeout(this.userTypingTimer); this.userTypingTimer = null; }
//     if (immediate) this.userTyping = false;
//   }

//   /** Main send: upload -> ask */
//   async send() {
//     if (this.isSending) return;

//     const trimmed = this.text.trim();
//     const hasImages = this.imagesSelected.length > 0;
//     const hasDocs   = this.docsSelected.length   > 0;
//     const hasText   = !!trimmed;
//     if (!hasText && !hasImages && !hasDocs) return;

//     this.isSending = true;
//     try {
//       if (this.isRecUI) this.cancelRecording();
//       this.stopUserTyping(true);

//       // Local echo
//       const images: MsgImage[] = this.imagePreviews.map(p => ({ url: p.url, thumbUrl: p.url, name: p.name, sizeKB: p.sizeKB }));
//       const docs:   MsgDoc[]   = this.docPreviews.map(d => ({ url: d.url, name: d.name, sizeKB: d.sizeKB }));
//       this.push({ id: this.uuid(), text: hasText ? trimmed : null, images: images.length ? images : undefined, docs: docs.length ? docs : undefined, sender: 'user', createdAt: new Date() });

//       const imageFiles = [...this.imagesSelected];
//       const docFiles   = [...this.docsSelected];

//       // Clear UI
//       this.text = ''; this.attachCount = 0; this.isAttachOpen = false;
//       this.imagesSelected = []; this.docsSelected = [];
//       this.imagePreviews = []; this.docPreviews = [];

//       // Upload
//       let uploadedImageUrls: string[] = []; let uploadedDocUrls: string[] = [];
//       try {
//         if (imageFiles.length) uploadedImageUrls = await this.chatApi.uploadManyImages(imageFiles);
//         if (docFiles.length)   uploadedDocUrls   = await this.chatApi.uploadManyDocs(docFiles);
//       } catch (e: any) {
//         this.push({ id: this.uuid(), text: `Upload failed: ${e?.message || e}`, sender: 'bot', createdAt: new Date() });
//         return;
//       }

//       // Ask bot
//       this.showBotTyping();
//       try {
//         const reply = await this.chatApi.askBot({ message: trimmed, images: uploadedImageUrls, docs: uploadedDocUrls });
//         this.hideBotTyping();
//         this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });
//         this.maybeSpeak(reply);
//       } catch (e: any) {
//         this.hideBotTyping();
//         this.push({ id: this.uuid(), text: e?.message || 'Failed to get reply.', sender: 'bot', createdAt: new Date() });
//       }
//     } finally {
//       this.isSending = false;
//     }
//   }

//   // ===== OCR & Doc->Text helpers =====
//   async ocrSelectedImages() {
//     if (!this.imagesSelected.length) return;
//     try {
//       const chunks: string[] = [];
//       for (const f of this.imagesSelected) {
//         const t = await this.chatApi.ocrImage(f);
//         if (t) chunks.push(t.trim());
//       }
//       const combined = chunks.filter(Boolean).join('\n').trim();
//       if (combined) this.text = (this.text ? this.text + '\n' : '') + combined;
//     } catch (e: any) { alert('OCR failed: ' + (e?.message || e)); }
//   }

//   async docToTextSelectedDocs() {
//     if (!this.docsSelected.length) return;
//     try {
//       const chunks: string[] = [];
//       for (const f of this.docsSelected) {
//         const res = await this.chatApi.docToText(f);
//         if (res?.pages?.length) chunks.push(res.pages.join('\n'));
//         else if (res?.text) chunks.push(res.text);
//       }
//       const combined = chunks.filter(Boolean).join('\n').trim();
//       if (combined) this.text = (this.text ? this.text + '\n' : '') + combined;
//     } catch (e: any) { alert('Doc→Text failed: ' + (e?.message || e)); }
//   }

//   public get imgCount(): number { return this.imagePreviews.length; }
//   public get docCount(): number { return this.docPreviews.length; }

//   public get showAttachMenu(): boolean { return this.isAttachOpen; }
//   public set showAttachMenu(v: boolean) { this.isAttachOpen = v; }

//   private push(m: Message) { this.messages = [...this.messages, m]; this.scrollCanvasToBottom(); }
//   private showBotTyping() { if (!this.messages.some(x => x.sender === 'typing')) { this.messages = [...this.messages, { id: 'typing', text: 'typing', sender: 'typing', createdAt: new Date() }]; } this.scrollCanvasToBottom(); }
//   private hideBotTyping() { this.messages = this.messages.filter(m => m.sender !== 'typing'); }
//   private scrollCanvasToBottom() { setTimeout(() => { const el = this.canvasRef?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }); }

//   openImage(img: MsgImage) { try { window.open(img.url, '_blank'); } catch {} }
//   private maybeSpeak(reply: string) { if (this.ttsEnabled && 'speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(reply); u.lang = 'en-IN'; window.speechSynthesis.speak(u); } }

//   private uuid(): string {
//     return typeof crypto !== 'undefined' && 'randomUUID' in crypto
//       ? (crypto as any).randomUUID()
//       : Math.random().toString(36).slice(2) + Date.now().toString(36);
//   }

//   /* ========================= Voice-to-Voice overlay auto loop ========================= */
//   openVoiceOverlay() { this.closeAttachMenu(); this.showVoiceOverlay = true; this.loadVoices(); this.interimTranscript = ''; this.finalTranscript = ''; this.startConversation(); }
//   closeVoiceOverlay() { this.stopConversation(); this.showVoiceOverlay = false; }
//   setGender(g: 'male' | 'female') { this.selectedGender = g; }

//   loadVoices() {
//     try {
//       const synth = window.speechSynthesis;
//       const pick = () => {
//         this.allVoices = synth.getVoices() || [];
//         const en = this.allVoices.filter(v => /en[-_]/i.test(v.lang));
//         const fallback = this.allVoices[0] ?? null;
//         this.femaleVoice = (en.find(v => /female|woman|salli|joanna|olivia|natalie/i.test(v.name)) ?? en[0] ?? fallback);
//         this.maleVoice   = (en.find(v => /male|man|matthew|joey|brian|adam|david/i.test(v.name)) ?? en[1] ?? this.allVoices[1] ?? this.femaleVoice ?? fallback);
//       };
//       pick();
//       if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = () => pick();
//     } catch {}
//   }

//   private startConversation() { if (this.isConversing) return; this.isConversing = true; this.resumeAfterTTS = false; this.startRecognitionOnce(); }
//   private stopConversation() { this.isConversing = false; this.resumeAfterTTS = false; this.stopRecognition(); this.stopSpeaking(); }

//   private startRecognitionOnce() {
//     const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
//     if (!SR) { this.speak("Sorry, your browser doesn't support speech recognition."); this.isConversing = false; return; }

//     this.stopRecognition();
//     const rec = new SR();
//     rec.lang = this.sttLang; rec.interimResults = false; rec.continuous = false;
//     rec.onstart = () => { this.isRecording = true; };
//     rec.onresult = async (e: any) => {
//       let finalText = '';
//       for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
//       finalText = finalText.trim();
//       this.resumeAfterTTS = true; this.stopRecognition();

//       if (finalText) {
//         const reply = await this.safeAsk(finalText);
//         this.speak(reply || 'Sorry, I did not get that.');
//       } else {
//         this.resumeAfterTTS = false;
//         if (this.isConversing && !this.isSpeaking) this.startRecognitionOnce();
//       }
//     };
//     rec.onerror = () => { this.isRecording = false; if (this.isConversing && !this.isSpeaking && !this.resumeAfterTTS) setTimeout(() => this.startRecognitionOnce(), 400); };
//     rec.onend   = () => { this.isRecording = false; if (this.isConversing && !this.isSpeaking && !this.resumeAfterTTS) this.startRecognitionOnce(); };

//     this.recognition = rec; try { rec.start(); } catch {}
//   }

//   private async safeAsk(text: string): Promise<string> {
//     try { return await this.chatApi.askBot({ message: text }); }
//     catch (e: any) { return e?.message || 'Network error.'; }
//   }

//   private stopRecognition() { try { this.recognition?.stop(); } catch {} this.recognition = undefined; this.isRecording = false; }

//   private speak(text: string) {
//     if (!text) return;
//     this.stopSpeaking();
//     const utter = new SpeechSynthesisUtterance(text); utter.rate = 1; utter.pitch = 1; utter.volume = 1;
//     const chosen = this.selectedGender === 'female' ? this.femaleVoice : this.maleVoice; utter.voice = chosen ?? null;
//     utter.onstart = () => { this.isSpeaking = true; };
//     utter.onend = () => { this.isSpeaking = false; this.currentUtterance = undefined; if (this.isConversing) { this.resumeAfterTTS = false; setTimeout(() => { if (this.isConversing) this.startRecognitionOnce(); }, 150); } };
//     utter.onerror = () => { this.isSpeaking = false; this.currentUtterance = undefined; if (this.isConversing) { this.resumeAfterTTS = false; setTimeout(() => { if (this.isConversing) this.startRecognitionOnce(); }, 150); } };
//     this.currentUtterance = utter; window.speechSynthesis.speak(utter);
//   }
//   private stopSpeaking() { try { if ((window as any).speechSynthesis.speaking || (window as any).speechSynthesis.pending) (window as any).speechSynthesis.cancel(); } catch {} this.isSpeaking = false; this.currentUtterance = undefined; }

//   // Template aliases
//   get interimText(): string { return this.interimTranscript; } set interimText(v: string) { this.interimTranscript = v; }
//   get finalText(): string { return this.finalTranscript; }   set finalText(v: string) { this.finalTranscript = v; }
// }




import { AfterViewInit, Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { AnimationOptions } from 'ngx-lottie';
import type { AnimationItem } from 'lottie-web';
import { ChatService } from './core/services/chat.service';

type Sender = 'user' | 'bot' | 'system' | 'typing';

interface MsgImage { url: string; thumbUrl?: string; name?: string; sizeKB?: number; }
interface MsgDoc   { url: string; name: string; sizeKB?: number; }
interface Message  {
  id: string; text?: string | null; sender: Sender; createdAt: Date;
  images?: MsgImage[]; docs?: MsgDoc[];
}

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
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

  title = 'Frontend';

  // === Safety/UX controls ===
  isSending = false;               // disable Send during in-flight request
  private lastQuickAt = 0;         // throttle quick replies (500ms)

  // Upload limits (mirror backend)
  private readonly MAX_MB = 25;
  private readonly MAX_FILES = 5;
  private readonly ALLOWED_IMG = ['image/png','image/jpeg','image/webp'];
  private readonly ALLOWED_DOC = [
    'application/pdf','text/plain','text/markdown',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  private readonly BLOCKED_EXT = ['exe','bat','cmd','sh','js','msi','apk','com','scr','pif','jar','vbs','ps1','zip','rar','7z','tar','gz'];

  // composer state
  text = '';
  attachCount = 0;

  // chat state
  messages: Message[] = [
    { id: this.uuid(), text: "Hello! Welcome to Tunningspot . I'm your virtual assistant. How can I help you today?", sender: 'bot', createdAt: new Date() }
  ];

  // typing indicators
  userTyping = false;
  private userTypingTimer: any = null;

  // attach menu
  isAttachOpen = false;
  pendingPick: 'images' | 'docs' | null = null;
  imagesSelected: File[] = [];
  docsSelected: File[] = [];
  ttsEnabled = false;

  // previews
  imagePreviews: { url: string; name: string; sizeKB: number }[] = [];
  docPreviews:   { url: string; name: string; ext: string; sizeKB: number }[] = [];

  // Recorder / STT state
  isRecording = false;
  isRecUI = false;
  private audioStream?: MediaStream;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  lastAudioUrl: string | null = null;

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

  /* ========================= Voice-to-Voice Overlay ========================= */
  showVoiceOverlay = false;
  isSpeaking = false;
  isConversing = false;
  private resumeAfterTTS = false;

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
    this.stopConversation();
  }

  onBrandAnimCreated(anim: AnimationItem) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) anim.pause();
  }
  onClose(): void { this.chatOpen = false; }

  // ===== Header actions =====
  onRefresh(): void {
    this.messages = [ this.chatApi.refreshWelcome() as any ];
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

  // --- File validation helpers ---
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

  // ===== Composer recorder (not used in overlay loop) =====
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

    // Cap recording to 60s
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
  removeImage(idx: number): void { const p = this.imagePreviews[idx]; try { URL.revokeObjectURL(p.url); } catch {} this.imagePreviews.splice(idx, 1); this.imagesSelected.splice(idx, 1); }
  removeDoc(idx: number): void { const d = this.docPreviews[idx]; try { URL.revokeObjectURL(d.url); } catch {} this.docPreviews.splice(idx, 1); this.docsSelected.splice(idx, 1); }

  get recElapsedLabel(): string { const s = Math.floor(this.recElapsedMs / 1000); const m = Math.floor(s / 60); const sec = (s % 60).toString().padStart(2, '0'); return `${m}:${sec}`; }

  /** Quick replies -> backend (throttled) */
  async sendQuick(raw: string): Promise<void> {
    if (Date.now() - this.lastQuickAt < 500) return; // throttle 500ms
    this.lastQuickAt = Date.now();

    const msg = (raw || '').trim(); if (!msg) return;
    this.push({ id: this.uuid(), text: msg, sender: 'user', createdAt: new Date() });

    this.showBotTyping();
    try {
      const reply = await this.chatApi.askBot({ message: msg }); // JSON to /chat handled in service
      this.hideBotTyping();
      this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });
      this.maybeSpeak(reply);
    } catch (e: any) {
      this.hideBotTyping();
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

  /** Main send: upload -> ask */
  async send() {
    if (this.isSending) return;

    const trimmed = this.text.trim();
    const hasImages = this.imagesSelected.length > 0;
    const hasDocs   = this.docsSelected.length   > 0;
    const hasText   = !!trimmed;
    if (!hasText && !hasImages && !hasDocs) return;

    this.isSending = true;
    try {
      if (this.isRecUI) this.cancelRecording();
      this.stopUserTyping(true);

      // Local echo
      const images: MsgImage[] = this.imagePreviews.map(p => ({ url: p.url, thumbUrl: p.url, name: p.name, sizeKB: p.sizeKB }));
      const docs:   MsgDoc[]   = this.docPreviews.map(d => ({ url: d.url, name: d.name, sizeKB: d.sizeKB }));
      this.push({
        id: this.uuid(),
        text: hasText ? trimmed : null,
        images: images.length ? images : undefined,
        docs: docs.length ? docs : undefined,
        sender: 'user',
        createdAt: new Date()
      });

      const imageFiles = [...this.imagesSelected];
      const docFiles   = [...this.docsSelected];

      // Clear UI
      this.text = ''; this.attachCount = 0; this.isAttachOpen = false;
      this.imagesSelected = []; this.docsSelected = [];
      this.imagePreviews = []; this.docPreviews = [];

      // Upload to backend (both map to /upload under the hood)
      try {
        if (imageFiles.length) await this.chatApi.uploadManyImages(imageFiles);
        if (docFiles.length)   await this.chatApi.uploadManyDocs(docFiles);
      } catch (e: any) {
        this.push({ id: this.uuid(), text: `Upload failed: ${e?.message || e}`, sender: 'bot', createdAt: new Date() });
        return;
      }

      // Ask bot (backend reads from its store; no need to send image/doc URLs here)
      this.showBotTyping();
      try {
        const reply = await this.chatApi.askBot({ message: trimmed });
        this.hideBotTyping();
        this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });
        this.maybeSpeak(reply);
      } catch (e: any) {
        this.hideBotTyping();
        this.push({ id: this.uuid(), text: e?.message || 'Failed to get reply.', sender: 'bot', createdAt: new Date() });
      }
    } finally {
      this.isSending = false;
    }
  }

  // ===== OCR & Doc->Text helpers (optional; backend already OCRs during upload) =====
  async ocrSelectedImages() {
    if (!this.imagesSelected.length) return;
    try {
      const chunks: string[] = [];
      for (const f of this.imagesSelected) {
        const t = await this.chatApi.ocrImage(f);
        if (t) chunks.push(t.trim());
      }
      const combined = chunks.filter(Boolean).join('\n').trim();
      if (combined) this.text = (this.text ? this.text + '\n' : '') + combined;
    } catch (e: any) { alert('OCR failed: ' + (e?.message || e)); }
  }

  async docToTextSelectedDocs() {
    if (!this.docsSelected.length) return;
    try {
      const chunks: string[] = [];
      for (const f of this.docsSelected) {
        const res = await this.chatApi.docToText(f);
        if (res?.pages?.length) chunks.push(res.pages.join('\n'));
        else if (res?.text) chunks.push(res.text);
      }
      const combined = chunks.filter(Boolean).join('\n').trim();
      if (combined) this.text = (this.text ? this.text + '\n' : '') + combined;
    } catch (e: any) { alert('Doc→Text failed: ' + (e?.message || e)); }
  }

  public get imgCount(): number { return this.imagePreviews.length; }
  public get docCount(): number { return this.docPreviews.length; }

  public get showAttachMenu(): boolean { return this.isAttachOpen; }
  public set showAttachMenu(v: boolean) { this.isAttachOpen = v; }

  private push(m: Message) { this.messages = [...this.messages, m]; this.scrollCanvasToBottom(); }
  private showBotTyping() {
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

  /* ========================= Voice-to-Voice overlay auto loop (browser STT/TTS) ========================= */
  openVoiceOverlay() { this.closeAttachMenu(); this.showVoiceOverlay = true; this.loadVoices(); this.interimTranscript = ''; this.finalTranscript = ''; this.startConversation(); }
  closeVoiceOverlay() { this.stopConversation(); this.showVoiceOverlay = false; }
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

  private startConversation() {
    if (this.isConversing) return;
    this.isConversing = true;
    this.resumeAfterTTS = false;
    this.startRecognitionOnce();
  }
  private stopConversation() { this.isConversing = false; this.resumeAfterTTS = false; this.stopRecognition(); this.stopSpeaking(); }

  private startRecognitionOnce() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.speak("Sorry, your browser doesn't support speech recognition."); this.isConversing = false; return; }

    this.stopRecognition();
    const rec = new SR();
    rec.lang = this.sttLang; rec.interimResults = false; rec.continuous = false;
    rec.onstart = () => { this.isRecording = true; };
    rec.onresult = async (e: any) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      finalText = finalText.trim();
      this.resumeAfterTTS = true; this.stopRecognition();

      if (finalText) {
        const reply = await this.safeAsk(finalText);
        this.speak(reply || 'Sorry, I did not get that.');
      } else {
        this.resumeAfterTTS = false;
        if (this.isConversing && !this.isSpeaking) this.startRecognitionOnce();
      }
    };
    rec.onerror = () => {
      this.isRecording = false;
      if (this.isConversing && !this.isSpeaking && !this.resumeAfterTTS) setTimeout(() => this.startRecognitionOnce(), 400);
    };
    rec.onend   = () => {
      this.isRecording = false;
      if (this.isConversing && !this.isSpeaking && !this.resumeAfterTTS) this.startRecognitionOnce();
    };

    this.recognition = rec; try { rec.start(); } catch {}
  }

  private async safeAsk(text: string): Promise<string> {
    try { return await this.chatApi.askBot({ message: text }); }
    catch (e: any) { return e?.message || 'Network error.'; }
  }

  private stopRecognition() { try { this.recognition?.stop(); } catch {} this.recognition = undefined; this.isRecording = false; }

  private speak(text: string) {
    if (!text) return;
    this.stopSpeaking();
    const utter = new SpeechSynthesisUtterance(text); utter.rate = 1; utter.pitch = 1; utter.volume = 1;
    const chosen = this.selectedGender === 'female' ? this.femaleVoice : this.maleVoice; utter.voice = chosen ?? null;
    utter.onstart = () => { this.isSpeaking = true; };
    const resume = () => {
      this.isSpeaking = false; this.currentUtterance = undefined;
      if (this.isConversing) { this.resumeAfterTTS = false; setTimeout(() => { if (this.isConversing) this.startRecognitionOnce(); }, 150); }
    };
    utter.onend = resume;
    utter.onerror = resume;
    this.currentUtterance = utter; window.speechSynthesis.speak(utter);
  }
  private stopSpeaking() {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
    } catch {}
    this.isSpeaking = false; this.currentUtterance = undefined;
  }

  // Template aliases
  get interimText(): string { return this.interimTranscript; } set interimText(v: string) { this.interimTranscript = v; }
  get finalText(): string { return this.finalTranscript; }   set finalText(v: string) { this.finalTranscript = v; }
}
