// src/interceptors/api-auth.interceptor.ts
import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../environments/environment';

function isOurApi(url: string): boolean {
  // Whitelist ONLY your API hosts/paths; adjust as needed
  const apiRoots = [
    environment.api.fetchFlashcards,
    environment.api.fetchRatings,
    environment.api.fetchTopics,
    environment.api.updateFlashcard,
    environment.api.updateTopic,
    environment.api.updateFlashcardRating,
    environment.api.deleteFlashcards,
    environment.api.deleteTopics,
    environment.api.triggerImportSheet,
    environment.api.triggerImportImages,
    environment.api.login, // include login endpoint
  ].filter(Boolean) as string[];
  return apiRoots.some(root => url.startsWith(root));
}

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const fromApi = isOurApi(req.url);
  const token = auth.getAuthHeader();

  // Attach Authorization ONLY for our API calls (and only if we have a token)
  const withAuth = (fromApi && token)
    ? req.clone({ headers: (req.headers || new HttpHeaders()).set('Authorization', token) })
    : req;

  // 🔄 Refresh sliding expiry ONLY on outbound API requests (network activity-based)
  if (fromApi && token) {
    auth.touch();
  }

  return next(withAuth).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        // Ignore 401s that are not from our API (e.g., external/Drive/favicons)
        // Also ignore the 401 from the /login call itself
        const onLoginRoute = router.url.startsWith('/login');

        if (fromApi && !onLoginRoute) {
          auth.clearCredentials();
          router.navigateByUrl('/login');
        }
      }
      return throwError(() => err);
    })
  );
};
