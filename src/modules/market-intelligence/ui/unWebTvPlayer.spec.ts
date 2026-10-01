import { afterEach, describe, expect, it, vi } from "vitest";
import { createUnWebTvPlayer, type UnWebTvSdk } from "./unWebTvPlayer";

function fixture() {
  const events = new EventTarget();
  let resolveReady!: () => void;
  let rejectReady!: (reason: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const player = {
    muted: false,
    loadMedia: vi.fn(() => Promise.resolve()),
    ready: () => ready,
    play: vi.fn((): void | Promise<void> => undefined),
    pause: vi.fn(),
    destroy: vi.fn(),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  const api: UnWebTvSdk = { setup: vi.fn(() => player) };
  const callbacks = {
    onReady: vi.fn(),
    onPlaying: vi.fn(),
    onMuted: vi.fn(),
    onBlocked: vi.fn(),
    onError: vi.fn(),
  };
  return {
    player,
    api,
    callbacks,
    resolveReady,
    rejectReady,
    emit: (name: string) => events.dispatchEvent(new Event(name)),
  };
}

afterEach(() => vi.useRealTimers());

describe("UN official player adapter", () => {
  it("ignores an older rejected play attempt after a newer request has started playing", async () => {
    const f = fixture();
    const control = createUnWebTvPlayer(f.api, "main", "1_kfcwu5kc", f.callbacks);
    f.resolveReady();
    await vi.waitFor(() => expect(f.callbacks.onReady).toHaveBeenCalledOnce());
    let rejectPlay!: (reason: Error) => void;
    f.player.play.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        rejectPlay = reject;
      }),
    );
    control.playVideo();
    control.playVideo();
    f.emit("playing");
    rejectPlay(new Error("old failure"));
    await Promise.resolve();
    await Promise.resolve();
    expect(f.callbacks.onPlaying).toHaveBeenLastCalledWith(true);
    expect(f.callbacks.onError).not.toHaveBeenCalled();
    expect(f.player.destroy).not.toHaveBeenCalled();
    control.destroy();
  });
  it("fixes provider identity and waits for SDK readiness, not a fabricated playing state", async () => {
    const f = fixture();
    const control = createUnWebTvPlayer(
      f.api,
      "main-player",
      "1_kfcwu5kc",
      f.callbacks,
    );
    expect(f.api.setup).toHaveBeenCalledWith({
      targetId: "main-player",
      provider: { partnerId: 2503451, uiConfId: 49754663 },
      playback: { autoplay: false },
    });
    expect(f.player.loadMedia).toHaveBeenCalledWith({ entryId: "1_kfcwu5kc" });
    control.playVideo();
    expect(f.player.play).not.toHaveBeenCalled();
    f.resolveReady();
    await vi.waitFor(() => expect(f.callbacks.onReady).toHaveBeenCalledOnce());
    expect(f.callbacks.onPlaying).not.toHaveBeenCalled();
    control.playVideo();
    expect(f.player.play).toHaveBeenCalledOnce();
    expect(f.callbacks.onPlaying).not.toHaveBeenCalled();
    f.emit("playing");
    expect(f.callbacks.onPlaying).toHaveBeenLastCalledWith(true);
    control.mute();
    expect(f.player.muted).toBe(true);
    f.emit("volumechange");
    expect(f.callbacks.onMuted).toHaveBeenLastCalledWith(true);
    control.unMute();
    expect(f.player.muted).toBe(false);
    control.pauseVideo();
    expect(f.player.pause).toHaveBeenCalledOnce();
    f.emit("ended");
    expect(f.callbacks.onPlaying).toHaveBeenLastCalledWith(false);
    control.destroy();
  });

  it.each(["https://evil.example/stream", "1_kfcwu5kc&ks=secret", "", "k1kfcwu5kc"])(
    "rejects a non-entry value before touching the SDK: %s",
    (id) => {
      const f = fixture();
      expect(() => createUnWebTvPlayer(f.api, "main", id, f.callbacks)).toThrow();
      expect(f.api.setup).not.toHaveBeenCalled();
    },
  );

  it("disposes once and ignores async readiness and events after switching away", async () => {
    const f = fixture();
    const control = createUnWebTvPlayer(f.api, "main", "1_kfcwu5kc", f.callbacks);
    control.destroy();
    control.destroy();
    f.resolveReady();
    await Promise.resolve();
    await Promise.resolve();
    f.emit("playing");
    control.playVideo();
    control.mute();
    expect(f.player.destroy).toHaveBeenCalledOnce();
    expect(f.player.play).not.toHaveBeenCalled();
    expect(f.player.muted).toBe(false);
    expect(f.callbacks.onReady).not.toHaveBeenCalled();
    expect(f.callbacks.onPlaying).not.toHaveBeenCalled();
  });

  it("reports loading failure and never exposes playable controls", async () => {
    const f = fixture();
    const control = createUnWebTvPlayer(f.api, "main", "1_kfcwu5kc", f.callbacks);
    f.rejectReady(new Error("unavailable"));
    await vi.waitFor(() => expect(f.callbacks.onError).toHaveBeenCalledOnce());
    control.playVideo();
    expect(f.player.play).not.toHaveBeenCalled();
    expect(f.callbacks.onReady).not.toHaveBeenCalled();
    expect(f.player.destroy).toHaveBeenCalledOnce();
  });

  it("times out hung loading and ignores eventual readiness", async () => {
    vi.useFakeTimers();
    const f = fixture();
    createUnWebTvPlayer(f.api, "main", "1_kfcwu5kc", f.callbacks);
    await vi.advanceTimersByTimeAsync(12000);
    expect(f.callbacks.onError).toHaveBeenCalledOnce();
    f.resolveReady();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.callbacks.onReady).not.toHaveBeenCalled();
    expect(f.player.destroy).toHaveBeenCalledOnce();
  });

  it("reports denied play as blocked, not playing or a destroyed source", async () => {
    const f = fixture();
    const control = createUnWebTvPlayer(f.api, "main", "1_kfcwu5kc", f.callbacks);
    f.resolveReady();
    await vi.waitFor(() => expect(f.callbacks.onReady).toHaveBeenCalledOnce());
    f.player.play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    control.playVideo();
    await vi.waitFor(() => expect(f.callbacks.onBlocked).toHaveBeenCalledOnce());
    expect(f.callbacks.onPlaying).not.toHaveBeenCalledWith(true);
    expect(f.player.destroy).not.toHaveBeenCalled();
    control.destroy();
  });
});
