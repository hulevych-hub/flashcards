import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { StoreService } from '../state/store.service';
import { ApiService } from '../services/api.service';
import { Rating } from '../models/Rating';
import { Flashcard } from '../models/Flashcard';


@Injectable({ providedIn: 'root' })
export class SessionService {
private store = inject(StoreService);
private api = inject(ApiService);


// ---------- UI/session flags ----------
sessionActive = signal(false);
sessionRunning = signal(false);
sessionStartAt = signal<number | null>(null);
sessionElapsed = signal(0); // seconds
private tickId: number | null = null;


// ---------- scheduling ----------
private dueAt = signal<Map<number, number>>(new Map()); // id -> dueMs


// ---------- history/pointer ----------
history = signal<number[]>([]);
pointer = signal<number>(-1);


// ---------- scoring/finish ----------
points = signal(0);
showFinish = signal(false);
finishStats = signal<{ durationMs: number; seen: number; points: number }>({
durationMs: 0,
seen: 0,
points: 0,
});


// Public derived state
readonly ratings = this.store.ratings;
readonly practiceList = computed(() => {
const ratings = this.store.ratings();
const rmap = new Map<number, Rating>();
for (const r of ratings) if (r.id != null) rmap.set(Number(r.id), r);


const tset = new Set(this.store.selectedTopicIds().map(Number));
const rset = new Set(this.store.selectedRatingIds?.().map(Number) ?? []);
const hasT = tset.size > 0;
});
}