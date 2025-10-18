using AutoMapper;
using Flashcards.Api.DTOs;
using Flashcards.Api.Entities;
using Flashcards.Api.Repositories;
using System.Text.RegularExpressions;

namespace Flashcards.Api.Services
{
    public class TopicService
    {
        private readonly ITopicRepository _repo;
        private readonly IMapper _mapper;
        public TopicService(ITopicRepository repo, IMapper mapper) { _repo = repo; _mapper = mapper; }

        public async Task<List<TopicDto>> GetActiveAsync() =>
            (await _repo.GetIsActiveAsync()).Select(_mapper.Map<TopicDto>).ToList();

        public async Task<TopicDto> UpsertAsync(UpsertTopicRequest req)
        {
            var entity = _mapper.Map<Topic>(req);
            var saved = await _repo.UpsertAsync(entity);
            return _mapper.Map<TopicDto>(saved);
        }

        public Task<int> SoftDeleteAsync(List<int> ids) => _repo.SoftDeleteAsync(ids);
    }

    public class RatingService
    {
        private readonly IRatingRepository _repo;
        private readonly IMapper _mapper;
        public RatingService(IRatingRepository repo, IMapper mapper) { _repo = repo; _mapper = mapper; }

        public async Task<List<RatingDto>> GetActiveAsync() =>
            (await _repo.GetIsActiveAsync()).Select(_mapper.Map<RatingDto>).ToList();

        public async Task<RatingDto> UpsertAsync(UpsertRatingRequest req)
        {
            var entity = _mapper.Map<Rating>(req);
            var saved = await _repo.UpsertAsync(entity);
            return _mapper.Map<RatingDto>(saved);
        }

        public Task<int> SoftDeleteAsync(List<int> ids) => _repo.SoftDeleteAsync(ids);
    }

    public class FlashcardService
    {
        private readonly IFlashcardRepository _repo;
        private readonly IStreakRepository _streakRepo;
        private readonly IImageStorage _imageStorage;
        private readonly IMapper _mapper;
        private readonly IWebHostEnvironment _env;

        public FlashcardService(IFlashcardRepository repo, IStreakRepository streakRepo, IMapper mapper, IImageStorage imageStorage, IWebHostEnvironment env)
        {
            _repo = repo;
            _streakRepo = streakRepo;
            _mapper = mapper;
            _imageStorage = imageStorage;
            _env = env;
        }

        public async Task<List<FlashcardDto>> GetActiveAsync()
        {
            var cards = await _repo.GetIsActiveAsync();
            var dtos = cards.Select(_mapper.Map<FlashcardDto>).ToList();

            var tasks = dtos.Select(async dto =>
            {
                // question
                if (!string.IsNullOrWhiteSpace(dto.QuestionFileName))
                {
                    var qPhysical = $"{dto.Id}_q_{dto.QuestionFileName}";
                    dto.QuestionImage = await _imageStorage.TryReadActiveAsBase64DataUriAsync(qPhysical);
                }

                // answer
                if (!string.IsNullOrWhiteSpace(dto.AnswerFileName))
                {
                    var aPhysical = $"{dto.Id}_a_{dto.AnswerFileName}";
                    dto.AnswerImage = await _imageStorage.TryReadActiveAsBase64DataUriAsync(aPhysical);
                }
            });

            await Task.WhenAll(tasks);
            return dtos;
        }

