import { Component, computed, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ApiService } from '../services/api.service';
import { StoreService } from '../state/store.service';
import { EditRatingModal } from '../Modals/EditRatingModal';
import { Rating } from '../models/Rating';
import { finalize } from 'rxjs/operators';

const MIN_RATINGS = 3;

@Component({
  selector: 'app-ratings',
  standalone: true,
  imports: [NgIf, NgFor, EditRatingModal],
  templateUrl: './Ratings.html',
  styleUrl: './Ratings.scss'
})
export class RatingsComponent {
  loading = signal(true);
  deleting = signal(false);

  showModal = signal(false);
  editingId = signal<number | null>(null);

  /** IDs selected for bulk actions */
  selectedIds = signal<Set<number>>(new Set());

  readonly list = computed<Rating[]>(() =>
    [...this.store.ratings()].sort((a: any, b: any) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return (a.description ?? '').localeCompare(b.description ?? '');
    })
  );

  /** must keep at least 3 ratings in total */
  readonly canDeleteAny = computed(() => this.store.ratings().length > MIN_RATINGS);

  /** bulk helpers */
  readonly anySelected = computed(() => this.selectedIds().size > 0);
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly allVisibleSelected = computed(() => {
    const ids = (this.list() as any[])
      .map(r => r.id)
      .filter((n: unknown): n is number => typeof n === 'number' && Number.isFinite(n));
    if (!ids.length) return false;
    const set = this.selectedIds();
    return ids.every(id => set.has(id));
  });

  /** bulk allowed: after deleting selection, at least MIN_RATINGS remain */
  readonly canBulkDelete = computed(() => {
    const remain = this.store.ratings().length - this.selectedCount();
    return this.anySelected() && remain >= MIN_RATINGS;
  });

  constructor(public api: ApiService, public store: StoreService) {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.fetchRatings()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => {
          this.store.ratings.set(r);

          // prune selection to existing ratings (by numeric id)
          const existing = new Set(
            (this.store.ratings() as any[])
              .map(x => x.id)
              .filter((n: unknown): n is number => typeof n === 'number' && Number.isFinite(n))
          );
          const next = new Set<number>();
          for (const id of this.selectedIds()) if (existing.has(id)) next.add(id);
          this.selectedIds.set(next);
        },
        error: () => { /* optional toast */ }
      });
  }

  openCreate() { this.editingId.set(null); this.showModal.set(true); }
  openEdit(id: number) { this.editingId.set(id); this.showModal.set(true); }
  closeModal(refresh = false) { this.showModal.set(false); if (refresh) this.load(); }

  /** Single delete by numeric id */
  delete(id: number) {
    if (!this.canDeleteAny() || this.deleting()) return;

    // ensure we won't drop below MIN_RATINGS
    if (this.store.ratings().length - 1 < MIN_RATINGS) return;

    this.deleting.set(true);
    this.api.deleteRatings([id])
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe(() => this.load());
  }

  // ---- Selection helpers (by numeric id) ----
  isRowSelected(id?: number | null) {
    if (typeof id !== 'number' || !Number.isFinite(id)) return false;
    return this.selectedIds().has(id);
  }

  toggleRow(id?: number | null) {
    if (typeof id !== 'number' || !Number.isFinite(id)) return;
    const set = new Set(this.selectedIds());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selectedIds.set(set);
  }

  selectAllVisible() {
    const set = new Set(this.selectedIds());
    for (const r of this.list() as any[]) {
      const id = r?.id;
      if (typeof id === 'number' && Number.isFinite(id)) set.add(id);
    }
    this.selectedIds.set(set);
  }

  clearSelection() { this.selectedIds.set(new Set()); }

  toggleSelectAllVisible() {
    this.allVisibleSelected() ? this.clearSelection() : this.selectAllVisible();
  }

  /** Bulk delete by selected numeric ids */
  deleteSelected() {
    const ids = Array.from(this.selectedIds());
    if (!ids.length || this.deleting()) return;

    // guard: ensure MIN_RATINGS remain
    if (this.store.ratings().length - ids.length < MIN_RATINGS) return;

    this.deleting.set(true);
    this.api.deleteRatings(ids)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.clearSelection();
          this.load();
        }
      });
  }
}