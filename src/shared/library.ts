import type { Item, MediaFile } from './model';
export type MediaKind = 'image' | 'gif' | 'video';
export function mediaKind(media: MediaFile): MediaKind {
  return media.mime === 'image/gif' ? 'gif' : media.mime.startsWith('video/') ? 'video' : 'image';
}
export function mediaUsage(items: Item[], mediaId: string): number {
  return items.filter(item => 'mediaId' in item && item.mediaId === mediaId).length;
}
export function filterMedia(media: MediaFile[], items: Item[], query: string, kind: 'all' | MediaKind, usage: 'all' | 'used' | 'unused'): MediaFile[] {
  const search = query.trim().toLocaleLowerCase();
  return media.filter(file => file.name.toLocaleLowerCase().includes(search) && (kind === 'all' || mediaKind(file) === kind)
    && (usage === 'all' || (mediaUsage(items, file.id) > 0) === (usage === 'used')));
}
