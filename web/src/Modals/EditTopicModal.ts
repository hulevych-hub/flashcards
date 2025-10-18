import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { StoreService } from '../state/store.service';
import { finalize } from 'rxjs/operators';
import { Topic } from '../models/Topics';

@Component({
  selector: 'app-edit-topic-modal',
  standalone: true,
  imports: [NgIf, FormsModule],
  template: `
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" (click)="onBackdrop($event)">
    <div class="card w-full max-w-md" (click)="$event.stopPropagation()">
      <h3 class="text-lg font-semibold mb-3">{{ topicId != null ? 'Edit' : 'New' }} topic</h3>

      <label class="label">Name</label>
      <input class="input" [(ngModel)]="name" placeholder="e.g. Biology" />

      <div *ngIf="nameClash()" class="mt-2 text-sm text-red-600">
        A topic with this name already exists.
      </div>

      <div class="mt-4 flex justify-end gap-2">
  <button class="btn-ghost" (click)="close(false)" [disabled]="saving">Cancel</button>
  <button
    class="btn-primary inline-flex items-center gap-2"
    [disabled]="!canSave() || saving"
    [attr.aria-busy]="saving ? 'true' : 'false'"
    (click)="save()">
    <svg *ngIf="saving" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
    <span>{{ saving ? 'Saving…' : 'Save' }}</span>
  </button>
</div>
    </div>
  </div>
  `
})
export class EditTopicModal {
  @Input() topicId: number | null = null;
  @Output() closed = new EventEmitter<boolean>();

  name = '';
  saving = false;

  constructor(private api: ApiService, private store: StoreService) {}

  ngOnInit() {
    if (this.topicId != null) {
      const t = this.store.topics().find(x => x.id === this.topicId);
      if (t) {
        this.name = t.description ?? '';
        this.topicId = t.id ?? null;
      }
    }
  }

  onBackdrop(_: MouseEvent) { if (!this.saving) this.close(false); }

  // ---------- validation ----------
  private norm(s: string) {
    return (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  nameClash(): boolean {
    const me = this.topicId;
    const n = this.norm(this.name);
    if (!n) return false;
    return this.store.topics().some(t => this.norm(t.description) === n && t.id !== me);
  }

  canSave(): boolean {
    return this.norm(this.name).length > 0 && !this.nameClash();
  }
  // --------------------------------

  save() {
    if (!this.canSave() || this.saving) return;
    this.saving = true;

    const payload : Topic = {
      id: this.topicId !== 0 && this.topicId != null ? this.topicId : null,
      description: this.name.trim()
    };

    this.api.updateTopic(payload)
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: () => this.close(true),
        error: () => { /* keep modal open; button re-enables via finalize */ }
      });
  }

  close(refresh: boolean) { this.closed.emit(refresh); }
}