        public async Task<FlashcardDto> UpsertAsync(UpsertFlashcardRequest req)
        {
            var entity = _mapper.Map<Flashcard>(req);
            var isNew = entity.Id == 0;
            FlashcardDto oldFlashcard = null;
            if (!isNew)
            {
                oldFlashcard = _mapper.Map<FlashcardDto>((await _repo.GetByIdAsync(entity.Id))); // implement in repo
            }
            
            // 1) Persist first to obtain Id
            var saved = await _repo.UpsertAsync(entity); // must return Id

            var qFileName = entity.Id + "_q_" + entity.QuestionFileName;
            var aFileName = entity.Id + "_a_" + entity.AnswerFileName;

            try
            {
                if (!string.IsNullOrWhiteSpace(req.QuestionImage))
                {
                    await _imageStorage.SaveBase64Async(req.QuestionImage!, qFileName);
                    if(oldFlashcard is not null && oldFlashcard.QuestionFileName != "" && oldFlashcard.QuestionFileName != req.QuestionFileName)
                    {
                        var oldQFileName = oldFlashcard.Id + "_q_" + oldFlashcard.QuestionFileName;
                        await _imageStorage.MoveToRemovedAsync(oldQFileName);
                    }

                }

                if (!string.IsNullOrWhiteSpace(req.AnswerImage))
                {
                    await _imageStorage.SaveBase64Async(req.AnswerImage!, aFileName);
                    if (oldFlashcard is not null && oldFlashcard.AnswerFileName != "" && oldFlashcard.AnswerFileName != req.AnswerFileName)
                    {
                        var oldAFileName = oldFlashcard.Id + "_a_" + oldFlashcard.AnswerFileName;
                        await _imageStorage.MoveToRemovedAsync(oldAFileName);
                    }
                }

                saved = await _repo.UpsertAsync(saved);
                return _mapper.Map<FlashcardDto>(saved);
            }
            catch
            {
                // Clean attempted new files
                try
                {
                    await _imageStorage.DeleteIfExistsAsync(qFileName);
                    await _imageStorage.DeleteIfExistsAsync(aFileName);
                }
                catch { /* best-effort */ }

                if (isNew)
                {
                    await _repo.SoftDeleteAsync([saved.Id]);
                }
                else
                {
                    // revert DB names (no need to touch files beyond best-effort above)
                    saved = _mapper.Map<Flashcard>(oldFlashcard);
                    await _repo.UpsertAsync(saved);
                }
                throw;
            }
        }

        public async Task<int> SoftDeleteAsync(List<int> ids)
        {
            var deletedCounter = 0;
            foreach(var id in ids)
            {
                var flashcard = _mapper.Map<FlashcardDto>(await _repo.GetByIdAsync(id));

                if (!string.IsNullOrWhiteSpace(flashcard.QuestionFileName))
                {
                    var qFile = $"{flashcard.Id}_q_{flashcard.QuestionFileName}";
                    await _imageStorage.MoveToRemovedAsync(qFile);
                }

                if (!string.IsNullOrWhiteSpace(flashcard.AnswerFileName))
                {
                    var aFile = $"{flashcard.Id}_a_{flashcard.AnswerFileName}";
                    await _imageStorage.MoveToRemovedAsync(aFile);
                }
                await _repo.SoftDeleteAsync([id]);
                deletedCounter++;
            }

            return deletedCounter;
        }

        public async Task<int> UpdateRatingAsync(RateFlashcardRequest req)
        {
            // 1) Update flashcard rating
            var updated = await _repo.UpdateRatingAsync(req.FlashcardId, req.RatingId, DateTime.UtcNow);

            // 2) Streak logic (single-row, calendar-day based)
            var today = DateTime.UtcNow.Date;
            var streak = await _streakRepo.GetOrCreateAsync();
            var last = streak.LastRated?.Date;

            // Same calendar day → no streak changes
            if (last == today)
                return updated;

            // Exactly one-day gap OR never rated before → increase
            if (last == null || (today - last.Value).TotalDays == 1)
            {
                var newDays = streak.Days + 1;
                await _streakRepo.UpdateAsync(newDays, today);
                return updated;
            }

            // Gap > 1 day → reset then count today as 1
            if ((today - last.Value).TotalDays > 1)
            {
                await _streakRepo.UpdateAsync(1, today);
            }

            return updated;
        }
    }

    public class StreakService
    {
        private readonly IStreakRepository _repo;
        public StreakService(IStreakRepository repo) { _repo = repo; }

        public async Task<StreakDto> GetForUserAsync()   // no parameter
        {
            var s = await _repo.GetOrCreateAsync();

            var today = DateTime.UtcNow.Date;
            var last = s.LastRated?.Date;

            // If never rated OR gap > 1 day → reset to 0 (and persist)
            if (last == null || (today - last.Value).TotalDays > 1)
            {
                s = await _repo.UpdateAsync(0, last);
            }

            return new StreakDto { Streak = s.Days, LastRated = s.LastRated };
        }
    }

    public class SessionService
    {
        private readonly ISessionRepository _repo;
        public SessionService(ISessionRepository repo) { _repo = repo; }

        public Task<Entities.Session> CreateAsync(SessionRequest req) =>
            _repo.CreateAsync(req.FlashcardsCount, req.Points, req.StartDate, req.EndDate);
        // ^ If your DTO uses NoFlashcards instead of Flashcards, switch to req.NoFlashcards.
    }


