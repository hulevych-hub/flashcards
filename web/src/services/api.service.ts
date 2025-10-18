import { Injectable } from '@angular/core';
import { Topic } from '../models/Topics';
import { Rating } from '../models/Rating';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Flashcard } from '../models/Flashcard';
import { environment } from '../environments/environment';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): HttpHeaders | undefined {
    const basic = localStorage.getItem('auth.basic');
    const expiresRaw = localStorage.getItem('auth.expiresAt');
    const expiresAt = expiresRaw ? Number(expiresRaw) : 0;

    // expired or missing
    if (!basic || !expiresAt || Date.now() > expiresAt) {
      localStorage.removeItem('auth.basic');
      localStorage.removeItem('auth.expiresAt');
      return undefined; // will trigger 401s you can handle by redirecting to login
    }
    return basic ? new HttpHeaders({ Authorization: `Basic ${basic}` }) : undefined;
  }

  private withAuth<T extends object>(opts?: T): T & { headers?: HttpHeaders } {
    const headers = this.headers();
    return headers ? { ...(opts as any), headers } : ((opts as any) ?? {});
  }

  private stripEmpties<T>(arr: any): T[] {
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (item) => item && typeof item === 'object' && Object.keys(item).length > 0
    ) as T[];
  }

  private deleteWithBody<T>(url: string, body: any) {
    // Some clients have issues sending bodies with HttpClient.delete, so use request()
    return this.http.request<T>('DELETE', url, { body, headers: this.headers() });
  }

  // ---------------- AUTH ----------------
  login(basicToken: string) {
    // GET /login protected by Basic Auth — returns a single streak object now
    const headers = new HttpHeaders({ Authorization: `Basic ${basicToken}` });
    return this.http.get<any>(environment.api.login, { headers });
  }

  // ---------------- FETCHES ----------------
  fetchFlashcards() {
    return this.http
      .get<any[]>(environment.api.fetchFlashcards, { headers: this.headers() })
      .pipe(map((res) => this.stripEmpties<Flashcard>(res)));
  }

  fetchRatings() {
    return this.http
      .get<any[]>(environment.api.fetchRatings, { headers: this.headers() })
      .pipe(map((res) => this.stripEmpties<Rating>(res)));
  }

  fetchTopics() {
    return this.http
      .get<Topic[]>(environment.api.fetchTopics, { headers: this.headers() })
      .pipe(map((res) => this.stripEmpties<Topic>(res)));
  }

  // ---------------- UPSERTS ----------------
  updateFlashcard(data: Partial<Flashcard>) {
    // POST /flashcards
    return this.http.post<Flashcard>(environment.api.updateFlashcard, data, { headers: this.headers() });
  }

  updateTopic(data: Topic) {
    // POST /topics
    return this.http.post<Topic>(environment.api.updateTopic, data, { headers: this.headers() });
  }

  updateFlashcardRating(flashcardId: number | null, ratingId: number, rateDate = new Date().toISOString()) {
    // POST /rate  (no notionId anymore)
    return this.http.post(environment.api.updateFlashcardRating, { flashcardId, ratingId, rateDate }, { headers: this.headers() });
  }

  saveSession(flashcards: number, points: number, startDate: Date, endDate: Date) {
    // POST /session
    return this.http.post(environment.api.saveSession, { flashcards, points, startDate, endDate }, { headers: this.headers() });
  }

  updateRating(data: Partial<Rating>) {
    // POST /ratings
    return this.http.post<Rating>(environment.api.updateRating, data, { headers: this.headers() });
  }

  deleteRatings(ids: number[]) {
    // DELETE /ratings  with body { ids }
    return this.deleteWithBody(environment.api.deleteRatings, { ids });
  }

  // ---------------- DELETES ----------------
  deleteFlashcards(ids: number[]) {
    // DELETE /flashcards  with body { ids }
    return this.deleteWithBody(environment.api.deleteFlashcards, { ids });
  }

  deleteTopics(ids: number[]) {
    // DELETE /topics  with body { ids }
    return this.deleteWithBody(environment.api.deleteTopics, { ids });
  }

  // ---------------- OPTIONAL IMPORT TRIGGERS ----------------
  triggerImportSheet() { return this.http.post(environment.api.triggerImportSheet, {}); }
  triggerImportImages() { return this.http.post(environment.api.triggerImportImages, {}); }
}
