export interface Flashcard {
id: number | null; // Could be stringified int
question: string;
answer: string;
ratingId: number | null;
topicId: number | null;
lastRated: string | Date | null; // ISO string preferred
questionImage: string | null; // base64
questionFileName: string | null; // base64
answerImage: string | null; // base64
answerFileName: string | null; // base64
}