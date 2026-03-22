const STORAGE_KEY = "liveTranscription";

export function getLiveTranscriptionEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}
