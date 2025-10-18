import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { StoreService } from '../state/store.service';
import { Rating } from '../models/Rating';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-edit-rating-modal',
  standalone: true,
  imports: [NgIf, FormsModule],
  template: `
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" (click)="onBackdrop($event)">
    <div class="card w-full max-w-md" (click)="$event.stopPropagation()">

      <h3 class="text-lg font-semibold mb-3">{{ ratingId != null ? 'Edit' : 'New' }} rating</h3>

      <!-- Name -->
      <label class="label">Name</label>
      <input class="input" [(ngModel)]="name" placeholder="e.g. Easy" [disabled]="saving" />

      <!-- Color -->
      <div class="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
        <label class="label">Color</label>
        <div class="flex items-center gap-3">
          <input type="color" class="h-9 w-12 rounded-md border border-zinc-200" [(ngModel)]="color" [disabled]="saving" />
          <input class="input" [(ngModel)]="color" placeholder="#10B981" [disabled]="saving" />
        </div>
      </div>

      <!-- Order: free-typed number, auto-snaps to nearest free on blur/save -->
      <div class="mt-3">
        <label class="label">Order</label>
        <input
          type="number"
          class="input"
          [(ngModel)]="order"
          min="1"
          (blur)="snapOrder()"
          [disabled]="saving"
          placeholder="1" />
        <div class="mt-1 text-xs text-zinc-500">
        </div>
        <div *ngIf="orderClash()" class="mt-1 text-sm text-amber-600">
          That number is taken; it will snap to the nearest free value.
        </div>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <button class="btn-ghost" (click)="close(false)" [disabled]="saving">Cancel</button>
        <button
          class="btn-primary inline-flex items-center gap-2"
          [disabled]="!canSave() || saving"
          [attr.aria-busy]="saving ? 'true' : null"
          (click)="save()">
          <span *ngIf="saving" class="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
          <span>{{ saving ? 'Saving…' : 'Save' }}</span>
        </button>
      </div>
    </div>
  </div>
  `
})
export class EditRatingModal {
  @Input() ratingId: number | null = null;
  @Output() closed = new EventEmitter<boolean>();

  notionId: string | null = null;
  name = '';
  color: string = '#10B981';
  order: number | null = null;
  saving = false;

  constructor(private api: ApiService, public store: StoreService) {}

  ngOnInit() {
    if (this.ratingId != null) {
      const r = this.store.ratings().find(x => x.id === this.ratingId);
      if (r) {
        this.notionId = (r as any).notionId ?? null;
        this.name = (r as any).description ?? (r as any).name ?? '';
        this.color = (r as any).color ?? '#10B981';
        this.order = (r as any).order ?? null;
      }
    }
    if (this.order == null) this.order = this.nextAvailableOrder();
  }

  onBackdrop(_: MouseEvent) { if (!this.saving) this.close(false); }

  /** Set of used orders excluding the one from the rating we’re editing */
  readonly usedOrders = computed<Set<number>>(() => {
    const set = new Set<number>();
    for (const r of this.store.ratings()) {
      if (r.id === this.ratingId) continue; // ignore current
      const v = (r as any).order;
      if (v != null) set.add(Number(v));
    }
    return set;
  });

  /** Is the current 'order' colliding? */
  readonly orderClash = computed<boolean>(() => {
    if (this.order == null) return false;
    return this.usedOrders().has(Number(this.order));
  });

  /** Next smallest positive integer not in usedOrders */
  nextAvailableOrder(): number {
    const used = this.usedOrders();
    let n = 1;
    while (used.has(n)) n++;
    return n;
    }

  /** Find nearest free order to desired; prefers next (higher) on ties. */
  private nearestFree(desired: number): number {
    const used = this.usedOrders();
    if (!used.has(desired) && desired >= 1) return desired;

    let delta = 1;
    while (true) {
      const up = desired + delta;
      if (up >= 1 && !used.has(up)) return up;
      const down = desired - delta;
      if (down >= 1 && !used.has(down)) return down;
      delta++;
    }
  }

  /** Snap on blur so the UI reflects the final value immediately */
  snapOrder() {
    if (this.order == null) return;
    const desired = Math.max(1, Math.floor(Number(this.order)));
    const resolved = this.nearestFree(desired);
    this.order = resolved;
  }

  private norm(s: string) { return (s ?? '').trim(); }
  canSave(): boolean {
    return this.norm(this.name).length > 0 && this.order != null;
  }

  save() {
    if (!this.canSave() || this.saving) return;
    // final snap before posting
    this.snapOrder();

    this.saving = true;
    const payload: Partial<Rating> = {
      id: this.ratingId !== 0 && this.ratingId != null ? this.ratingId : null,
      description: this.name.trim(),
      color: this.normalizeHex(this.color) ?? '',
      order: Number(this.order)
    };

    this.api.updateRating(payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => this.close(true),
        error: () => { /* keep modal open; buttons re-enable */ }
      });
  }

  private normalizeHex(c?: string | null): string | null {
    if (!c) return null;
    let s = c.trim();
    if (!s) return null;
    if (s[0] !== '#') s = '#' + s;
    if (/^#([0-9a-fA-F]{3})$/.test(s)) s = '#' + s.slice(1).split('').map(ch => ch + ch).join('');
    return /^#([0-9a-fA-F]{6})$/.test(s) ? s : null;
  }

  close(refresh: boolean) { this.closed.emit(refresh); }
}