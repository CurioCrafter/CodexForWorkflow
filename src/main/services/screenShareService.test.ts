import { describe, expect, it } from "vitest";
import { mapDesktopSource } from "./screenShareService";

const image = {
  isEmpty: () => false,
  toDataURL: () => "data:image/png;base64,abc",
  getSize: () => ({ width: 320, height: 200 })
};

describe("mapDesktopSource", () => {
  it("maps screens with thumbnails", () => {
    expect(
      mapDesktopSource({
        id: "screen:1:0",
        name: "Entire Screen",
        display_id: "123",
        thumbnail: image
      })
    ).toEqual({
      id: "screen:1:0",
      name: "Entire Screen",
      type: "screen",
      displayId: "123",
      thumbnail: "data:image/png;base64,abc"
    });
  });

  it("omits empty thumbnails", () => {
    const source = mapDesktopSource({
      id: "window:10:0",
      name: "App",
      thumbnail: { ...image, isEmpty: () => true }
    });

    expect(source.type).toBe("window");
    expect(source.thumbnail).toBeUndefined();
  });
});
