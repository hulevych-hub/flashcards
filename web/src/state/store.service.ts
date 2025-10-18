import { Injectable, signal, computed } from '@angular/core';
import { Flashcard } from '../models/Flashcard';
import { Topic } from '../models/Topics';
import { Rating } from '../models/Rating';

@Injectable({ providedIn: 'root' })
export class StoreService {
  // raw
  flashcards = signal<Flashcard[]>([]);
  topics = signal<Topic[]>([]);
  ratings = signal<Rating[]>([]);

  // filters
  selectedTopicIds = signal<number[]>([]);
  selectedRatingIds = signal<number[]>([]);
  sortByDateDesc = signal<boolean>(true);

  // derived
  filteredFlashcards = computed(() => {
    const topicIds = new Set(this.selectedTopicIds().map(Number));
    const ratingIds = new Set(this.selectedRatingIds().map(Number));
    const hasTopic = topicIds.size > 0;
    const hasRating = ratingIds.size > 0;

    let list = this.flashcards().filter(f => {
      const topicOk = !hasTopic || (f.topicId != null && topicIds.has(Number(f.topicId)));
      const ratingOk = !hasRating || (f.ratingId != null && ratingIds.has(Number(f.ratingId)));
      return topicOk && ratingOk;
    });

    const desc = this.sortByDateDesc();
    return list.sort((a, b) => {
      const ad = a.lastRated ? new Date(a.lastRated as any).getTime() : 0;
      const bd = b.lastRated ? new Date(b.lastRated as any).getTime() : 0;
      return desc ? bd - ad : ad - bd;
    });
  });
}
