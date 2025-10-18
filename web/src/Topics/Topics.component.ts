import { Component, computed, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ApiService } from '../services/api.service';
import { StoreService } from '../state/store.service';
import { EditTopicModal } from '../Modals/EditTopicModal';
import { finalize } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-topics',
  standalone: true,
  imports: [NgIf, NgFor, EditTopicModal],
  templateUrl: './Topics.html',
  styleUrl: './Topics.scss'
})
export class TopicsComponent {
  // busy flags
  loading = signal(false);
  deleting = signal(false);

  // modal state
  showModal = signal(false);
  editingId = signal<number | null>(null);

  // selection state for bulk delete
  private _selection = signal<Set<number>>(new Set());
  readonly selection = computed(() => this._selection()); // expose as readonly

  /** topicId -> # of flashcards using it */
  readonly topicUsage = computed(() => {
    const m = new Map<number, number>();
    for (const f of this.store.flashcards()) {
      if (f.topicId != null) {
        const k = Number(f.topicId);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return m;
  });

  /** true while we should disable all buttons/inputs */
  readonly uiBusy = computed(() => this.loading() || this.deleting());

  /** selected ids that are *deletable* (not used by flashcards) */
  readonly deletableSelected = computed(() =>
    Array.from(this.selection()).filter(id => this.canDeleteTopic(id))
  );

  constructor(public api: ApiService, public store: StoreService) {
    this.load();
  }

  load() {
    this.loading.set(true);
    forkJoin({
      topics: this.api.fetchTopics(),
      flashcards: this.api.fetchFlashcards()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ topics, flashcards }) => {
          this.store.topics.set(topics);
          var teste = this.store.topics();
          this.store.flashcards.set(flashcards);
          // prune selection to still-existing ids
          const ids = new Set(topics.map(t => t.id ?? -1));
          const kept = new Set(Array.from(this.selection()).filter(id => ids.has(id)));
          this._selection.set(kept);
        },
        error: () => { /* optional toast */ }
      });
  }

  // ---------- selection helpers ----------
  isSelected(id: number) { return this.selection().has(id); }

  onSelect(id: number, checked: boolean) {
    const s = new Set(this.selection());
    checked ? s.add(id) : s.delete(id);
    this._selection.set(s);
  }

  clearSelection() { this._selection.set(new Set()); }

  selectAllDeletable() {
    const s = new Set<number>();
    for (const t of this.store.topics()) {
      const id = t.id ?? 0;
      if (this.canDeleteTopic(id)) s.add(id);
    }
    this._selection.set(s);
  }

  // ---------- CRUD ----------
  openCreate() { this.editingId.set(null); this.showModal.set(true); }
  openEdit(id: number) { this.editingId.set(id); this.showModal.set(true); }
  closeModal(refresh = false) { this.showModal.set(false); if (refresh) this.load(); }

  canDeleteTopic(id: number): boolean {
    return (this.topicUsage().get(id) ?? 0) === 0;
  }

  deleteOne(id: number) {
    this.deleting.set(true);
    this.api.deleteTopics([id])
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe(() => {
        // also unselect after delete
        const s = new Set(this.selection()); s.delete(id); this._selection.set(s);
        this.load();
      });
  }

  deleteSelected() {
    if (this.uiBusy()) return;
    const ids = this.deletableSelected();
    if (!ids.length) return;

    this.deleting.set(true);
    this.api.deleteTopics(ids)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe(() => {
        this.clearSelection();
        this.load();
      });
  }
}
