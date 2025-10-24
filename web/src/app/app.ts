// src/app.component.ts
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NgIf],
  template: `
<header *ngIf="auth.isLoggedIn()" class="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-zinc-200">
  <div class="container-slim flex items-center justify-between py-3">
    <div class="flex items-center gap-2">
      <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white font-bold">VF</span>
      <h1 class="text-lg font-semibold tracking-tight">Vanessa's Flashcards <span class="ml-2">{{ getStreak() }}</span></h1>
    </div>
    <nav class="flex items-center gap-2 mt-3 pb-3">
      <a routerLink="/" class="btn-ghost">Practice</a>
      <a routerLink="/topics" class="btn-ghost">Topics</a>
      <a routerLink="/ratings" class="btn-ghost">Ratings</a>
      <a routerLink="/create" class="btn-ghost">Flashcards</a>
    </nav>
  </div>
</header>

<main class="container-slim py-6">
  <router-outlet></router-outlet>
</main>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private router = inject(Router);

  private tickId: any = null;
  private onStorage = (e: StorageEvent) => {
    // If auth keys change in another tab, re-check immediately
    if (e.key === 'auth.basic' || e.key === 'auth.exp') this.checkAuth();
  };

  ngOnInit(): void {
    // Initial check (in case user lands on a guarded route with an expired session)
    this.checkAuth();

    // Re-check periodically (every 10s)
    this.tickId = setInterval(() => this.checkAuth(), 10_000);

    // Listen for cross-tab login/logout
    window.addEventListener('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    if (this.tickId) clearInterval(this.tickId);
    window.removeEventListener('storage', this.onStorage);
  }

  private checkAuth() {
    const onLogin = this.router.url.startsWith('/login');
    if (!this.auth.isLoggedIn() && !onLogin) {
      this.router.navigateByUrl('/login');
    }
  }

  getStreak() {
    const raw = localStorage.getItem('user.streak');
    const n = raw ? Number(raw) : 0;
    return n ? `🔥${n}` : '';
  }
}
