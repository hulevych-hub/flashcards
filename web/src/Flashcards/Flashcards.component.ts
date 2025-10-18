import { Component, computed, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ApiService } from '../services/api.service';
import { StoreService } from '../state/store.service';
import { EditFlashcardModal } from '../Modals/EditFlashcardModal';
import { Topic } from '../models/Topics';
import { Flashcard } from '../models/Flashcard';

@Component({
  selector: 'app-flashcards',
  standalone: true,
  imports: [NgIf, NgFor, EditFlashcardModal],
  templateUrl: './Flashcards.html',
  styleUrl: './Flashcards.scss',
})
export class FlashcardsComponent {
  loading = signal(true);
  deleting = signal(false);

  showModal = signal(false);
  readonly viewOnlyId = signal<number | null>(null);
  editingId = signal<number | null>(null);

  // --- Filter UI state ---
  topicMenuOpen = signal(false);
  ratingMenuOpen = signal(false);
  selectedTopicIds = signal<number[]>([]);
  selectedRatingIds = signal<number[]>([]);

  // --- Selection state (store ids for delete API) ---
  selectedIds = signal<Set<number>>(new Set());

  // Filtered list (reactive)
  readonly list = computed(() => {
    const tset = new Set(this.selectedTopicIds().map(Number));
    const rset = new Set(this.selectedRatingIds().map(Number));
    const hasT = tset.size > 0;
    const hasR = rset.size > 0;

    return this.store.flashcards().filter(f => {
      const topicOk = !hasT || (f.topicId != null && tset.has(Number(f.topicId)));
      const ratingOk = !hasR || (f.ratingId != null && rset.has(Number(f.ratingId)));
      return topicOk && ratingOk;
    });
  });

  // Bulk helpers
  readonly anySelected = computed(() => this.selectedIds().size > 0);
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly allVisibleSelected = computed(() => {
    const ids = this.list()
      .map(f => f.id)
      .filter((n): n is number => !!n);
    if (!ids.length) return false;
    const set = this.selectedIds();
    return ids.every(id => set.has(id));
  });

  constructor(public api: ApiService, public store: StoreService) {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.fetchTopics().subscribe((t: Topic[]) => this.store.topics.set(t));
    this.api.fetchRatings().subscribe(r => this.store.ratings.set(r));
    this.api.fetchFlashcards().subscribe((f: Flashcard[]) => {
      this.store.flashcards.set(f);
      // prune selection of anything no longer present
      const existing = new Set(this.store.flashcards().map(x => x.id).filter(Boolean) as number[]);
      const next = new Set<number>();
      for (const id of this.selectedIds()) if (existing.has(id)) next.add(id);
      this.selectedIds.set(next);
      this.loading.set(false);
    });
  }

  // --- Modal controls ---
  openCreate() {
    this.editingId.set(null);
    this.viewOnlyId.set(null);
    this.showModal.set(true);
  }
  openEdit(id: number | null) {
    this.editingId.set(id ?? null);
    this.viewOnlyId.set(null);
    this.showModal.set(true);
  }
  openView(id: number | null) {
    this.viewOnlyId.set(id ?? null);
    this.editingId.set(id ?? null);
    this.showModal.set(true);
  }
  closeModal(refresh = false) {
    this.showModal.set(false);
    if (refresh) this.load();
  }

  // Single delete (uses id as your API expects)
  delete(id: number) {
    if (!id) return;
    this.deleting.set(true);
    this.api.deleteFlashcards([id]).subscribe({
      next: () => this.load(),
      complete: () => this.deleting.set(false)
    });
  }

  // --- Topic filter helpers ---
  toggleTopicMenu() { this.topicMenuOpen.update(v => !v); }
  clearTopics() { this.selectedTopicIds.set([]); }
  selectAllTopics() { this.selectedTopicIds.set(this.store.topics().map(t => Number(t.id))); }
  isTopicChecked(id: number) { return this.selectedTopicIds().includes(Number(id)); }
  onTopicChange(id: number, checked: boolean) {
    const set = new Set(this.selectedTopicIds().map(Number));
    checked ? set.add(Number(id)) : set.delete(Number(id));
    this.selectedTopicIds.set([...set]);
  }

  // --- Rating filter helpers ---
  toggleRatingMenu() { this.ratingMenuOpen.update(v => !v); }
  clearRatings() { this.selectedRatingIds.set([]); }
  selectAllRatings() { this.selectedRatingIds.set(this.store.ratings().map(r => Number(r.id))); }
  isRatingChecked(id: number) { return this.selectedRatingIds().includes(Number(id)); }
  onRatingChange(id: number, checked: boolean) {
    const set = new Set(this.selectedRatingIds().map(Number));
    checked ? set.add(Number(id)) : set.delete(Number(id));
    this.selectedRatingIds.set([...set]);
  }

  // --- Selection helpers ---
  isRowSelected(id?: number | null) {
    if (!id) return false;
    return this.selectedIds().has(id);
  }
  toggleRow(id?: number | null) {
    if (!id) return;
    const set = new Set(this.selectedIds());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selectedIds.set(set);
  }
  selectAllVisible() {
    const set = new Set(this.selectedIds());
    for (const f of this.list()) if (f.id) set.add(f.id);
    this.selectedIds.set(set);
  }
  clearSelection() { this.selectedIds.set(new Set()); }
  toggleSelectAllVisible() {
    this.allVisibleSelected() ? this.clearSelection() : this.selectAllVisible();
  }

  deleteSelected() {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.deleting.set(true);
    this.api.deleteFlashcards(ids).subscribe({
      next: () => {
        this.clearSelection();
        this.load();
      },
      complete: () => this.deleting.set(false)
    });
  }

  // name helpers
  topicMap = computed(() => {
    const m = new Map<number, string>();
    for (const t of this.store.topics()) m.set(Number(t.id), t.description);
    return m;
  });
  ratingMap = computed(() => {
    const m = new Map<number, string>();
    for (const r of this.store.ratings()) m.set(Number(r.id), r.description);
    return m;
  });

  topicName(id: number | null | undefined): string {
    if (id == null) return '—';
    return this.topicMap().get(Number(id)) ?? '—';
  }
  ratingName(id: number | null | undefined): string {
    if (id == null) return '—';
    return this.ratingMap().get(Number(id)) ?? '—';
  }
}