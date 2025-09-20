import { AfterViewInit, Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { AnimationOptions } from 'ngx-lottie';
import type { AnimationItem } from 'lottie-web';

type Sender = 'user' | 'bot' | 'system' | 'typing';

interface Message {
  id: string;
  text: string;
  sender: Sender;
  createdAt: Date;
}

declare global {
  interface Window { webkitSpeechRecognition?: any; SpeechRecognition?: any; }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;

  // Hidden inputs used for attachment picking
  @ViewChild('imgInput') imgInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('docInput') docInputRef!: ElementRef<HTMLInputElement>;

  title = 'Frontend';

  // composer state
  text = '';
  attachCount = 0;

  // chat state
  messages: Message[] = [
    {
      id: this.uuid(),
      text: "Hello! Welcome to Tunningspot . I'm your virtual assistant. How can I help you today?",
      sender: 'bot',
      createdAt: new Date()
    }
  ];

  // typing indicators
  userTyping = false;
  private userTypingTimer: any = null;

  // ===== Attach popover + status chips =====
  isAttachOpen = false;
  pendingPick: 'images' | 'docs' | null = null;
  imagesSelected: File[] = [];
  docsSelected: File[] = [];
  ttsEnabled = false;

  // ===== Attachment previews (shown above composer) =====
  imagePreviews: { url: string; name: string; sizeKB: number }[] = [];
  docPreviews:   { name: string; ext: string; sizeKB: number }[] = [];

  // Audio recording + STT
  isRecording = false;              // for mic button visual
  isRecUI = false;                  // whether chip replaces input
  private audioStream?: MediaStream;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  lastAudioUrl: string | null = null;

  recognition?: any;                // SpeechRecognition instance
  sttSupported = false;
  sttLang = 'en-IN';
  interimTranscript = '';
  finalTranscript = '';

  // Timer
  recStartMs = 0;
  recElapsedMs = 0;
  private recTimerId: any = null;

  // simple bars for the fake wave
  waveBars = new Array(14);

  ngAfterViewInit(): void { this.scrollCanvasToBottom(); }

  ngOnDestroy(): void {
    // Clean up any created object URLs
    this.revokeImagePreviews();
  }

  /* ===== Header actions ===== */
  onRefresh(): void {
    this.messages = [
      {
        id: this.uuid(),
        text: "Hello! Welcome to Tunningspot . I'm your virtual assistant. How can I help you today?",
        sender: 'bot',
        createdAt: new Date()
      }
    ];
    this.userTyping = false;
    this.text = '';
    this.lastAudioUrl = null;
    this.imagesSelected = [];
    this.docsSelected = [];
    this.ttsEnabled = false;
    this.isAttachOpen = false;

    // Reset previews too
    this.revokeImagePreviews();
    this.docPreviews = [];

    this.scrollCanvasToBottom();
  }

  chatOpen = true;
  onClose(): void { this.chatOpen = false; }

  /* ===== Lottie options for bot avatar + typing indicator ===== */
  botAvatarOpts: AnimationOptions = {
    path: 'assets/lottie/bluebot.json',
    renderer: 'svg',
    autoplay: true,
    loop: true
  };

  botTypingOpts: AnimationOptions = {
    path: 'assets/lottie/bluebot.json',
    renderer: 'svg',
    autoplay: true,
    loop: true
  };

  /* ===== Attach popover actions ===== */
  toggleAttachMenu(): void { this.isAttachOpen = !this.isAttachOpen; }
  closeAttachMenu(): void { this.isAttachOpen = false; }

  pickImages(): void {
    // Limit selection to images and trigger the hidden input
    this.pendingPick = 'images';
    if (this.imgInputRef?.nativeElement) {
      this.imgInputRef.nativeElement.accept = 'image/*';
      this.imgInputRef.nativeElement.click();
    }
    // Popover will auto-close in onImagesSelected()
  }

  pickDocs(): void {
    // Limit selection to common document types and trigger the hidden input
    this.pendingPick = 'docs';
    if (this.docInputRef?.nativeElement) {
      this.docInputRef.nativeElement.accept = '.pdf,.doc,.docx,.txt,.xls,.xlsx';
      this.docInputRef.nativeElement.click();
    }
    // Popover will auto-close in onDocsSelected()
  }

  enableTTS(): void {
    this.ttsEnabled = true;
    this.closeAttachMenu();
  }
  disableTTS(): void { this.ttsEnabled = false; }

  clearImages(): void {
    this.revokeImagePreviews();
    this.imagesSelected = [];
  }
  clearDocs(): void {
    this.docsSelected = [];
    this.docPreviews = [];
  }

  /* ===== File selection handlers (previews + auto close) ===== */
  public onImagesSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    this.imagesSelected = files;
    this.buildImagePreviews(files);     // create object-URL thumbnails

    this.isAttachOpen = false;          // auto-close popover
    input.value = '';                   // allow picking same file again
  }

  public onDocsSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    this.docsSelected = files;
    this.docPreviews = files.map(f => ({
      name: f.name,
      ext: (f.name.split('.').pop() || '').toLowerCase(),
      sizeKB: Math.max(1, Math.round(f.size / 1024))
    }));

    this.isAttachOpen = false;          // auto-close popover
    input.value = '';
  }

  /* ===== Image preview helpers ===== */
  private buildImagePreviews(files: File[]) {
    this.revokeImagePreviews(); // clear old URLs first
    this.imagePreviews = files.map(f => ({
      url: URL.createObjectURL(f),
      name: f.name,
      sizeKB: Math.max(1, Math.round(f.size / 1024))
    }));
  }

  private revokeImagePreviews() {
    for (const p of this.imagePreviews) {
      try { URL.revokeObjectURL(p.url); } catch {}
    }
    this.imagePreviews = [];
  }

  /* ===== Mic button ===== */
  async onMicClick() {
    if (this.isRecUI) return; // already recording
    await this.startRecordingUI();
  }

  /* ===== Start Recording + STT ===== */
  private async startRecordingUI() {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert('Microphone permission denied or unsupported.');
      return;
    }

    // MediaRecorder
    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(this.audioStream);
    this.mediaRecorder.ondataavailable = (ev) => { if (ev.data.size > 0) this.audioChunks.push(ev.data); };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.lastAudioUrl = URL.createObjectURL(blob);
      this.audioStream?.getTracks().forEach(t => t.stop());
      this.audioStream = undefined;
      this.isRecording = false;
    };
    this.mediaRecorder.start();

    // STT (browser)
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

    // show chip + timer
    this.isRecUI = true;
    this.isRecording = true;
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.recStartMs = Date.now();
    this.recElapsedMs = 0;
    this.recTimerId = setInterval(() => { this.recElapsedMs = Date.now() - this.recStartMs; }, 250);
  }

  /* ===== Cancel / Confirm recording ===== */
  cancelRecording() {
    try { this.recognition?.stop(); } catch {}
    this.recognition = undefined;
    try { this.mediaRecorder?.stop(); } catch {}
    this.mediaRecorder = undefined;

    if (this.lastAudioUrl) { URL.revokeObjectURL(this.lastAudioUrl); this.lastAudioUrl = null; }

    if (this.recTimerId) { clearInterval(this.recTimerId); this.recTimerId = null; }
    this.isRecUI = false;
    this.isRecording = false;
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.recElapsedMs = 0;
  }

  confirmRecording() {
    try { this.recognition?.stop(); } catch {}
    this.recognition = undefined;
    try { this.mediaRecorder?.stop(); } catch {}
    this.mediaRecorder = undefined;

    if (this.recTimerId) { clearInterval(this.recTimerId); this.recTimerId = null; }
    this.isRecUI = false;
    this.isRecording = false;

    const textOut = (this.finalTranscript || this.interimTranscript || '').trim();
    this.text = textOut;

    this.interimTranscript = '';
    this.finalTranscript = '';
    this.recElapsedMs = 0;
  }


  removeImage(idx: number): void {
  // revoke object URL and remove from both arrays
  const p = this.imagePreviews[idx];
  try { URL.revokeObjectURL(p.url); } catch {}
  this.imagePreviews.splice(idx, 1);
  this.imagesSelected.splice(idx, 1);
}

