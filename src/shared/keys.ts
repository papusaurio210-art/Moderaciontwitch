export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}

// One-way derivation lets an editor recover the viewer link after reload.
// Storage retains only hashes; a viewer cannot derive the editor capability.
export const viewerKeyFromEditor = (key: string) => sha256(`overlay-studio:viewer:v1:${key}`);
export function randomHex(bytes: number) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
}
