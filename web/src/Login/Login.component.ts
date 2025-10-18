// src/Login/Login.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { isEmpty } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './Login.html',
  styleUrls: ['./Login.scss'] // ← use styleUrls (array)
})
export class LoginComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);
  showWelcome = signal(false);

  ngOnInit() {
    if (!this.auth.isLoggedIn()) {
      localStorage.clear();
}}

  submit() {
    this.error.set(null);
    if (!this.username || !this.password) {
      this.error.set('Please enter username and password.');
      return;
    }
    this.loading.set(true);

    const basic = btoa(`${this.username}:${this.password}`);

    this.api.login(basic).subscribe({
      next: (res: { streak: number; lastRated: string }) => {
        this.loading.set(false);

        this.auth.loginWithBasic(basic);

        // Save user meta
        const meta = {streak: res.streak ?? 0, lastRated: res.lastRated ?? '' };
        localStorage.setItem('user.streak', String(meta.streak));
        localStorage.setItem('user.lastRated', meta.lastRated);        

        // Store auth (15 min session with auto-bump on activity)

        if ((this.username || '').trim().toLowerCase() === 'vanessa') {
        this.showWelcome.set(true);
        // optional auto-continue after a short delay
        return; // stop here; proceed() will navigate
      }

        // Go to homepage
        this.router.navigateByUrl('/');
      },
      error: (e) => {
        this.loading.set(false);
        if (e?.status === 401) this.error.set('Incorrect username or password.');
        else this.error.set('Login failed. Please try again.');
      }
    });
  }

  gotToHome() {
    this.router.navigateByUrl('/');
  }

  getYear() {
    return new Date().getFullYear();
  }
}