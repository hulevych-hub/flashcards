// src/guards/auth.guard.ts
import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanMatchFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Never guard the login page
  if (route.path === 'login') return true;

  if (auth.isLoggedIn()) return true;

  router.navigateByUrl('/login');
  return false;
};
