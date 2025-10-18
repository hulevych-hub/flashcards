
using Flashcards.Api.DTOs;
using Flashcards.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Flashcards.Api.Controllers
{
    [ApiController]
    [Route("flashcards")]
    public class FlashcardsController : ControllerBase
    {
        private readonly FlashcardService _service;
        public FlashcardsController(FlashcardService service) => _service = service;

        [HttpGet]
        public async Task<ActionResult<List<FlashcardDto>>> Get() => Ok(await _service.GetActiveAsync());

        [HttpPost]
        public async Task<ActionResult<FlashcardDto>> Post([FromBody] UpsertFlashcardRequest req) =>
            Ok(await _service.UpsertAsync(req));

        [HttpDelete]
        public async Task<ActionResult> Delete([FromBody] BulkDeleteRequest req)
        {
            await _service.SoftDeleteAsync(req.Ids);
            return Ok(new { deleted = req.Ids.Count });
        }

        [HttpPost("/rate")]
        public async Task<ActionResult> Rate([FromBody] RateFlashcardRequest req)
        {
            var updated = await _service.UpdateRatingAsync(req);
            return Ok(new { updated });
        }
    }
}