    public interface IImageStorage
    {
        /// <summary>
        /// Save base64 image to images/active/{fileName}. Overwrites if exists.
        /// </summary>
        Task SaveBase64Async(string base64, string fileName);

        /// <summary>
        /// Move images/active/{fileName} to images/removed/{fileName}. No-op if not found.
        /// </summary>
        Task MoveToRemovedAsync(string fileName);

        Task DeleteIfExistsAsync(string fileName, bool lookInRemovedToo = false);

        Task<string?> TryReadActiveAsBase64DataUriAsync(string fileName);
        /// <summary>
        /// Returns the relative public path e.g. "/images/active/{fileName}".
        /// </summary>
        string GetActivePublicPath(string fileName);
    }

    public sealed class LocalImageStorage : IImageStorage
    {
        private readonly IWebHostEnvironment _env;

        private const string ActiveFolder = "images/active";
        private const string RemovedFolder = "images/removed";

        private static readonly Regex DataUriRegex =
            new(@"^data:(?<mime>image\/[a-zA-Z0-9.+-]+);base64,(?<data>.+)$", RegexOptions.Compiled);

        // Known extensions to try when caller passes a name without extension
        private static readonly string[] KnownExts = new[]
        {
        ".png",".jpg",".jpeg",".webp",".gif",".svg",".bmp",".tif",".tiff",".ico"
    };

        // Map MIME -> extension
        private static readonly IReadOnlyDictionary<string, string> MimeToExt =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["image/png"] = ".png",
                ["image/jpeg"] = ".jpg",
                ["image/jpg"] = ".jpg",
                ["image/webp"] = ".webp",
                ["image/gif"] = ".gif",
                ["image/svg+xml"] = ".svg",
                ["image/bmp"] = ".bmp",
                ["image/tiff"] = ".tif",
                ["image/x-icon"] = ".ico",
            };

        public LocalImageStorage(IWebHostEnvironment env) => _env = env;

        public async Task SaveBase64Async(string base64, string fileName)
        {
            if (string.IsNullOrWhiteSpace(base64))
                throw new ArgumentException("Empty image payload.", nameof(base64));

            // Ensure an extension based on the MIME in the data URI
            fileName = EnsureExtensionFromDataUri(fileName, base64);
            fileName = SanitizeFileName(fileName);

            var bytes = ExtractBytes(base64);

            var absDir = Path.Combine(_env.ContentRootPath, ActiveFolder);
            Directory.CreateDirectory(absDir);

            var absPath = Path.Combine(absDir, fileName);
            await File.WriteAllBytesAsync(absPath, bytes);
        }

        public async Task MoveToRemovedAsync(string fileName)
        {
            fileName = SanitizeFileName(fileName);

            var absActiveDir = Path.Combine(_env.ContentRootPath, ActiveFolder);
            var absRemovedDir = Path.Combine(_env.ContentRootPath, RemovedFolder);

            // Resolve the real file if extension is missing
            var src = await ResolveExistingActiveFileAsync(absActiveDir, fileName);
            if (src == null) { await Task.CompletedTask; return; }

            Directory.CreateDirectory(absRemovedDir);

            var actualName = Path.GetFileName(src);
            var dst = Path.Combine(absRemovedDir, actualName);

            // Avoid overwrite in removed
            if (File.Exists(dst))
            {
                var (baseName, ext) = SplitName(actualName);
                dst = Path.Combine(absRemovedDir, $"{baseName}_{DateTime.UtcNow:yyyyMMddHHmmssfff}{ext}");
            }

            File.Move(src, dst);
            await Task.CompletedTask;
        }

        public async Task DeleteIfExistsAsync(string fileName, bool lookInRemovedToo = false)
        {
            fileName = SanitizeFileName(fileName);

            var absActiveDir = Path.Combine(_env.ContentRootPath, ActiveFolder);
            var absRemovedDir = Path.Combine(_env.ContentRootPath, RemovedFolder);

            // Try active (resolve real file if ext missing)
            var activePath = await ResolveExistingActiveFileAsync(absActiveDir, fileName);
            if (activePath != null && File.Exists(activePath))
            {
                File.Delete(activePath);
                await Task.CompletedTask;
                return;
            }

            if (lookInRemovedToo)
            {
                // Try removed (resolve similarly)
                var removedPath = await ResolveExistingActiveFileAsync(absRemovedDir, fileName);
                if (removedPath != null && File.Exists(removedPath))
                    File.Delete(removedPath);
            }

            await Task.CompletedTask;
        }

