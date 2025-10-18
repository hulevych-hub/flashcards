
using Flashcards.Api.DTOs;
using Flashcards.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Flashcards.Api.Controllers
{
    [ApiController]
    [Route("session")]
    public class SessionsController : ControllerBase
    {
        private readonly SessionService _service;
        public SessionsController(SessionService service) => _service = service;

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] SessionRequest req)
        {
            var s = await _service.CreateAsync(req);
            return Ok(new { s.Id, s.NoFlashcards, s.Points, s.StartDate, s.EndDate });
        }
    }
}
