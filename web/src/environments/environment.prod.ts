// src/environments/environment.ts
const baseUrl = 'http://192.168.1.4:61360';

export const environment = {
  production: true,
  api: {
    baseUrl,

    // Auth / streak
    login:               `${baseUrl}/login`,

    // Flashcards
    fetchFlashcards:     `${baseUrl}/flashcards`,
    updateFlashcard:     `${baseUrl}/flashcards`,
    deleteFlashcards:    `${baseUrl}/flashcards`,   // DELETE with body { ids }

    // Ratings
    fetchRatings:        `${baseUrl}/ratings`,
    updateRating:        `${baseUrl}/ratings`,
    deleteRatings:       `${baseUrl}/ratings`,      // DELETE with body { ids }

    // Topics
    fetchTopics:         `${baseUrl}/topics`,
    updateTopic:         `${baseUrl}/topics`,
    deleteTopics:        `${baseUrl}/topics`,       // DELETE with body { ids }

    // Rate a flashcard
    updateFlashcardRating: `${baseUrl}/rate`,

    // Sessions
    saveSession:         `${baseUrl}/session`,

    // Optional import triggers (adjust or remove if not used)
    triggerImportSheet:  `${baseUrl}/imports/sheet`,
    triggerImportImages: `${baseUrl}/imports/images`,
  },

  googleDrive: {
    apiKey: 'AIzaSyA10eYnaM1YguQXighJ3SgmWQjTcDv2g2I',
    folderId: '1sjkODwhqrhXDYREZQuY4xXdEQwzVcE2u',
    mediaUrlPrefix: 'https://www.googleapis.com/drive/v3/files/' // + {id}?alt=media&key=API_KEY
  }
};