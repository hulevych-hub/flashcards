import {
  Component,
  computed,
  inject,
  signal,
  HostListener,
  OnDestroy,
  effect,
} from '@angular/core';
import { AsyncPipe, NgFor, NgIf, NgStyle } from '@angular/common';
import { ApiService } from '../services/api.service';
import { StoreService } from '../state/store.service';
import { Topic } from '../models/Topics';
import { Rating } from '../models/Rating';
import { Flashcard } from '../models/Flashcard';
import dayjs from 'dayjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../environments/environment';
import { DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

type SessionDump = {
  version: 1;
  running: boolean;
  startAt: number | null; // epoch ms
  points: number;
  history: number[]; // flashcard ids in the order served
  pointer: number; // 0..history.length-1
  dueAt: [number, number][]; // [id, epoch ms][]
  showAnswer: boolean;
  finished: boolean; // true if session was finished (not just stopped)
};

const SESSION_KEY = 'vf_session_v1';
const FILTERS_KEY = 'vf_filters_v1'; // NEW

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe, NgStyle, DecimalPipe],
  templateUrl: './HomePage.html',
  styleUrl: './HomePage.scss',
})
export class HomePageComponent implements OnDestroy {
  private api = inject(ApiService);
  readonly store = inject(StoreService);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);


  Math = Math; // template helper

  // base loading
  loading = signal(true);

  private ratedThisSession = signal<Set<number>>(new Set());

  // UI dropdowns
  topicMenuOpen = signal(false);
  ratingMenuOpen = signal(false);

  readonly displayElapsed = computed(() => {
    const s = this.sessionElapsedSecs(); // seconds
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  });

  private normalizeImgSrc(u: string | null, fileName?: string | null): string | null {
  if (!u) return null;
  const s = u.trim();
  if (!s.startsWith('data:application/octet-stream;base64,')) return s;

  const b64 = s.substring('data:application/octet-stream;base64,'.length);
  const ext = (fileName || '').toLowerCase();

  let mime = 'image/png'; // safe default
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) mime = 'image/jpeg';
  else if (ext.endsWith('.png'))  mime = 'image/png';
  else if (ext.endsWith('.gif'))  mime = 'image/gif';
  else if (ext.endsWith('.webp')) mime = 'image/webp';
  else {
    // sniff common base64 signatures
    if (b64.startsWith('/9j/'))           mime = 'image/jpeg'; // JPEG
    else if (b64.startsWith('iVBORw0KGgo')) mime = 'image/png';  // PNG
    else if (b64.startsWith('R0lGOD'))      mime = 'image/gif';  // GIF
    else if (b64.startsWith('UklGR'))       mime = 'image/webp'; // WEBP (RIFF/WEBP)
  }
  return `data:${mime};base64,${b64}`;
}

  private trust(u: string | null): SafeUrl | null {
  return u ? this.sanitizer.bypassSecurityTrustUrl(u) : null;
}

readonly currentQuestionImg = computed<SafeUrl | null>(() => {
  const fc = this.current();
  const src = this.getQuestionImgSrc(fc); // returns data:... or Drive URL or null
  const normalized = this.normalizeImgSrc(src, fc?.questionFileName ?? null);
  return this.trust(normalized);
});

