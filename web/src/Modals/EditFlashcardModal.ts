import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../services/api.service';
import { StoreService } from '../state/store.service';
import { Flashcard } from '../models/Flashcard';

@Component({
  selector: 'app-edit-flashcard-modal',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  template: `
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" (click)="onBackdrop($event)">
    <div class="card w-full max-w-2xl" (click)="$event.stopPropagation()">
      <div class="flex items-start justify-between gap-4">
        <h3 class="text-lg font-semibold">
          {{ flashcardId ? (viewOnly ? 'View' : 'Edit') : 'New' }} flashcard
        </h3>
        <button class="btn-ghost" *ngIf="viewOnly && !saving" (click)="toggleEdit()">Edit</button>
      </div>

      <div class="grid gap-4 mt-4">
        <!-- Question -->
        <div>
          <label class="label">Question <span class="text-rose-600">*</span></label>
          <textarea class="input h-24" [(ngModel)]="question" [readonly]="isReadOnly() || saving"></textarea>
          <div *ngIf="!validQuestion()" class="mt-1 text-sm text-rose-600">Question is required.</div>
        </div>

        <!-- Answer -->
        <div>
          <label class="label">Answer <span class="text-rose-600">*</span></label>
          <textarea class="input h-24" [(ngModel)]="answer" [readonly]="isReadOnly() || saving"></textarea>
          <div *ngIf="!validAnswer()" class="mt-1 text-sm text-rose-600">Answer is required.</div>
        </div>

        <!-- Topic & Rating -->
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="label">Topic</label>
            <select class="select" [(ngModel)]="topicId" [disabled]="isReadOnly() || saving">
              <option [ngValue]="null">—</option>
              <option *ngFor="let t of store.topics()" [ngValue]="t.id">{{ t.description }}</option>
            </select>
          </div>
          <div>
            <label class="label">Rating</label>
            <select class="select" [(ngModel)]="ratingId" [disabled]="isReadOnly() || saving">
              <option [ngValue]="null">—</option>
              <option *ngFor="let r of store.ratings()" [ngValue]="r.id">{{ r.description }}</option>
            </select>
          </div>
        </div>

        <!-- Images: filename + uploader (click or drag & drop) -->
        <div class="grid md:grid-cols-2 gap-6">
          <!-- Question image -->
<div>
  <label class="label">Question Image Name</label>

  <div class="flex gap-2 mb-1 items-center">
    <input class="input flex-1"
           placeholder="filename (e.g. portrait)"
           [(ngModel)]="questionFileName"
           [readonly]="isReadOnly() || saving"
           [disabled]="isReadOnly() || saving || !hasQuestionImageAttached()" />
    <button class="btn-ghost" type="button"
            (click)="triggerPick('question')"
            [disabled]="isReadOnly() || saving">Choose</button>

    <!-- Trash-can to remove selected image -->
    <button *ngIf="hasQuestionImageAttached()"
            class="btn-ghost p-2"
            type="button"
            (click)="removeImage('question')"
            [disabled]="isReadOnly() || saving"
            title="Remove question image"
            aria-label="Remove question image">
      <!-- tiny inline SVG icon -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6M14 11v6"></path>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>

    <input #qInput type="file" accept="image/*" class="hidden"
           (change)="onFileInput('question', $event)">
  </div>

  <!-- filename required if an image is attached -->
  <div *ngIf="hasQuestionImageAttached() && !validQuestionFileName()"
       class="mt-1 text-xs text-rose-600">
    Please enter a file name for the question image.
  </div>

  <div class="dropzone"
     [class.dropzone--disabled]="isReadOnly() || saving"
     (click)="triggerPick('question')"
     (dragover)="onDragOver($event)"
     (dragleave)="onDragLeave($event)"
     (drop)="onDrop('question', $event)">
  <div class="text-sm opacity-70">Drag & drop an image here, or click to choose.</div>
</div>

  <div *ngIf="questionPreviewDataUrl" class="mt-2 rounded-xl border border-zinc-200 p-2 bg-white">
    <img [src]="questionPreviewDataUrl" alt="Question preview"
         class="h-40 w-full object-contain rounded-lg" />
  </div>
</div>

<!-- Answer image -->
<div>
  <label class="label">Answer Image Name</label>

  <div class="flex gap-2 mb-1 items-center">
    <input class="input flex-1"
           placeholder="filename (e.g. solution)"
           [(ngModel)]="answerFileName"
           [readonly]="isReadOnly() || saving"
           [disabled]="isReadOnly() || saving || !hasAnswerImageAttached()" />
    <button class="btn-ghost" type="button"
            (click)="triggerPick('answer')"
            [disabled]="isReadOnly() || saving">Choose</button>

    <!-- Trash-can -->
    <button *ngIf="hasAnswerImageAttached()"
            class="btn-ghost p-2"
            type="button"
            (click)="removeImage('answer')"
            [disabled]="isReadOnly() || saving"
            title="Remove answer image"
            aria-label="Remove answer image">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6M14 11v6"></path>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>

    <input #aInput type="file" accept="image/*" class="hidden"
           (change)="onFileInput('answer', $event)">
  </div>

  <div *ngIf="hasAnswerImageAttached() && !validAnswerFileName()"
       class="mt-1 text-xs text-rose-600">
    Please enter a file name for the answer image.
  </div>

  <div class="dropzone"
     [class.dropzone--disabled]="isReadOnly() || saving"
     (click)="triggerPick('answer')"
     (dragover)="onDragOver($event)"
     (dragleave)="onDragLeave($event)"
     (drop)="onDrop('answer', $event)">
  <div class="text-sm opacity-70">Drag & drop an image here, or click to choose.</div>
</div>

  <div *ngIf="answerPreviewDataUrl" class="mt-2 rounded-xl border border-zinc-200 p-2 bg-white">
    <img [src]="answerPreviewDataUrl" alt="Answer preview"
         class="h-40 w-full object-contain rounded-lg" />
  </div>
</div>

        </div>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <button class="btn-ghost inline-flex items-center gap-2" (click)="close(false)" [disabled]="saving">
          <span>{{ saving ? 'Please wait…' : 'Close' }}</span>
        </button>

        <button class="btn-primary inline-flex items-center gap-2"
                *ngIf="!isReadOnly()"
                (click)="save()"
                [disabled]="!canSave() || saving"
                [attr.aria-busy]="saving ? 'true' : null">
          <span *ngIf="saving" class="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
          <span>{{ saving ? 'Saving…' : 'Save' }}</span>
        </button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .dropzone {
      border: 1.5px dashed #d4d4d8; /* zinc-300 */
      border-radius: 0.75rem;       /* rounded-xl */
      padding: 1rem;
      background: #fafafa;
      text-align: center;
      transition: border-color 120ms ease, background 120ms ease;
    }
    .dropzone.dragover { border-color: #3b82f6; background: #eff6ff; } /* blue-500/50 */
    .dropzone--disabled { opacity: .6; pointer-events: none; }
  `]
})
export class EditFlashcardModal {
  @Input() flashcardId: number | null = null;
  @Input() notiondId: string | null = null;
  @Input() viewOnly = false;
  @Output() closed = new EventEmitter<boolean>();

