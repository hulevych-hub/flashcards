
using Flashcards.Api.DTOs;
using Flashcards.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Flashcards.Api.Controllers
{
    [ApiController]
    [Route("ratings")]
    public class RatingsController : ControllerBase
    {
        private readonly RatingService _service;
        public RatingsController(RatingService service) => _service = service;

        [HttpGet]
        public async Task<ActionResult<List<RatingDto>>> Get() => Ok(await _service.GetActiveAsync());

        [HttpPost]
        public async Task<ActionResult<RatingDto>> Post([FromBody] UpsertRatingRequest req) =>
            Ok(await _service.UpsertAsync(req));

        [HttpDelete]
        public async Task<ActionResult> Delete([FromBody] BulkDeleteRequest req)
        {
            await _service.SoftDeleteAsync(req.Ids);
            return Ok(new { deleted = req.Ids.Count });
        }
    }
}
