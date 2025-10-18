
namespace Flashcards.Api.DTOs
{
    public class TopicDto
    {
        public int Id { get; set; }
        public string Description { get; set; } = "";
    }

    public class UpsertTopicRequest
    {
        public int? Id { get; set; } = null;
        public string Description { get; set; } = "";
    }

    public class RatingDto
    {
        public int Id { get; set; }
        public string Description { get; set; } = "";
        public string? Color { get; set; }
        public int? Order { get; set; }
    }

    public class UpsertRatingRequest
    {
        public int? Id { get; set; } = null;
        public string Description { get; set; } = "";
        public string? Color { get; set; }
        public int? Order { get; set; }
    }

    public class FlashcardDto
    {
        public int Id { get; set; }
        public string Question { get; set; } = "";
        public string? QuestionImage { get; set; }
        public string? QuestionFileName { get; set; }
        public string Answer { get; set; } = "";
        public string? AnswerImage { get; set; }
        public string? AnswerFileName { get; set; }
        public int? TopicId { get; set; }
        public int? RatingId { get; set; }
        public DateTime? LastRated { get; set; }
    }

    public class UpsertFlashcardRequest
    {
        public int? Id { get; set; } = null;
        public string Question { get; set; } = "";
        public string? QuestionImage { get; set; }
        public string? QuestionFileName { get; set; }
        public string Answer { get; set; } = "";
        public string? AnswerImage { get; set; }
        public string? AnswerFileName { get; set; }
        public int? TopicId { get; set; }
        public int? RatingId { get; set; }
    }

    public class RateFlashcardRequest
    {
        public int FlashcardId { get; set; }
        public int RatingId { get; set; }
    }

    public class BulkDeleteRequest
    {
        public List<int> Ids { get; set; } = new();
    }

    public class StreakDto
    {
        public int Streak { get; set; }
        public DateTime? LastRated { get; set; }
    }

    public class SessionRequest
    {
        public int FlashcardsCount { get; set; }
        public int Points { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
