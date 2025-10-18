
using Flashcards.Api.DTOs;
using Flashcards.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Flashcards.Api.Controllers
{
    [ApiController]
    [Route("topics")]
    public class TopicsController : ControllerBase
    {
        private readonly TopicService _service;
        public TopicsController(TopicService service) => _service = service;

        [HttpGet]
        public async Task<ActionResult<List<TopicDto>>> Get() => Ok(await _service.GetActiveAsync());

        [HttpPost]
        public async Task<ActionResult<TopicDto>> Post([FromBody] UpsertTopicRequest req) =>
            Ok(await _service.UpsertAsync(req));

        [HttpDelete]
        public async Task<ActionResult> Delete([FromBody] BulkDeleteRequest req)
        {
            await _service.SoftDeleteAsync(req.Ids);
            return Ok(new { deleted = req.Ids.Count });
        }
    }
}
