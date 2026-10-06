import { describe, it, expect } from "vitest";
import { mp3Filename } from "../src/lib/mp3";

describe("mp3 encoder (lamejs)", () => {
  it("encodes synthetic PCM to a valid MP3 stream", async () => {
    const { Mp3Encoder } = await import("@breezystack/lamejs");
    const sampleRate = 44100;
    const len = sampleRate / 2; // 0.5s
    const left = new Int16Array(len);
    const right = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const s = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 30000);
      left[i] = s;
      right[i] = s;
    }
    const enc = new Mp3Encoder(2, sampleRate, 128);
    const parts: Uint8Array[] = [];
    for (let i = 0; i < len; i += 1152) {
      const d = enc.encodeBuffer(left.subarray(i, i + 1152), right.subarray(i, i + 1152));
      if (d.length > 0) parts.push(new Uint8Array(d));
    }
    const end = enc.flush();
    if (end.length > 0) parts.push(new Uint8Array(end));
    const total = parts.reduce((n, p) => n + p.length, 0);
    expect(total).toBeGreaterThan(1000);
    const first = parts[0];
    const isId3 = first[0] === 0x49 && first[1] === 0x44 && first[2] === 0x33;
    const isFrameSync = first[0] === 0xff && (first[1] & 0xe0) === 0xe0;
    expect(isId3 || isFrameSync).toBe(true);
  }, 30000);
});

describe("mp3Filename", () => {
  it("builds safe names", () => {
    expect(mp3Filename("AbC-12")).toBe("threads-audio-AbC-12.mp3");
    expect(mp3Filename("../x")).toBe("threads-audio-x.mp3");
    expect(mp3Filename("")).toBe("threads-audio-post.mp3");
  });
});
