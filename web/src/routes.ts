import { Routes } from '@angular/router';
import { HomePageComponent } from './HomePage/HomePage.component';
import { TopicsComponent } from './Topics/Topics.component';
import { FlashcardsComponent } from './Flashcards/Flashcards.component';
import { LoginComponent } from './Login/Login.component';
import { authGuard } from './guards/auth.guard';
import { RatingsComponent } from './Ratings/Ratings.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: HomePageComponent, canActivate: [authGuard] },
  { path: 'topics', component: TopicsComponent, canActivate: [authGuard] },
  { path: 'flashcards', component: FlashcardsComponent, canActivate: [authGuard] },
  { path: 'ratings', component: RatingsComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
