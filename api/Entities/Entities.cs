
using System.ComponentModel.DataAnnotations;

namespace Flashcards.Api.Entities
{
    public abstract class BaseEntity
    {
        [Key]
        public int Id { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class Topic : BaseEntity
    {
        public string Description { get; set; } = "";
    }

    public class Rating : BaseEntity
    {
        public string Description { get; set; } = "";
        public string? Color { get; set; }
        public int Order { get; set; }
    }

    public class Flashcard : BaseEntity
    {
        public string Question { get; set; } = "";
        public string? QuestionFileName { get; set; }
        public string Answer { get; set; } = "";
        public string? AnswerFileName { get; set; }
        public int? TopicId { get; set; }

        public virtual Topic Topic { get; set; } = null!;
        public int? RatingId { get; set; }
        public virtual Rating Rating { get; set; } = null!;
        public DateTime? LastRated { get; set; }
    }

    public class Streak : BaseEntity
    {
        public int Days { get; set; }
        public DateTime? LastRated { get; set; }
    }

    public class Session : BaseEntity
    {
        public int NoFlashcards { get; set; }
        public int Points { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
