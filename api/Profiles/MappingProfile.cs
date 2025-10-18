
using AutoMapper;
using Flashcards.Api.DTOs;
using Flashcards.Api.Entities;

namespace Flashcards.Api.Profiles
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<Topic, TopicDto>().ReverseMap();
            CreateMap<Rating, RatingDto>().ReverseMap();
            CreateMap<Flashcard, FlashcardDto>().ReverseMap();

            CreateMap<UpsertTopicRequest, Topic>();
            CreateMap<UpsertRatingRequest, Rating>();
            CreateMap<UpsertFlashcardRequest, Flashcard>();
        }
    }
}
