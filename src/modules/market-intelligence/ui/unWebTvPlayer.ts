type SdkPlayer = {
  muted: boolean;
  loadMedia: (media: { entryId: string }) => Promise<unknown> | void;
  ready: () => Promise<unknown>;
  play: () => Promise<void> | void;
  pause: () => void;
  destroy: () => void;
  addEventListener: (name: string, listener: EventListener) => void;
  removeEventListener: (name: string, listener: EventListener) => void;
};

export type UnWebTvSdk = {
  setup: (config: {
    targetId: string;
    provider: { partnerId: number; uiConfId: number };
    playback: { autoplay: boolean };
  }) => SdkPlayer;
};

declare global {
  interface Window {
    KalturaPlayer?: UnWebTvSdk;
  }
}

let sdkRequest: Promise<UnWebTvSdk> | null = null;

export function loadUnWebTvSdk(): Promise<UnWebTvSdk> {
  if (typeof window.KalturaPlayer?.setup === "function")
    return Promise.resolve(window.KalturaPlayer);
  if (sdkRequest) return sdkRequest;
  sdkRequest = new Promise<UnWebTvSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.unWebtvSdk = "true";
    // Fixed official embed configuration, never a URL supplied by catalogue data.
    script.src =
      "https://cdnapisec.kaltura.com/p/2503451/embedPlaykitJs/uiconf_id/49754663";
    script.async = true;
    let settled = false;
    const timer = window.setTimeout(fail, 12000);
    function clear() {
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    }
    function fail() {
      if (settled) return;
      settled = true;
      clear();
      script.remove();
      sdkRequest = null;
      reject(new Error("Official player SDK unavailable"));
    }
    script.onerror = fail;
    script.onload = () => {
      if (settled) return;
      if (typeof window.KalturaPlayer?.setup !== "function") return fail();
      settled = true;
      clear();
      resolve(window.KalturaPlayer);
    };
    document.head.appendChild(script);
  });
  return sdkRequest;
}

type Callbacks = {
  onReady: () => void;
  onPlaying: (playing: boolean) => void;
  onMuted: (muted: boolean) => void;
  onBlocked: () => void;
  onError: () => void;
};

type Controls = {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
};

export function createUnWebTvPlayer(
  api: UnWebTvSdk,
  targetId: string,
  entryId: string,
  callbacks: Callbacks,
): Controls {
  // This is an SDK boundary, not source admission or a live-status assertion.
  // The caller must obtain entries from an admitted official programme source.
  if (!/^1_[a-z0-9]{8}$/.test(entryId) || !targetId.trim()) {
    throw new Error("Invalid official programme target");
  }
  const player = api.setup({
    targetId,
    provider: { partnerId: 2503451, uiConfId: 49754663 },
    playback: { autoplay: false },
  });
  let disposed = false;
  let ready = false;
  let playAttempt = 0;
  const listeners: Array<[string, EventListener]> = [];
  const timer = window.setTimeout(fail, 12000);

  function destroy() {
    if (disposed) return;
    disposed = true;
    ready = false;
    window.clearTimeout(timer);
    for (const [name, listener] of listeners) {
      player.removeEventListener(name, listener);
    }
    player.destroy();
  }

  function fail() {
    if (disposed) return;
    destroy();
    callbacks.onError();
  }

  function listen(name: string, handler: () => void) {
    const listener: EventListener = () => {
      if (!disposed) handler();
    };
    listeners.push([name, listener]);
    player.addEventListener(name, listener);
  }

  listen("playing", () => {
    playAttempt += 1;
    callbacks.onPlaying(true);
  });
  for (const name of ["pause", "ended", "waiting"]) {
    listen(name, () => callbacks.onPlaying(false));
  }
  listen("volumechange", () => callbacks.onMuted(player.muted));
  listen("error", fail);

  async function load() {
    try {
      await player.loadMedia({ entryId });
      if (disposed) return;
      await player.ready();
      if (disposed) return;
      window.clearTimeout(timer);
      ready = true;
      callbacks.onReady();
    } catch {
      fail();
    }
  }
  void load();

  function command(action: () => void) {
    if (disposed || !ready) return;
    try {
      action();
    } catch {
      fail();
    }
  }

  async function play() {
    if (disposed || !ready) return;
    const attempt = ++playAttempt;
    try {
      await player.play();
      // Only a provider 'playing' event can declare playback success.
    } catch (error) {
      if (disposed || attempt !== playAttempt) return;
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "NotAllowedError"
      ) {
        callbacks.onBlocked();
      } else {
        fail();
      }
    }
  }

  return {
    playVideo: () => {
      void play();
    },
    pauseVideo: () =>
      command(() => {
        playAttempt += 1;
        player.pause();
      }),
    mute: () =>
      command(() => {
        player.muted = true;
      }),
    unMute: () =>
      command(() => {
        player.muted = false;
      }),
    destroy,
  };
}
