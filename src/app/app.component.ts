import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

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
export class AppComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

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

  // Audio recording + STT
  isRecording = false;              // for mic button visual
  isRecUI = false;                  // whether chip replaces input
  private audioStream?: MediaStream;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  lastAudioUrl: string | null = null;

  recognition?: any;                // SpeechRecognition instance
  sttSupported = false;
  sttLang = 'en-IN';                // change if needed
  interimTranscript = '';
  finalTranscript = '';

  // Timer
  recStartMs = 0;
  recElapsedMs = 0;
  private recTimerId: any = null;

  // simple bars for the fake wave
  waveBars = new Array(14);

  ngAfterViewInit(): void {
    this.scrollCanvasToBottom();
  }

  /* ===== Header actions ===== */
  onRefresh(): void {
    this.messages = [
      { id: this.uuid(), text: "Hello! I’m your assistant. How can I help you today?", sender: 'bot', createdAt: new Date() }
    ];
    this.userTyping = false;
    this.text = '';
    this.lastAudioUrl = null;
    this.scrollCanvasToBottom();
  }

  chatOpen = true;
  onClose(): void { this.chatOpen = false; }

  /* ===== Files ===== */
  openFilePicker() { this.fileInputRef.nativeElement.click(); }
  onFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    this.attachCount = input.files?.length ?? 0;
  }

  /* ===== Mic button ===== */
  async onMicClick() {
    if (this.isRecUI) {
      // already recording; do nothing (user will press × or ✓)
      return;
    }
    await this.startRecordingUI();
  }

  /* ===== Start Recording + STT ===== */
  private async startRecordingUI() {
    // 1) get mic audio
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      alert('Microphone permission denied or unsupported.');
      return;
    }

    // 2) MediaRecorder for audio blob
    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(this.audioStream);
    this.mediaRecorder.ondataavailable = (ev) => { if (ev.data.size > 0) this.audioChunks.push(ev.data); };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.lastAudioUrl = URL.createObjectURL(blob);
      // stop tracks
      this.audioStream?.getTracks().forEach(t => t.stop());
      this.audioStream = undefined;
      this.isRecording = false;
    };
    this.mediaRecorder.start();

    // 3) STT live
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
          if (res.isFinal) {
            this.finalTranscript += res[0].transcript + ' ';
          } else {
            interim += res[0].transcript;
          }
        }
        this.interimTranscript = interim.trim();
      };
      this.recognition.onerror = (e: any) => {
        // keep recording; just no STT
        console.warn('STT error', e);
      };
      this.recognition.onend = () => {
        // Chrome may auto-end on silence; if still recording, restart
        if (this.isRecUI) {
          try { this.recognition.start(); } catch {}
        }
      };
      try { this.recognition.start(); } catch {}
    }

    // 4) show chip + timer
    this.isRecUI = true;
    this.isRecording = true;
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.recStartMs = Date.now();
    this.recElapsedMs = 0;
    this.recTimerId = setInterval(() => {
      this.recElapsedMs = Date.now() - this.recStartMs;
    }, 250);
  }

  /* ===== Cancel / Confirm ===== */
  cancelRecording() {
    // stop STT
    try { this.recognition?.stop(); } catch {}
    this.recognition = undefined;

    // stop MediaRecorder (will set lastAudioUrl in onstop, but we discard)
    try { this.mediaRecorder?.stop(); } catch {}
    this.mediaRecorder = undefined;

    // discard audio preview
    if (this.lastAudioUrl) {
      URL.revokeObjectURL(this.lastAudioUrl);
      this.lastAudioUrl = null;
    }

    // clear timer & UI
    if (this.recTimerId) { clearInterval(this.recTimerId); this.recTimerId = null; }
    this.isRecUI = false;
    this.isRecording = false;
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.recElapsedMs = 0;
  }

  confirmRecording() {
    // stop STT
    try { this.recognition?.stop(); } catch {}
    this.recognition = undefined;

    // stop MediaRecorder; keep the audio preview link
    try { this.mediaRecorder?.stop(); } catch {}
    this.mediaRecorder = undefined;

    // clear timer & UI
    if (this.recTimerId) { clearInterval(this.recTimerId); this.recTimerId = null; }
    this.isRecUI = false;
    this.isRecording = false;

    // put transcript into the input (user clicks Send to submit)
    const textOut = (this.finalTranscript || this.interimTranscript || '').trim();
    this.text = textOut;

    // reset interim buffers
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.recElapsedMs = 0;
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
    if (!msg && !this.lastAudioUrl && this.attachCount === 0) return;

    // If recording UI was open, ensure it’s closed
    if (this.isRecUI) this.cancelRecording();

    // user stops typing
    this.stopUserTyping(true);

    // Push user text bubble if present
    if (msg) {
      this.push({ id: this.uuid(), text: msg, sender: 'user', createdAt: new Date() });
    }

    // Optional system note for audio/attachments
    if (!msg && (this.lastAudioUrl || this.attachCount > 0)) {
      this.push({
        id: this.uuid(),
        text: this.attachCount > 0 ? `📎 ${this.attachCount} attachment(s) selected` : '🎤 Voice message recorded',
        sender: 'system',
        createdAt: new Date()
      });
    }

    // Reset composer bits (keep lastAudioUrl so helper shows preview)
    this.text = '';
    this.attachCount = 0;
    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';

    // Bot typing…
    this.showBotTyping();
    setTimeout(() => {
      this.hideBotTyping();
      const reply = this.generateReply(msg);
      this.push({ id: this.uuid(), text: reply, sender: 'bot', createdAt: new Date() });
      // clear audio after “sending” if you don’t want it to persist:
      // if (this.lastAudioUrl) { URL.revokeObjectURL(this.lastAudioUrl); this.lastAudioUrl = null; }
    }, 900);
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
