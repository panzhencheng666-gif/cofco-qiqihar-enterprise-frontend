import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { useOverviewNarration } from "./useOverviewNarration";

describe("useOverviewNarration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("speaks in Chinese and supports pause, resume and stop", () => {
    const speech = installSpeechSynthesis();
    const { result } = renderHook(() => useOverviewNarration("黑河市产情讲解"));

    act(() => result.current.start());

    expect(speech.speak).toHaveBeenCalledTimes(1);
    const utterance = speech.speak.mock.calls[0]?.[0] as FakeUtterance;
    expect(utterance.text).toBe("黑河市产情讲解");
    expect(utterance.lang).toBe("zh-CN");
    expect(utterance.rate).toBe(0.94);
    expect(result.current.state).toBe("speaking");

    act(() => result.current.pauseOrResume());
    expect(speech.pause).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("paused");

    act(() => result.current.pauseOrResume());
    expect(speech.resume).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("speaking");

    act(() => result.current.stop());
    expect(speech.cancel).toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });

  it("cancels stale narration when the transcript changes and on unmount", () => {
    const speech = installSpeechSynthesis();
    const { result, rerender, unmount } = renderHook(
      ({ transcript }) => useOverviewNarration(transcript),
      { initialProps: { transcript: "齐齐哈尔市讲解" } },
    );
    act(() => result.current.start());
    speech.cancel.mockClear();

    rerender({ transcript: "呼伦贝尔市讲解" });
    expect(speech.cancel).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("idle");

    act(() => result.current.start());
    speech.cancel.mockClear();
    unmount();
    expect(speech.cancel).toHaveBeenCalledTimes(1);
  });

  it("keeps the written transcript usable when speech is unsupported", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    vi.stubGlobal("SpeechSynthesisUtterance", undefined);
    const { result } = renderHook(() => useOverviewNarration("文字讲解"));

    expect(result.current.availability).toBe("unsupported");
    expect(result.current.state).toBe("idle");
    expect(() => result.current.start()).not.toThrow();
  });
});

class FakeUtterance {
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {}
}

function installSpeechSynthesis() {
  const speech = {
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    speak: vi.fn(),
  };
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("speechSynthesis", speech);
  return speech;
}
