using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Flashcards.Api.Entities;

namespace Flashcards.Api.Repositories
{
    public interface ITopicRepository
    {
        Task<List<Topic>> GetIsActiveAsync();
        Task<Topic> UpsertAsync(Topic t);
        Task<int> SoftDeleteAsync(IEnumerable<int> ids);
    }

    public interface IRatingRepository
    {
        Task<List<Rating>> GetIsActiveAsync();
        Task<Rating> UpsertAsync(Rating r);
        Task<int> SoftDeleteAsync(IEnumerable<int> ids);
    }

    public interface IFlashcardRepository
    {
        Task<Flashcard?> GetByIdAsync(int id);
        Task<List<Flashcard>> GetIsActiveAsync();
        Task<Flashcard> UpsertAsync(Flashcard fc);
        Task<int> SoftDeleteAsync(IEnumerable<int> ids);
        Task<int> UpdateRatingAsync(int id, int ratingId, DateTime rateDate);
    }

    public interface IStreakRepository
    {
        // Single-row streak
        Task<Streak> GetOrCreateAsync();
        Task<Streak> UpdateAsync(int days, DateTime? date);
    }

    public interface ISessionRepository
    {
        Task<Session> CreateAsync(int count, int points, DateTime start, DateTime end);
    }
}