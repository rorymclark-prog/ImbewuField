export const LANGUAGE_CHANGE_EVENT = 'imbewu-language-change';

export function listenForLanguageChanges(
  target: EventTarget,
  onChange: (code: string) => void,
): () => void {
  const listener = (event: Event) => {
    const code = (event as CustomEvent<unknown>).detail;
    if (typeof code === 'string' && code) onChange(code);
  };
  target.addEventListener(LANGUAGE_CHANGE_EVENT, listener);
  return () => target.removeEventListener(LANGUAGE_CHANGE_EVENT, listener);
}

export function announceLanguageChange(target: EventTarget, code: string): void {
  target.dispatchEvent(new CustomEvent<string>(LANGUAGE_CHANGE_EVENT, { detail: code }));
}

