import { describe, expect, it } from "vitest";
import { NATIVE_BACK_EVENT } from "./native-back-event";

/* Node's own EventTarget stands in for the document: happy-dom is not a
   dependency of this project, so the environment comment this file used to
   carry stopped the worker from starting and the test never ran. */
const document = new EventTarget();

describe("Android Back offered to the page first", () => {
  it("a listener that claims it cancels the event; with none it is not claimed", () => {
    const fire = () => {
      const event = new Event(NATIVE_BACK_EVENT, { cancelable: true });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(fire()).toBe(false);
    const claim = (event: Event) => event.preventDefault();
    document.addEventListener(NATIVE_BACK_EVENT, claim);
    expect(fire()).toBe(true);
    document.removeEventListener(NATIVE_BACK_EVENT, claim);
    expect(fire()).toBe(false);
  });
});
