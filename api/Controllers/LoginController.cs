
using Flashcards.Api.DTOs;
using Flashcards.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Flashcards.Api.Controllers
{
    [ApiController]
    public class LoginController : ControllerBase
    {
        private readonly StreakService _streak;
        public LoginController(StreakService streak) => _streak = streak;

        // Mimic n8n "Login" webhook that returns streak info after auth
        [HttpGet("login")]
        [Authorize(AuthenticationSchemes = "BasicAuth")]
        public async Task<ActionResult<StreakDto>> Login()
        {
            var s = await _streak.GetForUserAsync();
            return Ok(s);
        }
    }
}
