/** Where a problem report came from: the screen, never anything the person typed elsewhere. */
export function problemBody(text: string, screen: string): string {
  return `${text.trim()}\n\nScreen: ${screen}`.slice(0, 4000);
}