  @ViewChild('qInput') qInput!: ElementRef<HTMLInputElement>;
  @ViewChild('aInput') aInput!: ElementRef<HTMLInputElement>;

  // core fields
  question = '';
  answer = '';
  topicId: number | null = null;
  ratingId: number | null = null;

  // filenames to persist (editable)
  questionFileName: string | null = null;
  answerFileName: string | null = null;

  // base64 data URIs to send (not persisted in DB)
  private questionDataUri: string | null = null;
  private answerDataUri: string | null = null;

  // preview (use the same data URIs)
  questionPreviewDataUrl: string | null = null;
  answerPreviewDataUrl: string | null = null;

  saving = false;

  private api = inject(ApiService);
  public store = inject(StoreService);

  ngOnInit() {
    if (this.flashcardId != null) {
      const f = this.store.flashcards().find(x => Number(x.id) === Number(this.flashcardId));
      if (f) {
        this.question = f.question ?? '';
        this.answer = f.answer ?? '';
        this.topicId = (f.topicId as any) ?? null;
        this.ratingId = (f.ratingId as any) ?? null;

        // from API: DB stores the filename strings
        this.questionFileName = (f.questionFileName as any) ?? null;
        this.answerFileName = (f.answerFileName as any) ?? null;

        // from API: if backend returns inline base64 for existing files, show them
        if (f.questionImage) {
          this.questionPreviewDataUrl = f.questionImage;
          this.questionDataUri = f.questionImage;
        }
        if (f.answerImage) {
          this.answerPreviewDataUrl = f.answerImage;
          this.answerDataUri = f.answerImage;
        }
      }
    }
  }

