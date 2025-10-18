
using Flashcards.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Flashcards.Api.Data
{
    public class FlashcardsContext : DbContext
    {
        public FlashcardsContext(DbContextOptions<FlashcardsContext> options) : base(options) { }

        public DbSet<Topic> Topics => Set<Topic>();
        public DbSet<Rating> Ratings => Set<Rating>();
        public DbSet<Flashcard> Flashcards => Set<Flashcard>();
        public DbSet<Streak> Streaks => Set<Streak>();
        public DbSet<Session> Sessions => Set<Session>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(FlashcardsContext).Assembly);
            base.OnModelCreating(modelBuilder);
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            UpdateAuditTimestamps();
            return base.SaveChangesAsync(cancellationToken);
        }

        private void UpdateAuditTimestamps()
        {
            var utcNow = DateTime.UtcNow;
            foreach (var entry in ChangeTracker.Entries<BaseEntity>())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.Entity.CreatedAt = utcNow;
                    entry.Entity.UpdatedAt = utcNow;
                }
                else if (entry.State == EntityState.Modified)
                {
                    entry.Entity.UpdatedAt = utcNow;
                }
            }
        }
    }

    public static class SeedData
    {
        public static void Seed(FlashcardsContext db)
        {
            if (!db.Ratings.Any())
            {
                db.Ratings.AddRange(
                    new Rating { Description = "Again", Color="red", Order = 1, IsActive = true },
                    new Rating { Description = "Hard", Color="orange", Order = 2, IsActive = true },
                    new Rating { Description = "Good", Color="green", Order = 3, IsActive = true },
                    new Rating { Description = "Easy", Color="blue", Order = 4, IsActive = true }
                );
            }
            if (!db.Topics.Any())
            {
                db.Topics.AddRange(
                    new Topic { Description = "Math", IsActive = true },
                    new Topic { Description = "Science", IsActive = true }
                );
            }
            db.SaveChanges();
        }
    }
}
