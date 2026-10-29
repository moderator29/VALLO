import { describe, expect, it } from "vitest";
import { parseSignedLink } from "./signed-link";

const PROJECT = "https://abc.supabase.co";

describe("parseSignedLink", () => {
  it("reads the bucket and path of a signed media link on this project", () => {
    expect(parseSignedLink(`${PROJECT}/storage/v1/object/sign/listing-videos/u1/clip.mp4?token=x`, PROJECT)).toEqual({
      bucket: "listing-videos",
      path: "u1/clip.mp4",
    });
  });

  it("refuses another host, a plain link, an unlisted bucket and a path that climbs", () => {
    expect(parseSignedLink("https://evil.example/storage/v1/object/sign/listing-videos/a.mp4", PROJECT)).toBeNull();
    expect(parseSignedLink(`${PROJECT}/storage/v1/object/public/listing-videos/a.mp4`, PROJECT)).toBeNull();
    expect(parseSignedLink(`${PROJECT}/storage/v1/object/sign/tenancy-evidence/a.pdf`, PROJECT)).toBeNull();
    expect(parseSignedLink(`${PROJECT}/storage/v1/object/sign/listing-videos/..%2Fsecret`, PROJECT)).toBeNull();
    expect(parseSignedLink("not a url", PROJECT)).toBeNull();
  });
});