removeDoc(idx: number): void {
  this.docPreviews.splice(idx, 1);
  this.docsSelected.splice(idx, 1);
}
  /* Timer label like 0:07, 1:23 */
  get recElapsedLabel(): string {
    const s = Math.floor(this.recElapsedMs / 1000);
    const m = Math.floor(s / 60);
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  /* ===== Quick replies (send directly) ===== */
  sendQuick(raw: string): void {
    const msg = (raw || '').trim();
    if (!msg) return;

    this.push({ id: this.uuid(), text: msg, sender: 'user', createdAt: new Date() });

    this.showBotTyping();
    setTimeout(() => {
      this.hideBotTyping();
      const reply = this.generateReply(msg);
      this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });
      if (this.ttsEnabled && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(reply);
        u.lang = 'en-IN';
        window.speechSynthesis.speak(u);
      }
    }, 900);
  }

  /* ===== User text typing (for animated bot avatar) ===== */
  onUserTyping(): void {
    this.userTyping = true;
    if (this.userTypingTimer) clearTimeout(this.userTypingTimer);
    this.userTypingTimer = setTimeout(() => { this.userTyping = false; }, 800);
  }
  stopUserTyping(immediate = false): void {
    if (this.userTypingTimer) { clearTimeout(this.userTypingTimer); this.userTypingTimer = null; }
    if (immediate) this.userTyping = false;
  }

  /* ===== Send flow ===== */
  send() {
    const msg = this.text.trim();
    if (!msg && this.attachCount === 0 && this.imagesSelected.length === 0 && this.docsSelected.length === 0) return;

    if (this.isRecUI) this.cancelRecording();
    this.stopUserTyping(true);

    if (msg) {
      this.push({ id: this.uuid(), text: msg, sender: 'user', createdAt: new Date() });
    }

    // (optional) system notes for selected files
    if (this.imagesSelected.length > 0) {
      this.push({ id: this.uuid(), text: `🖼️ ${this.imagesSelected.length} image(s) attached`, sender: 'system', createdAt: new Date() });
    }
    if (this.docsSelected.length > 0) {
      this.push({ id: this.uuid(), text: `📄 ${this.docsSelected.length} document(s) attached`, sender: 'system', createdAt: new Date() });
    }

    // clear input and legacy attach count
    this.text = '';
    this.attachCount = 0;

    this.showBotTyping();
    setTimeout(() => {
      this.hideBotTyping();
      const reply = this.generateReply(msg);
      this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });

      // Speak the reply if TTS mode is enabled
      if (this.ttsEnabled && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(reply);
        u.lang = 'en-IN';
        window.speechSynthesis.speak(u);
      }

      // you can clear selected files after sending if desired:
      // this.imagesSelected = [];
      // this.docsSelected = [];
      // this.revokeImagePreviews();
      // this.docPreviews = [];
    }, 900);
  }

  // counts used by template chips
  public get imgCount(): number { return this.imagesSelected.length; }
  public get docCount(): number { return this.docsSelected.length; }

  // alias for the attach popover boolean (used by *ngIf in the template)
  public get showAttachMenu(): boolean { return this.isAttachOpen; }
  public set showAttachMenu(v: boolean) { this.isAttachOpen = v; }

  // alias for TTS toggle button in the popover
  public toggleTTS(): void {
    this.ttsEnabled = !this.ttsEnabled;
  }

  /* ===== Helpers ===== */
  private push(m: Message) {
    this.messages = [...this.messages, m];
    this.scrollCanvasToBottom();
  }

  private showBotTyping() {
    if (!this.messages.some(x => x.sender === 'typing')) {
      this.messages = [...this.messages, { id: 'typing', text: 'typing', sender: 'typing', createdAt: new Date() }];
    }
    this.scrollCanvasToBottom();
  }

  private hideBotTyping() {
    this.messages = this.messages.filter(m => m.sender !== 'typing');
  }

  private scrollCanvasToBottom() {
    setTimeout(() => {
      const el = this.canvasRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private generateReply(q: string): string {
    const t = (q || '').toLowerCase();
    if (t.includes('price') || t.includes('pricing')) return 'Starter ₹0, Pro ₹1,999/mo, Business ₹6,999/mo.';
    if (t.includes('refund')) return 'Refunds within 7 days if unused; otherwise prorated.';
    if (t.includes('help') || t.includes('support')) return 'Sure—tell me what you’re stuck on.';
    if (t.includes('hello') || t.includes('hi')) return 'Hi! 👋 How can I assist you today?';
    return "Got it. Could you share a bit more detail?";
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
