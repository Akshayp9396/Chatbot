import { AfterViewInit, Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { AnimationOptions } from 'ngx-lottie';
import type { AnimationItem } from 'lottie-web';

type Sender = 'user' | 'bot' | 'system' | 'typing';

interface MsgImage {
  url: string;
  thumbUrl?: string;
  name?: string;
  sizeKB?: number;
}
interface MsgDoc {
  url: string;
  name: string;
  sizeKB?: number;
}
interface Message {
  id: string;
  text?: string | null;
  sender: Sender;
  createdAt: Date;
  images?: MsgImage[];
  docs?: MsgDoc[];
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
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;

  // Hidden inputs used for attachment picking (kept for other parts of the app)
  @ViewChild('imgInput') imgInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('docInput') docInputRef!: ElementRef<HTMLInputElement>;

  title = 'Frontend';

  // composer state (legacy UI not shown in voice overlay)
  text = '';
  attachCount = 0;

  // chat state (kept)
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

  // attach menu (kept)
  isAttachOpen = false;
  pendingPick: 'images' | 'docs' | null = null;
  imagesSelected: File[] = [];
  docsSelected: File[] = [];
  ttsEnabled = false;

  // previews (kept)
  imagePreviews: { url: string; name: string; sizeKB: number }[] = [];
  docPreviews:   { url: string; name: string; ext: string; sizeKB: number }[] = [];

  // Composer recorder (not used by overlay loop, kept for rest of app)
  isRecording = false;              // shared flag (overlay also uses this)
  isRecUI = false;
  private audioStream?: MediaStream;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  lastAudioUrl: string | null = null;

  recognition?: any;                // SpeechRecognition instance (shared)
  sttSupported = false;
  sttLang = 'en-IN';
  interimTranscript = '';
  finalTranscript = '';

  recStartMs = 0;
  recElapsedMs = 0;
  private recTimerId: any = null;

  waveBars = new Array(14);
  chatOpen = true;

  /* =========================
     Voice-to-Voice Overlay state
     ========================= */
  showVoiceOverlay = false;
  isSpeaking = false;
  isConversing = false;            // overall loop state
  private resumeAfterTTS = false;  // guard: only restart recognition after TTS ends

  selectedGender: 'male' | 'female' = 'female';
  allVoices: SpeechSynthesisVoice[] = [];
  femaleVoice: SpeechSynthesisVoice | null = null;
  maleVoice: SpeechSynthesisVoice | null = null;

  private currentUtterance?: SpeechSynthesisUtterance;

  ngAfterViewInit(): void { this.scrollCanvasToBottom(); }

  ngOnDestroy(): void {
    // Clean up any created object URLs
    this.revokeImagePreviews();
    this.revokeDocPreviews();
    if (this.lastAudioUrl) { try { URL.revokeObjectURL(this.lastAudioUrl); } catch {} }
    // Stop voice things if component gets destroyed
    this.stopConversation();
  }

  onClose(): void { this.chatOpen = false; }

  /* ===== Lottie (kept) ===== */
  botAvatarOpts: AnimationOptions = {
    path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true
  };
  botTypingOpts: AnimationOptions = {
    path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true
  };
  brandLottieOpts: AnimationOptions = {
    path: 'assets/lottie/bluebot.json', renderer: 'svg', autoplay: true, loop: true
  };
  onBrandAnimCreated(anim: AnimationItem) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) anim.pause();
  }

  /* ===== Header actions (kept) ===== */
  onRefresh(): void {
    this.messages = [
      { id: this.uuid(), text: "Hello! Welcome to Tunningspot . I'm your virtual assistant. How can I help you today?", sender: 'bot', createdAt: new Date() }
    ];
    this.userTyping = false;
    this.text = '';
    this.lastAudioUrl = null;
    this.imagesSelected = [];
    this.docsSelected = [];
    this.ttsEnabled = false;
    this.isAttachOpen = false;

    this.revokeImagePreviews();
    this.revokeDocPreviews();
    this.scrollCanvasToBottom();
  }

  /* ===== Attach popover (kept) ===== */
  toggleAttachMenu(): void { this.isAttachOpen = !this.isAttachOpen; }
  closeAttachMenu(): void { this.isAttachOpen = false; }
  pickImages(): void {
    this.pendingPick = 'images';
    if (this.imgInputRef?.nativeElement) {
      this.imgInputRef.nativeElement.accept = 'image/*';
      this.imgInputRef.nativeElement.click();
    }
  }
  pickDocs(): void {
    this.pendingPick = 'docs';
    if (this.docInputRef?.nativeElement) {
      this.docInputRef.nativeElement.accept = '.pdf,.doc,.docx,.txt,.xls,.xlsx';
      this.docInputRef.nativeElement.click();
    }
  }
  enableTTS(): void { this.ttsEnabled = true; this.closeAttachMenu(); }
  disableTTS(): void { this.ttsEnabled = false; }
  clearImages(): void { this.revokeImagePreviews(); this.imagesSelected = []; }
  clearDocs(): void { this.revokeDocPreviews(); this.docsSelected = []; }

  public onImagesSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.imagesSelected = files;
    this.buildImagePreviews(files);
    this.isAttachOpen = false;
    input.value = '';
  }
  public onDocsSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.docsSelected = files;
    this.buildDocPreviews(files);
    this.isAttachOpen = false;
    input.value = '';
  }

  private buildImagePreviews(files: File[]) {
    this.revokeImagePreviews();
    this.imagePreviews = files.map(f => ({
      url: URL.createObjectURL(f),
      name: f.name,
      sizeKB: Math.max(1, Math.round(f.size / 1024))
    }));
  }
  private revokeImagePreviews() {
    for (const p of this.imagePreviews) { try { URL.revokeObjectURL(p.url); } catch {} }
    this.imagePreviews = [];
  }
  private buildDocPreviews(files: File[]) {
    this.revokeDocPreviews();
    this.docPreviews = files.map(f => ({
      url: URL.createObjectURL(f),
      name: f.name,
      ext: (f.name.split('.').pop() || '').toLowerCase(),
      sizeKB: Math.max(1, Math.round(f.size / 1024))
    }));
  }
  private revokeDocPreviews() {
    for (const d of this.docPreviews) { try { URL.revokeObjectURL(d.url); } catch {} }
    this.docPreviews = [];
  }

  /* ===== Composer chip recorder (kept; not used in overlay loop) ===== */
  async onMicClick() {
    if (this.isRecUI) return;
    await this.startRecordingUI();
  }
  private async startRecordingUI() {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert('Microphone permission denied or unsupported.');
      return;
    }

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

    this.isRecUI = true;
    this.isRecording = true;
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.recStartMs = Date.now();
    this.recElapsedMs = 0;
    this.recTimerId = setInterval(() => { this.recElapsedMs = Date.now() - this.recStartMs; }, 250);
  }
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

  get recElapsedLabel(): string {
    const s = Math.floor(this.recElapsedMs / 1000);
    const m = Math.floor(s / 60);
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

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

  onUserTyping(): void {
    this.userTyping = true;
    if (this.userTypingTimer) clearTimeout(this.userTypingTimer);
    this.userTypingTimer = setTimeout(() => { this.userTyping = false; }, 800);
  }
  stopUserTyping(immediate = false): void {
    if (this.userTypingTimer) { clearTimeout(this.userTypingTimer); this.userTypingTimer = null; }
    if (immediate) this.userTyping = false;
  }

  send() {
    const trimmed = this.text.trim();

    const hasImages = this.imagePreviews.length > 0;
    const hasDocs   = this.docPreviews.length   > 0;
    const hasText   = !!trimmed;

    if (!hasText && !hasImages && !hasDocs) return;

    if (this.isRecUI) this.cancelRecording();
    this.stopUserTyping(true);

    const images: MsgImage[] = hasImages
      ? this.imagePreviews.map(p => ({ url: p.url, thumbUrl: p.url, name: p.name, sizeKB: p.sizeKB }))
      : [];

    const docs: MsgDoc[] = hasDocs
      ? this.docPreviews.map(d => ({ url: d.url, name: d.name, sizeKB: d.sizeKB }))
      : [];

    this.push({
      id: this.uuid(),
      text: hasText ? trimmed : null,
      images: images.length ? images : undefined,
      docs: docs.length ? docs : undefined,
      sender: 'user',
      createdAt: new Date()
    });

    this.text = '';
    this.attachCount = 0;
    this.imagesSelected = [];
    this.docsSelected = [];
    this.isAttachOpen = false;

    this.imagePreviews = [];
    this.docPreviews = [];

    this.showBotTyping();
    setTimeout(() => {
      this.hideBotTyping();
      const reply = this.generateReply(trimmed);
      this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });

      if (this.ttsEnabled && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(reply);
        u.lang = 'en-IN';
        window.speechSynthesis.speak(u);
      }
    }, 900);
  }

  public get imgCount(): number { return this.imagePreviews.length; }
  public get docCount(): number { return this.docPreviews.length; }

  public get showAttachMenu(): boolean { return this.isAttachOpen; }
  public set showAttachMenu(v: boolean) { this.isAttachOpen = v; }

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

  openImage(img: MsgImage) { try { window.open(img.url, '_blank'); } catch {} }

  private generateReply(q: string): string {
    const t = (q || '').toLowerCase();
    if (t.includes('price') || t.includes('pricing')) return 'Starter ₹0, Pro ₹1,999/mo, Business ₹6,999/mo.';
    if (t.includes('refund')) return 'Refunds within 7 days if unused; otherwise prorated.';
    if (t.includes('help') || t.includes('support')) return 'Sure—tell me what you’re stuck on.';
    if (t.includes('hello') || t.includes('hi')) return 'Hi! 👋 How can I assist you today?';
    return 'Got it. Could you share a bit more detail?';
  }

  private uuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  /* =========================
     Voice-to-Voice Overlay: auto loop
     ========================= */

  // Open overlay and auto-start listening
  openVoiceOverlay() {
    this.closeAttachMenu();
    this.showVoiceOverlay = true;
    this.loadVoices();
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.startConversation(); // auto start
  }

  // Close overlay and stop everything
  closeVoiceOverlay() {
    this.stopConversation();
    this.showVoiceOverlay = false;
  }

  setGender(g: 'male' | 'female') { this.selectedGender = g; }

  loadVoices() {
    try {
      const synth = window.speechSynthesis;
      const pick = () => {
        this.allVoices = synth.getVoices() || [];
        const en = this.allVoices.filter(v => /en[-_]/i.test(v.lang));
        const fallback = this.allVoices[0] ?? null;

        this.femaleVoice =
          (en.find(v => /female|woman|salli|joanna|olivia|natalie/i.test(v.name)) ??
           en[0] ?? fallback);

        this.maleVoice =
          (en.find(v => /male|man|matthew|joey|brian|adam|david/i.test(v.name)) ??
           en[1] ?? this.allVoices[1] ?? this.femaleVoice ?? fallback);
      };
      pick();
      if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = () => pick();
    } catch {}
  }

  /* Conversation loop: listen → reply (TTS) → listen */
  private startConversation() {
    if (this.isConversing) return;
    this.isConversing = true;
    this.resumeAfterTTS = false;
    this.startRecognitionOnce();
  }

  private stopConversation() {
    this.isConversing = false;
    this.resumeAfterTTS = false;
    this.stopRecognition();
    this.stopSpeaking();
  }

  private startRecognitionOnce() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.speak("Sorry, your browser doesn't support speech recognition.");
      this.isConversing = false;
      return;
    }

    // ensure any previous instance is closed
    this.stopRecognition();

    const rec = new SR();
    rec.lang = this.sttLang;
    rec.interimResults = false;  // no partials
    rec.continuous = false;      // one utterance
    // rec.maxAlternatives = 1;   // optional: uncomment if supported

    rec.onstart = () => { this.isRecording = true; };

    rec.onresult = async (e: any) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      finalText = finalText.trim();

      // We are going to speak, so don't auto-restart from onend
      this.resumeAfterTTS = true;
      this.stopRecognition();

      if (finalText) {
        const reply = await this.callBot(finalText);
        this.speak(reply || 'Sorry, I did not get that.');
      } else {
        // Nothing captured; allow normal onend restart
        this.resumeAfterTTS = false;
        if (this.isConversing && !this.isSpeaking) this.startRecognitionOnce();
      }
    };

    rec.onerror = () => {
      this.isRecording = false;
      // If error happened not during planned TTS handoff, try again
      if (this.isConversing && !this.isSpeaking && !this.resumeAfterTTS) {
        setTimeout(() => this.startRecognitionOnce(), 400);
      }
    };

    rec.onend = () => {
      this.isRecording = false;
      // If we stopped intentionally to speak, onend should NOT restart.
      if (this.isConversing && !this.isSpeaking && !this.resumeAfterTTS) {
        this.startRecognitionOnce();
      }
    };

    this.recognition = rec;
    try { rec.start(); } catch {}
  }

  private stopRecognition() {
    try { this.recognition?.stop(); } catch {}
    this.recognition = undefined;
    this.isRecording = false;
  }

  private speak(text: string) {
    if (!text) return;
    this.stopSpeaking();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1; utter.pitch = 1; utter.volume = 1;

    const chosen = this.selectedGender === 'female' ? this.femaleVoice : this.maleVoice;
    utter.voice = chosen ?? null;

    utter.onstart = () => { this.isSpeaking = true; };

    utter.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = undefined;
      // planned handoff completed; allow recognition to resume
      if (this.isConversing) {
        this.resumeAfterTTS = false;
        // small delay improves stability on some browsers
        setTimeout(() => { if (this.isConversing) this.startRecognitionOnce(); }, 150);
      }
    };

    utter.onerror = () => {
      this.isSpeaking = false;
      this.currentUtterance = undefined;
      if (this.isConversing) {
        this.resumeAfterTTS = false;
        setTimeout(() => { if (this.isConversing) this.startRecognitionOnce(); }, 150);
      }
    };

    this.currentUtterance = utter;
    window.speechSynthesis.speak(utter);
  }

  private stopSpeaking() {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    this.isSpeaking = false;
    this.currentUtterance = undefined;
  }

  // Replace with your real backend call
  private async callBot(userText: string): Promise<string> {
    const t = userText.toLowerCase();
    if (t.includes('price') || t.includes('pricing')) return 'Starter zero rupees, Pro one thousand nine hundred ninety nine per month, and Business six thousand nine hundred ninety nine per month.';
    if (t.includes('hello') || t.includes('hi')) return 'Hi! How can I help you?';
    return `You said: ${userText}. This is a demo reply.`;
  }

  /* ---- (optional) template aliases kept for compatibility ---- */
  get interimText(): string { return this.interimTranscript; }
  set interimText(v: string) { this.interimTranscript = v; }
  get finalText(): string { return this.finalTranscript; }
  set finalText(v: string) { this.finalTranscript = v; }
}


