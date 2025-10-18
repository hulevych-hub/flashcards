using Flashcards.Api.Data;
using Flashcards.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Flashcards.Api.Repositories
{
    public class TopicRepository : ITopicRepository
    {
        private readonly FlashcardsContext _db;
        public TopicRepository(FlashcardsContext db) => _db = db;

        public Task<List<Topic>> GetIsActiveAsync() =>
            _db.Topics.Where(t => t.IsActive).OrderBy(t => t.Description).ToListAsync();

        public async Task<Topic> UpsertAsync(Topic t)
        {
            Topic? existing = null;

            if (t.Id > 0)
                existing = await _db.Topics.FirstOrDefaultAsync(x => x.Id == t.Id);

            if (existing is null)
            {
                // create new
                t.IsActive = true; // ensure default
                _db.Topics.Add(t);
            }
            else
            {
                // update existing
                existing.Description = t.Description;
            }

            await _db.SaveChangesAsync();
            return existing ?? t;
        }

        public async Task<int> SoftDeleteAsync(IEnumerable<int> ids)
        {
            var targets = await _db.Topics.Where(t => ids.Contains(t.Id)).ToListAsync();
            foreach (var t in targets) t.IsActive = false;
            return await _db.SaveChangesAsync();
        }
    }

    public class RatingRepository : IRatingRepository
    {
        private readonly FlashcardsContext _db;
        public RatingRepository(FlashcardsContext db) => _db = db;

        public Task<List<Rating>> GetIsActiveAsync() =>
            _db.Ratings.Where(r => r.IsActive).OrderBy(r => r.Order).ToListAsync();

        public async Task<Rating> UpsertAsync(Rating r)
        {
            Rating? existing = null;

            if (r.Id > 0)
                existing = await _db.Ratings.FirstOrDefaultAsync(x => x.Id == r.Id);

            if (existing is null)
            {
                r.IsActive = true;
                _db.Ratings.Add(r);
            }
            else
            {
                existing.Description = r.Description;
                existing.Color = r.Color;
                existing.Order = r.Order;
            }

            await _db.SaveChangesAsync();
            return existing ?? r;
        }

        public async Task<int> SoftDeleteAsync(IEnumerable<int> ids)
        {
            var targets = await _db.Ratings.Where(t => ids.Contains(t.Id)).ToListAsync();
            foreach (var t in targets) t.IsActive = false;
            return await _db.SaveChangesAsync();
        }
    }

    public class FlashcardRepository : IFlashcardRepository
    {
        private readonly FlashcardsContext _db;
        public FlashcardRepository(FlashcardsContext db) => _db = db;

        public Task<List<Flashcard>> GetIsActiveAsync() =>
            _db.Flashcards.Where(f => f.IsActive).OrderBy(f => f.Id).ToListAsync();

        public async Task<Flashcard> UpsertAsync(Flashcard fc)
        {
            Flashcard? existing = null;

            if (fc.Id > 0)
                existing = await _db.Flashcards.FirstOrDefaultAsync(x => x.Id == fc.Id);

            if (existing is null)
            {
                fc.IsActive = true;
                _db.Flashcards.Add(fc);
            }
            else
            {
                existing.Question = fc.Question;
                existing.QuestionFileName = fc.QuestionFileName;
                existing.Answer = fc.Answer;
                existing.AnswerFileName = fc.AnswerFileName;
                existing.TopicId = fc.TopicId;
                existing.RatingId = fc.RatingId;
                // keep IsActive as provided (optional):
            }

            await _db.SaveChangesAsync();
            return existing ?? fc;
        }

        public async Task<int> SoftDeleteAsync(IEnumerable<int> ids)
        {
            var targets = await _db.Flashcards.Where(t => ids.Contains(t.Id)).ToListAsync();
            foreach (var t in targets) t.IsActive = false;
            return await _db.SaveChangesAsync();
        }

        public async Task<int> UpdateRatingAsync(int flashcardId, int ratingId, DateTime rateDate)
        {
            var f = await _db.Flashcards.FirstOrDefaultAsync(x => x.Id == flashcardId);
            if (f is null) return 0;
            f.RatingId = ratingId;
            f.LastRated = rateDate;
            return await _db.SaveChangesAsync();
        }

        public Task<Flashcard?> GetByIdAsync(int id) => _db.Flashcards.SingleOrDefaultAsync(f => f.Id == id && f.IsActive);
    }

    public class StreakRepository : IStreakRepository
    {
        private readonly FlashcardsContext _db;
        public StreakRepository(FlashcardsContext db) => _db = db;

        public async Task<Streak> GetOrCreateAsync()
        {
            var s = await _db.Streaks.FirstOrDefaultAsync();
            if (s is null)
            {
                s = new Streak { Days = 0, LastRated = null, IsActive = true };
                _db.Streaks.Add(s);
                await _db.SaveChangesAsync();
            }
            return s;
        }

        public async Task<Streak> UpdateAsync(int days, DateTime? date = null)
        {
            var s = await GetOrCreateAsync();
            s.Days = days;
            s.LastRated = date?.Date; // normalize to day
            await _db.SaveChangesAsync();
            return s;
        }
    }

    public class SessionRepository : ISessionRepository
    {
        private readonly FlashcardsContext _db;
        public SessionRepository(FlashcardsContext db) => _db = db;

        public async Task<Session> CreateAsync(int count, int points, DateTime start, DateTime end)
        {
            var s = new Session
            {
                NoFlashcards = count,
                Points = points,
                StartDate = start,
                EndDate = end,
                IsActive = true
            };
            _db.Sessions.Add(s);
            await _db.SaveChangesAsync();
            return s;
        }
    }
}