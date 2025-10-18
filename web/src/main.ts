import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app';
import { routes } from './routes';
import { authInterceptor } from './services/auth.interceptor';



bootstrapApplication(AppComponent, {
providers: [
provideRouter(routes),
provideHttpClient(      withInterceptors([authInterceptor]))
]
}).catch(err => console.error(err));