readonly currentAnswerImg = computed<SafeUrl | null>(() => {
  const fc = this.current();
  const src = this.getAnswerImgSrc(fc);
  const normalized = this.normalizeImgSrc(src, fc?.answerFileName ?? null);
  return this.trust(normalized);
});

  // Drive index
  private driveIndex = signal<Record<string, string>>({});

  // rating post busy
  isRatingBusy = signal(false);

  // session state
  sessionRunning = signal(false);
  sessionStartAt = signal<number | null>(null); // epoch ms
  sessionElapsedSecs = signal(0); // derived from startAt via timer
  private sessionTimerId: number | null = null;

  points = signal(0);

  // schedule: id -> due epoch ms
  private dueAt = signal<Map<number, number>>(new Map());

  // history & position
  history = signal<number[]>([]);
  pointer = signal<number>(-1);

  // answer visibility
  showAnswer = signal(false);

  // datasets
  readonly topics = this.store.topics;
  readonly ratings = this.store.ratings;

  // ratings sorted (order asc, then name)
  readonly sortedRatings = computed(() => {
    return [...this.ratings()].sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      const an = (a.description ?? '').toString().toLowerCase();
      const bn = (b.description ?? '').toString().toLowerCase();
      return an.localeCompare(bn);
    });
  });

  // practice list: apply store filters; unrated first, then by rating.order desc (harder first)
  readonly practiceList = computed(() => {
    const rmap = new Map<number, Rating>();
    for (const r of this.ratings()) if (r.id != null) rmap.set(Number(r.id), r);

    const tset = new Set(this.store.selectedTopicIds().map(Number));
    const rset = new Set((this.store.selectedRatingIds?.() ?? []).map(Number));
    const hasT = tset.size > 0;
    const hasR = rset.size > 0;

    const filtered = this.store.filteredFlashcards().filter((f) => {
      const topicOk = !hasT || (f.topicId != null && tset.has(Number(f.topicId)));
      const ratingOk = !hasR || (f.ratingId != null && rset.has(Number(f.ratingId)));
      return topicOk && ratingOk;
    });

    const orderOf = (f: Flashcard) => {
      const r = f.ratingId != null ? rmap.get(Number(f.ratingId)) : null;
      return r?.order ?? null;
    };

    return [...filtered].sort((a, b) => {
      const ao = orderOf(a);
      const bo = orderOf(b);
      if (ao == null && bo != null) return -1; // unrated first
      if (bo == null && ao != null) return 1;
      if (ao == null && bo == null) return 0;
      return bo! - ao!; // higher order (harder) first
    });
  });

  // NEW: persist/restore topic filters
  private saveFilters() {
    try {
      localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({
          topicIds: this.store.selectedTopicIds(),
          // add ratingIds here later if you add that filter into the store
        })
      );
    } catch {}
  }

  getRatingName(): string {
    const ratingId = this.current()?.ratingId;
    const r = this.ratings().find((r) => r.id === ratingId);
    return r?.description ?? 'Unrated';
  }

  private restoreFilters() {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { topicIds?: number[] };
      if (Array.isArray(parsed.topicIds)) {
        this.store.selectedTopicIds.set(parsed.topicIds.map(Number));
      }
    } catch {}
    // Do not reset the session here—let restoreOrInitSession() resume it
  }

  // current id & current card
  private currentId(): number | null {
    const p = this.pointer();
    const h = this.history();
    if (p < 0 || p >= h.length) return null;
    return h[p] ?? null;
  }
  readonly current = computed<Flashcard | null>(() => {
    const h = this.history();
    if (h.length > 0) {
      const id = h[this.pointer()];
      const idx = this.practiceList().findIndex((fc) => Number(fc.id) === Number(id));
      return idx >= 0 ? this.practiceList()[idx] : null;
    }
    // Preview the first card without counting it as seen yet
    return this.practiceList()[0] ?? null;
  });

  constructor() {
    this.load();
    // NEW: whenever topic filters change, reseed the session for the new subset
  }

  ngOnDestroy() {
    this.stopTimer();
    this.persistSession();
  }

  private visibleIdSet = computed<Set<number>>(() => {
    const s = new Set<number>();
    for (const fc of this.practiceList()) if (fc.id != null) s.add(Number(fc.id));
    return s;
  });

  // ------------------ LOAD ------------------
  load() {
    this.loading.set(true);
    this.api.fetchTopics().subscribe((t: Topic[]) => this.store.topics.set(t));
    this.api.fetchRatings().subscribe((r: Rating[]) => this.store.ratings.set(r));
    this.api.fetchFlashcards().subscribe((f: Flashcard[]) => {
      this.store.flashcards.set(f);
      this.loading.set(false);
      this.loadDriveIndex();
      this.restoreFilters();
      // restore session if exists; else start fresh session (not running yet)
      this.restoreOrInitSession();
    });
  }

  // ------------------ SESSION ------------------
  private restoreOrInitSession() {
    const dumpRaw = localStorage.getItem(SESSION_KEY);
    if (dumpRaw) {
      try {
        const dump = JSON.parse(dumpRaw) as SessionDump;
        if (dump.version === 1) {
          this.sessionRunning.set(!!dump.running);
          this.sessionStartAt.set(dump.startAt);
          this.points.set(dump.points || 0);

          // keep only ids that still exist in the current practice list
          const validIds = new Set(this.practiceList().map((fc) => fc.id ?? 0));
          const filteredHistory = (dump.history ?? []).filter((id) => validIds.has(id));
          const safePointer = Math.min(
            Math.max(0, typeof dump.pointer === 'number' ? dump.pointer : -1),
            Math.max(0, filteredHistory.length - 1)
          );

          this.history.set(filteredHistory);
          this.pointer.set(filteredHistory.length ? safePointer : -1);

          const m = new Map<number, number>();
          for (const [id, at] of dump.dueAt || []) {
            if (validIds.has(Number(id))) m.set(Number(id), Number(at));
          }
          this.dueAt.set(m);

          this.showAnswer.set(!!dump.showAnswer);

          // Resume timer if needed
          if (this.sessionRunning() && this.sessionStartAt()) {
            const secs = Math.max(0, Math.floor((Date.now() - this.sessionStartAt()!) / 1000));
            this.sessionElapsedSecs.set(secs);
            this.startTimer();
          }

          // If nothing valid to restore, start fresh
          if (this.history().length === 0) this.resetSession(false);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    this.resetSession(false);
  }

  private persistSession() {
    const payload: SessionDump = {
      version: 1,
      running: this.sessionRunning(),
      startAt: this.sessionStartAt(),
      points: this.points(),
      history: this.history(),
      pointer: this.pointer(),
      dueAt: Array.from(this.dueAt().entries()),
      showAnswer: this.showAnswer(),
      finished: false, // ← don’t flag as finished during normal run
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  private resetSession(keepTimer: boolean) {
    if (!keepTimer) this.stopTimer();
    this.sessionRunning.set(false);
    this.sessionStartAt.set(null);
    this.sessionElapsedSecs.set(0);
    this.points.set(0);
    this.dueAt.set(new Map());
    this.history.set([]);
    this.pointer.set(-1);
    this.showAnswer.set(false);
    this.ratedThisSession.set(new Set()); // ← add
    this.persistSession();
  }

  private seedFirstCard() {
    const list = this.practiceList();
    if (!list.length) return; // nothing to seed
    const first = list[0];
    if (!first?.id && first?.id !== 0) return;
    this.pushToHistory(first.id);
    this.pointer.set(0);
  }

  private startTimer() {
    if (this.sessionTimerId != null) return;
    this.sessionTimerId = window.setInterval(() => {
      const start = this.sessionStartAt();
      if (this.sessionRunning() && start != null) {
        const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
        this.sessionElapsedSecs.set(secs);
      }
    }, 1000);
  }
  private stopTimer() {
    if (this.sessionTimerId != null) {
      clearInterval(this.sessionTimerId);
      this.sessionTimerId = null;
    }
  }

  restart() {
    // Keep current filters AND session; just reload the UI.
    this.saveFilters(); // persist filters
    this.persistSession(); // persist running/points/startAt/history/dueAt/etc.
    window.location.reload(); // reload without clearing SESSION_KEY
  }

  finishSession() {
    // Stop timer but **do not** clear persisted session until user closes modal
    this.sessionRunning.set(false);
    this.stopTimer();

    // Show modal info will be driven by template state (we’ll compute on the fly)
    this.finishOpen.set(true);
    this.persistSession();
  }

  // Add this helper inside the class
  private onFiltersChanged() {
    this.saveFilters(); // keep filters persisted

    // Recompute visible set based on current filters
    const visible = this.visibleIdSet();
    const now = Date.now();

    // 1) Prune dueAt for hidden cards
    const prunedDue = new Map<number, number>();
    for (const [id, at] of this.dueAt().entries()) {
      if (visible.has(id)) prunedDue.set(id, at);
    }
    this.dueAt.set(prunedDue);

    // 2) Prune history to only visible ids, keep order
    const newHistory = this.history().filter((id) => visible.has(id));
    this.history.set(newHistory);

    // Fix pointer (stay as close as possible to the end)
    let p = this.pointer();
    if (newHistory.length === 0) {
      this.pointer.set(-1);
      // If nothing visible, nothing else to do
      this.persistSession();
      return;
    }
    if (p < 0) p = 0;
    if (p > newHistory.length - 1) p = newHistory.length - 1;
    this.pointer.set(p);

    // 3) If current card is gone (handled above) or there’s no current, try to pick something:
    if (this.current() == null) {
      // Prefer a due visible card, else first unseen visible
      let candidate: number | null = null;
      let minDue = Number.POSITIVE_INFINITY;
      for (const [id, at] of prunedDue.entries()) {
        if (at <= now && at < minDue) {
          minDue = at;
          candidate = id;
        }
      }
      if (candidate == null) {
        const seen = new Set(newHistory);
        const unseen = this.practiceList().find((fc) => fc.id != null && !seen.has(fc.id));
        if (unseen?.id != null) candidate = unseen.id;
      }
      if (candidate != null) {
        this.pushToHistory(candidate);
        this.pointer.set(this.history().length - 1);
        this.showAnswer.set(false);
      } else {
        // nothing due/unseen in this filter; keep pointer where it is
      }
    }

    // 🔒 Do NOT touch sessionRunning / startAt / points here
    this.persistSession();
  }

  confirmFinish() {
    // On confirm, we actually clear the session
    this.api
      .saveSession(
        this.history().length,
        this.points(),
        this.sessionStartAt() ? new Date(this.sessionStartAt()!) : new Date(),
        new Date()
      )
      .subscribe({});
    const durationMs = this.sessionStartAt()
      ? Date.now() - this.sessionStartAt()!
      : this.sessionElapsedSecs() * 1000;
    this.finishSummary.set({
      durationMs,
      seen: new Set(this.history()).size,
      points: this.points(),
    });
    this.finishOpen.set(false);
    // Clear storage and reset session
    localStorage.removeItem(SESSION_KEY);
    this.resetSession(false);
    // Show summary modal
    this.summaryOpen.set(true);
  }

  cancelFinish() {
    // Keep running if it was running
    if (this.sessionStartAt() != null) {
      this.sessionRunning.set(true);
      this.startTimer();
    }
    this.finishOpen.set(false);
  }

  // Finish modals state
  finishOpen = signal(false);
  summaryOpen = signal(false);
  finishSummary = signal<{ durationMs: number; seen: number; points: number }>({
    durationMs: 0,
    seen: 0,
    points: 0,
  });
  closeSummary() {
    this.summaryOpen.set(false);
    window.location.reload();
  }

  // ------------------ ACTIONS ------------------
  toggleAnswer() {
    const before = this.showAnswer();
    const after = !before;
    this.showAnswer.set(after);

    if (after && this.history().length === 0) {
      const first = this.practiceList()[0];
      if (first?.id != null) {
        this.pushToHistory(first.id);
        this.pointer.set(0);
      }
    }

    // start session/timer on first flip
    if (after && !this.sessionRunning()) {
      this.sessionRunning.set(true);
      if (this.sessionStartAt() == null) this.sessionStartAt.set(Date.now());
      this.startTimer();
    }
    this.persistSession();
  }

  prev() {
    const p = this.pointer();
    if (p > 0) {
      this.pointer.set(p - 1);
      this.persistSession();
    }
  }

  next() {
    const p = this.pointer();
    const hLen = this.history().length;
    if (p >= 0 && p < hLen - 1) {
      this.pointer.set(p + 1);
      this.persistSession();
    }
  }

  // Only rate at newest history item
  rate(ratingId: number) {
    const c = this.current();
    const rs = new Set(this.ratedThisSession());
    if (c?.id != null) rs.add(Number(c.id));
    this.ratedThisSession.set(rs);
    if (!c || this.isRatingBusy()) return;
    if (this.pointer() !== this.history().length - 1) return;

    const rating = this.ratings().find((r) => Number(r.id) === Number(ratingId)) || null;
    const order = rating?.order ?? null;

    this.isRatingBusy.set(true);
    const rateDate = new Date().toISOString();

    // optimistic UI
    const prev = this.store.flashcards();
    this.store.flashcards.set(
      prev.map((f) => (f.id === c.id ? { ...f, ratingId, lastRated: rateDate } : f))
    );

    // points
    this.points.update((p) => p + this.pointsForOrder(order));

    // schedule next
    const delay = this.nextDelayMs(order);
    const schedule = new Map(this.dueAt());
    schedule.set(c.id ?? 0, Date.now() + delay);
    this.dueAt.set(schedule);

    // persist partial session now
    this.persistSession();

    // POST
    this.api.updateFlashcardRating(c.id, ratingId).subscribe({
      /*next: () => {
        // Advance to next due or first unseen (no auto-finish; we can show "All caught up")
        const advanced = this.advanceToNextDueOrUnseen();
        if (!advanced) {
          // nothing to show immediately; leave as-is (timer keeps running)
        }
        this.isRatingBusy.set(false);
        this.persistSession();
      },
      error: () => {
        // rollback
        this.store.flashcards.set(prev);
        this.isRatingBusy.set(false);
        this.persistSession();
      }*/
    });

    // continue withtout waiting for POST
    const advanced = this.advanceToNextDueOrUnseen();
    if (!advanced) {
      // nothing to show immediately; leave as-is (timer keeps running)
    }
    this.isRatingBusy.set(false);
    this.persistSession();
  }

  // Select next due card or first unseen, else return false
  private advanceToNextDueOrUnseen(): boolean {
    const now = Date.now();
    const seen = new Set(this.history());
    const list = this.practiceList();
    const visible = this.visibleIdSet();

    let candidateId: number | null = null;
    let minDue = Number.POSITIVE_INFINITY;
    const schedule = this.dueAt();
    for (const [id, at] of schedule.entries()) {
      if (!visible.has(id)) continue; // NEW: skip hidden by filter
      if (at <= now && at < minDue) {
        minDue = at;
        candidateId = id;
      }
    }

    if (candidateId == null) {
      const unseen = list.find((fc) => !seen.has(fc.id ?? 0));
      if (unseen) candidateId = unseen.id!;
    }

    if (candidateId != null) {
      this.pushToHistory(candidateId);
      this.pointer.set(this.history().length - 1);
      this.showAnswer.set(false);
      return true;
    }
    return false;
  }

  private pushToHistory(id: number) {
    const h = this.history();
    if (h[h.length - 1] !== id) {
      this.history.set([...h, id]);
    }
  }

  // delays & points
  private nextDelayMs(order: number | null | undefined): number {
    if (order == null) return 120000; // 2min default
    if (order <= 1) return 5 * 60_000; // easy
    if (order === 2) return 3 * 60_000; // medium
    if (order === 3) return 90_000; // hard
    return 30_000; // very hard / fallback
  }
  private pointsForOrder(order: number | null | undefined): number {
    if (order == null) return 5; // unrated
    return this.Math.round(Math.max(1, (1 / order) * 500)); // order 1 => 5 pts ... order 5 => 1 pt
  }

  // Is there any card we could show next? (due or unseen)
  private hasNextCandidate(): boolean {
    const now = Date.now();
    const seen = new Set(this.history());
    const list = this.practiceList();
    const visible = this.visibleIdSet();

    for (const [id, at] of this.dueAt().entries()) {
      if (!visible.has(id)) continue; // NEW
      if (at <= now) return true;
    }
    return list.some((fc) => !seen.has(fc.id ?? 0));
  }

  // True when we're at the newest history item AND there's nothing else to show
  readonly noMoreCards = computed(() => {
    const p = this.pointer();
    const hLen = this.history().length;
    if (hLen === 0) return false; // no current yet
    const atLatest = p === hLen - 1;

    const curId = this.currentId();
    const ratedCurrent = curId != null && this.ratedThisSession().has(curId);

    // Only show "Well done" if the latest card has been rated
    return atLatest && ratedCurrent && !this.hasNextCandidate();
  });

  private clearPersistedSession() {
    try {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {}
    } catch {}
  }
  // ------------------ Filters UI ------------------
  toggleTopicMenu() {
    this.topicMenuOpen.update((v) => !v);
  }
  clearTopics() {
    this.store.selectedTopicIds.set([]);
    this.saveFilters();
    this.onFiltersChanged(); // ← add
  }
  selectAllTopics() {
    this.store.selectedTopicIds.set(this.topics().map((t) => t.id ?? 0));
    this.saveFilters();
    this.onFiltersChanged(); // ← add
  }
  onTopicCheckbox(id: number, checked: boolean) {
    const set = new Set<number>(this.store.selectedTopicIds().map(Number));
    checked ? set.add(Number(id)) : set.delete(Number(id));
    this.store.selectedTopicIds.set([...set]);

    this.saveFilters();
    this.onFiltersChanged(); // ← add
  }

  toggleRatingMenu() {
    this.ratingMenuOpen.update((v) => !v);
  }
  selectAllRatings() {
    const all = this.ratings().map((r) => r.id ?? 0);
    this.store.selectedRatingIds?.set?.(all);
    this.persistSession();
    this.onFiltersChanged(); // ← add
  }
  clearRatings() {
    this.store.selectedRatingIds?.set?.([]);
    this.persistSession();
    this.onFiltersChanged(); // ← add
  }
  onRatingCheckbox(id: number, checked: boolean) {
    const set = new Set<number>((this.store.selectedRatingIds?.() ?? []).map(Number));
    checked ? set.add(Number(id)) : set.delete(Number(id));
    this.store.selectedRatingIds?.set?.([...set]);
    this.persistSession();
    this.onFiltersChanged(); // ← add
  }

  // ------------------ Drive helpers ------------------
  private loadDriveIndex() {
    const base = 'https://www.googleapis.com/drive/v3/files';
    const params = new HttpParams()
      .set('key', environment.googleDrive.apiKey)
      .set('q', `'${environment.googleDrive.folderId}' in parents and trashed = false`)
      .set('pageSize', '1000')
      .set('fields', 'nextPageToken,files(id,name)');
    this.http.get<{ files: { id: string; name: string }[] }>(base, { params }).subscribe((res) => {
      const idx: Record<string, string> = {};
      for (const f of res.files || []) idx[f.name] = f.id;
      this.driveIndex.set(idx);
    });
  }
  private toMediaUrl(id: string) {
    return `${environment.googleDrive.mediaUrlPrefix}${id}?alt=media&key=${environment.googleDrive.apiKey}`;
  }
  resolveFlashcardImage(name?: string | null): string | null {
    if (!name) return null;
    const raw = String(name).trim();
    if (/^(https?:)?\/\//i.test(raw) || /^data:image\//i.test(raw) || /^blob:/i.test(raw))
      return raw;
    const idx = this.driveIndex();
    let id = idx[raw];
    if (!id && !raw.includes('.')) {
      const exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
      for (const ext of exts) {
        id = idx[raw + ext];
        if (id) break;
      }
    }
    return id ? this.toMediaUrl(id) : null;
  }

  getQuestionImgSrc(fc: Flashcard | null): string | null {
  if (!fc) return null;

  const inline = (fc.questionImage ?? '').trim();
  if (inline && /^data:image\//i.test(inline)) return inline;

  return this.resolveFlashcardImage(fc.questionFileName);
}

getAnswerImgSrc(fc: Flashcard | null): string | null {
  if (!fc) return null;

  const inline = (fc.answerImage ?? '').trim();
  if (inline && /^data:image\//i.test(inline)) return inline;

  return this.resolveFlashcardImage(fc.answerFileName);
}

  // keyboard shortcuts
  @HostListener('window:keydown', ['$event'])
  handleKeys(e: KeyboardEvent) {
    if (e.code === 'Space') {
      e.preventDefault();
      this.toggleAnswer();
    }
    if (e.code === 'ArrowRight') this.next();
    if (e.code === 'ArrowLeft') this.prev();
  }

  // small utils
  formatDate(d?: string | Date | null) {
    if (!d) return '—';
    return dayjs(d).format('YYYY-MM-DD HH:mm');
  }
  getRatingStyles(r: Rating) {
    const bg = this.normalizeHex(r.color);
    const fg = this.readableTextColor(bg);
    return bg ? { 'background-color': bg, color: fg } : {};
  }
  private normalizeHex(c?: string | null): string | null {
    if (!c) return null;
    let s = c.trim();
    if (!s) return null;
    if (s[0] !== '#') s = '#' + s;
    if (/^#([0-9a-fA-F]{3})$/.test(s))
      s =
        '#' +
        s
          .slice(1)
          .split('')
          .map((ch) => ch + ch)
          .join('');
    return /^#([0-9a-fA-F]{6})$/.test(s) ? s : null;
  }
  private readableTextColor(hex: string | null): string {
    if (!hex) return '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    return L > 0.5 ? '#111827' : '#ffffff';
  }

  // template helpers
  allCaughtUp = computed(() => {
    const list = this.practiceList();
    if (!list.length) return true;
    const seen = new Set(this.history());
    const unseenLeft = list.some((fc) => !seen.has(fc.id ?? 0));
    if (unseenLeft) return false;
    const now = Date.now();
    const visible = this.visibleIdSet();
    return !Array.from(this.dueAt().entries()).some(([id, at]) => visible.has(id) && at <= now); // NEW
  });
}
