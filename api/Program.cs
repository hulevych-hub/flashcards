
using System.Net.Http.Headers;
using System.Text;
using AutoMapper;
using Flashcards.Api.Data;
using Flashcards.Api.Repositories;
using Flashcards.Api.Services;
using Flashcards.Api.Profiles;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Encodings.Web;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAutoMapper(typeof(MappingProfile));

builder.Services.AddDataLayer(builder.Configuration);

builder.Services.AddScoped<IImageStorage, LocalImageStorage>();
builder.Services.AddScoped<FlashcardService>();
builder.Services.AddScoped<TopicService>();
builder.Services.AddScoped<RatingService>();
builder.Services.AddScoped<StreakService>();
builder.Services.AddScoped<SessionService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCorsPolicy", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        // Optional: if you return enums as strings
        // o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Basic Auth (in-memory)
builder.Services.AddAuthentication("BasicAuth")
    .AddScheme<AuthenticationSchemeOptions, SimpleBasicAuthHandler>("BasicAuth", null);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<FlashcardsContext>();
    dbContext.Database.Migrate();
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseRouting();
app.UseCors("DefaultCorsPolicy");

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.UseStaticFiles(); // serves wwwroot and /images if they exist in app root

app.MapControllers();

app.Run();

// --------------- Basic Auth Handler -----------------
public class SimpleBasicAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly IConfiguration _config;
    public SimpleBasicAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder, ISystemClock clock, IConfiguration config)
        : base(options, logger, encoder, clock)
    {
        _config = config;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.ContainsKey("Authorization"))
            return Task.FromResult(AuthenticateResult.Fail("Missing Authorization Header"));

        try
        {
            var authHeader = AuthenticationHeaderValue.Parse(Request.Headers["Authorization"]);
            if (authHeader.Scheme != "Basic") return Task.FromResult(AuthenticateResult.Fail("Invalid scheme"));
            var credentialBytes = Convert.FromBase64String(authHeader.Parameter ?? "");
            var credentials = Encoding.UTF8.GetString(credentialBytes).Split(':', 2);
            if (credentials.Length != 2) return Task.FromResult(AuthenticateResult.Fail("Invalid header"));

            var username = _config["Auth:Username"];
            var password = _config["Auth:Password"];
            if (credentials[0] == username && credentials[1] == password)
            {
                var claims = new[] { new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, username!) };
                var identity = new System.Security.Claims.ClaimsIdentity(claims, Scheme.Name);
                var principal = new System.Security.Claims.ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, Scheme.Name);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
            return Task.FromResult(AuthenticateResult.Fail("Invalid credentials"));
        }
        catch
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid Authorization Header"));
        }
    }
}