        public async Task<string?> TryReadActiveAsBase64DataUriAsync(string fileName)
        {
            fileName = Path.GetFileName(fileName);
            var absActiveDir = Path.Combine(_env.ContentRootPath, ActiveFolder);

            // Resolve actual file if extension was omitted
            var absPath = await ResolveExistingActiveFileAsync(absActiveDir, fileName);
            if (absPath == null || !File.Exists(absPath)) return null;

            var bytes = await File.ReadAllBytesAsync(absPath);
            var ext = Path.GetExtension(absPath).ToLowerInvariant();

            // Infer MIME from extension (don’t try to parse bytes as data URI)
            var mime = ext switch
            {
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".webp" => "image/webp",
                ".gif" => "image/gif",
                ".svg" => "image/svg+xml",
                ".bmp" => "image/bmp",
                ".tif" or ".tiff" => "image/tiff",
                ".ico" => "image/x-icon",
                _ => "application/octet-stream"
            };

            return $"data:{mime};base64,{Convert.ToBase64String(bytes)}";
        }

        public string GetActivePublicPath(string fileName)
            => "/" + Path.Combine(ActiveFolder, SanitizeFileName(fileName)).Replace('\\', '/');

        // ----------------- helpers -----------------

        private static string SanitizeFileName(string name)
        {
            name = Path.GetFileName(name);
            if (string.IsNullOrWhiteSpace(name)) name = "image.png";

            foreach (var c in Path.GetInvalidFileNameChars())
                name = name.Replace(c, '_');

            return name;
        }

        private static (string baseName, string ext) SplitName(string name)
        {
            var ext = Path.GetExtension(name);
            var baseName = Path.GetFileNameWithoutExtension(name);
            return (string.IsNullOrEmpty(baseName) ? "image" : baseName,
                    string.IsNullOrEmpty(ext) ? ".png" : ext);
        }

        private static byte[] ExtractBytes(string base64OrDataUri)
        {
            var m = DataUriRegex.Match(base64OrDataUri);
            var payload = m.Success ? m.Groups["data"].Value : base64OrDataUri;
            try { return Convert.FromBase64String(payload); }
            catch (FormatException) { throw new ArgumentException("Invalid base64 image payload."); }
        }

        private static string? TryGetMimeFromDataUri(string base64OrDataUri)
        {
            var m = DataUriRegex.Match(base64OrDataUri);
            return m.Success ? m.Groups["mime"].Value : null;
        }

        /// <summary>
        /// If fileName has no extension, append one inferred from the data URI's MIME; else return as-is.
        /// Falls back to .png if MIME is unknown.
        /// </summary>
        private static string EnsureExtensionFromDataUri(string fileName, string base64OrDataUri)
        {
            fileName = Path.GetFileName(fileName);
            var ext = Path.GetExtension(fileName);
            if (!string.IsNullOrEmpty(ext)) return fileName;

            var mime = TryGetMimeFromDataUri(base64OrDataUri);
            if (!string.IsNullOrWhiteSpace(mime) && MimeToExt.TryGetValue(mime!, out var mapped))
                return fileName + mapped;

            return fileName + ".png"; // safe default
        }

        /// <summary>
        /// Given a nominal file name (maybe without extension), returns the existing full path in 'dir',
        /// trying the exact name first, then the name with known image extensions.
        /// Returns null if nothing exists.
        /// </summary>
        private static Task<string?> ResolveExistingActiveFileAsync(string dir, string fileName)
        {
            fileName = Path.GetFileName(fileName);
            var exact = Path.Combine(dir, fileName);
            if (File.Exists(exact)) return Task.FromResult<string?>(exact);

            // If no extension was supplied, try common ones
            if (string.IsNullOrEmpty(Path.GetExtension(fileName)))
            {
                var baseName = fileName;
                foreach (var ext in KnownExts)
                {
                    var candidate = Path.Combine(dir, baseName + ext);
                    if (File.Exists(candidate)) return Task.FromResult<string?>(candidate);
                }
            }

            return Task.FromResult<string?>(null);
        }
    }

}