  hasQuestionImageAttached() { return !!this.questionDataUri; }
hasAnswerImageAttached()   { return !!this.answerDataUri; }

validQuestionFileName() {
  if (!this.hasQuestionImageAttached()) return true;
  return !!this.norm(this.questionFileName);
}
validAnswerFileName() {
  if (!this.hasAnswerImageAttached()) return true;
  return !!this.norm(this.answerFileName);
}

  // ----- UI state helpers -----
  isReadOnly() { return this.viewOnly; }
  toggleEdit() { if (!this.saving) this.viewOnly = false; }
  onBackdrop(_: MouseEvent) { if (!this.saving) this.close(false); }

  private norm(s?: string | null) { return (s ?? '').trim(); }
  validQuestion() { return this.norm(this.question).length > 0; }
  validAnswer()  { return this.norm(this.answer).length > 0; }
  canSave() {
  return this.validQuestion()
      && this.validAnswer()
      && this.validQuestionFileName()
      && this.validAnswerFileName();
}

removeImage(which: 'question' | 'answer') {
  if (which === 'question') {
    this.questionDataUri = null;
    this.questionPreviewDataUrl = null;
    this.questionFileName = null;   // wipe name when no picture
  } else {
    this.answerDataUri = null;
    this.answerPreviewDataUrl = null;
    this.answerFileName = null;     // wipe name when no picture
  }
}

  // ----- File picking / drag & drop -----
  triggerPick(which: 'question' | 'answer') {
  if (this.isReadOnly() || this.saving) return;
  const el = which === 'question'
    ? this.qInput?.nativeElement
    : this.aInput?.nativeElement;

  // Clear the value so picking the same file again still fires (change) event
  if (el) { el.value = ''; el.click(); }
}

  onFileInput(which: 'question' | 'answer', e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (files && files[0]) this.handlePickedFile(which, files[0]);
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.classList.add('dragover');
  }
  onDragLeave(e: DragEvent) {
    const el = e.currentTarget as HTMLElement;
    el.classList.remove('dragover');
  }
  onDrop(which: 'question' | 'answer', e: DragEvent) {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) this.handlePickedFile(which, f);
  }

  private baseNameNoExt(name: string): string {
  const only = name.split(/[\\/]/).pop() || name; // strip any path
  const dot = only.lastIndexOf('.');
  return dot > 0 ? only.slice(0, dot) : only;     // remove extension if present
}

  private async handlePickedFile(which: 'question' | 'answer', file: File) {
  if (!file.type.startsWith('image/')) return;
  const dataUrl = await this.readAsDataUrl(file);
  const baseNoExt = this.baseNameNoExt(file.name);

  if (which === 'question') {
    this.questionDataUri = dataUrl;
    this.questionPreviewDataUrl = dataUrl;
    // auto-fill only if empty
    if (!this.norm(this.questionFileName)) this.questionFileName = baseNoExt;
  } else {
    this.answerDataUri = dataUrl;
    this.answerPreviewDataUrl = dataUrl;
    if (!this.norm(this.answerFileName)) this.answerFileName = baseNoExt;
  }
}

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(file);
    });
  }

  private cleanFileName(name: string): string {
    const onlyName = name.split(/[\\/]/).pop() || name;
    // (Optional) normalize spaces etc.
    return onlyName.trim();
    // You could also lowercase the extension: 
    // const ext = onlyName.includes('.') ? '.' + onlyName.split('.').pop()!.toLowerCase() : '';
  }

  // ----- Save -----
  save() {
    if (!this.canSave() || this.saving) return;
    this.saving = true;

    // Build payload according to your backend DTO:
    // - questionImage / answerImage => base64 data URIs (or null if none)
    // - questionFileName / answerFileName => user-editable strings
    const payload: Partial<Flashcard> = {
      id: this.flashcardId !== 0 && this.flashcardId != null ? this.flashcardId : null,
      question: this.question.trim(),
      answer: this.answer.trim(),
      topicId: this.topicId !== 0 && this.topicId != null ? this.topicId : null,
      ratingId: this.ratingId !== 0 && this.ratingId != null ? this.ratingId : null,

      questionImage: this.questionDataUri ?? null,
      answerImage: this.answerDataUri ?? null,
      questionFileName: this.norm(this.questionFileName) || null,
      answerFileName: this.norm(this.answerFileName) || null,
    };

    this.api.updateFlashcard(payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => this.close(true),
        error: () => { /* keep modal open; buttons re-enable */ }
      });
  }

  close(refresh: boolean) { this.closed.emit(refresh); }
}