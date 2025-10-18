import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../environments/environment';


@Injectable({ providedIn: 'root' })
export class MediaService {
private http = inject(HttpClient);
private driveIndex = signal<Record<string, string>>({});


buildIndex() {
const base = 'https://www.googleapis.com/drive/v3/files';
const params = new HttpParams()
.set('key', environment.googleDrive.apiKey)
.set('q', `'${environment.googleDrive.folderId}' in parents and trashed = false`)
.set('pageSize', '1000')
.set('fields', 'nextPageToken,files(id,name)');


this.http.get<{ files: { id: string; name: string }[] }>(base, { params })
.subscribe(res => {
const idx: Record<string, string> = {};
for (const f of (res.files || [])) idx[f.name] = f.id;
this.driveIndex.set(idx);
});
}


private toMediaUrl(id: string) {
return `${environment.googleDrive.mediaUrlPrefix}${id}?alt=media&key=${environment.googleDrive.apiKey}`;
}


resolve(name?: string | null): string | null {
if (!name) return null;
const raw = String(name).trim();
if (/^(https?:)?\/\//i.test(raw) || /^data:image\//i.test(raw) || /^blob:/i.test(raw)) return raw;


const idx = this.driveIndex();
let id = idx[raw];
if (!id && !raw.includes('.')) {
const exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
for (const ext of exts) { id = idx[raw + ext]; if (id) break; }
}
return id ? this.toMediaUrl(id) : null;
}
}