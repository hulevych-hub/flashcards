using Flashcards.Api.Data;
using Flashcards.Api.Repositories;
using Microsoft.EntityFrameworkCore;

public static class StartupExtension
{
    private const string ConnectionStringName = "Flashcards";

    public static IServiceCollection AddDataLayer(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException($"Connection string '{ConnectionStringName}' was not found in configuration.");
        }

        services.AddDbContext<FlashcardsContext>(options =>
            options.UseNpgsql(connectionString)
                    .UseLazyLoadingProxies());

        services.AddScoped<IFlashcardRepository, FlashcardRepository>();
        services.AddScoped<ITopicRepository, TopicRepository>();
        services.AddScoped<IRatingRepository, RatingRepository>();
        services.AddScoped<IStreakRepository, StreakRepository>();
        services.AddScoped<ISessionRepository, SessionRepository>();

        return services;
    }
}
