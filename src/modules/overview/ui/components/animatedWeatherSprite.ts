import type { LiveWeatherKind } from "./liveWeatherPresentation";

/** Shared small sprite atlas: five textures, not an animation per observation. */
export function createWeatherSpritePainter() {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  return (kind: LiveWeatherKind, time: number) => {
    ctx.clearRect(0, 0, 192, 144);
    if (kind === "CLEAR") {
      const glow = ctx.createRadialGradient(96, 65, 12, 96, 65, 47);
      glow.addColorStop(0, "#fff7bf");
      glow.addColorStop(0.5, "#ffd66de0");
      glow.addColorStop(1, "#ffd66d00");
      ctx.fillStyle = glow;
      ctx.fillRect(40, 10, 112, 110);
    } else {
      // Layered billows with directional light, a shaded underside and rain
      // curtain. This is an observation-driven symbol, never a radar footprint.
      const wet = kind === "RAIN" || kind === "STORM";
      const drift = Math.sin(time / 2600) * 3;
      if (wet) {
        const curtain = ctx.createLinearGradient(0, 66, 0, 140);
        curtain.addColorStop(0, "#93b9d04d");
        curtain.addColorStop(1, "#80c9ea00");
        ctx.fillStyle = curtain;
        ctx.beginPath();
        ctx.moveTo(40, 60);
        ctx.lineTo(159, 60);
        ctx.lineTo(145, 142);
        ctx.lineTo(24, 142);
        ctx.closePath();
        ctx.fill();
      }
      const billows = [
        [50, 55, 23],
        [76, 40, 29],
        [111, 42, 33],
        [145, 56, 25],
        [71, 64, 24],
        [108, 66, 27],
        [132, 68, 20],
      ];
      // One continuous shaded silhouette avoids shiny disconnected spheres.
      ctx.beginPath();
      for (const [cx, cy, radius] of billows) {
        ctx.moveTo(cx! + drift + radius!, cy!);
        ctx.arc(cx! + drift, cy!, radius! * 0.93, 0, Math.PI * 2);
      }
      const body = ctx.createLinearGradient(0, 12, 0, 92);
      body.addColorStop(0, "#f3f7f9");
      body.addColorStop(0.45, wet ? "#b8c8d1" : "#e2eaf0");
      body.addColorStop(1, wet ? "#657d8e" : "#a5bbc7");
      ctx.fillStyle = body;
      ctx.fill();
      for (const [cx, cy, radius] of billows) {
        const x = cx! + drift;
        const y = cy!;
        const r = radius!;
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.45, 1, x, y, r);
        g.addColorStop(0, kind === "STORM" ? "#e4edf260" : "#ffffff90");
        g.addColorStop(0.55, "#f0f6fa35");
        g.addColorStop(1, "#eaf5fa00");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (kind === "RAIN" || kind === "STORM" || kind === "SNOW") {
        ctx.strokeStyle = "#b9edffdd";
        ctx.fillStyle = "#eefaff";
        ctx.lineWidth = 1.1;
        for (let i = 0; i < 38; i += 1) {
          const x = 43 + ((i * 29) % 112);
          const y = 76 + ((time / (kind === "SNOW" ? 65 : 11) + i * 17) % 58);
          ctx.globalAlpha = Math.max(0, 1 - (y - 80) / 55);
          ctx.beginPath();
          if (kind === "SNOW") {
            ctx.arc(x + Math.sin(time / 700 + i) * 5, y, 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.moveTo(x, y);
            ctx.lineTo(x - 5, y + 14);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
      if (kind === "STORM" && Math.floor(time / 400) % 7 === 0) {
        ctx.fillStyle = "#fff2a1";
        ctx.beginPath();
        ctx.moveTo(98, 60);
        ctx.lineTo(85, 89);
        ctx.lineTo(98, 85);
        ctx.lineTo(91, 110);
        ctx.lineTo(114, 76);
        ctx.lineTo(101, 79);
        ctx.closePath();
        ctx.fill();
      }
    }
    return ctx.getImageData(0, 0, 192, 144);
  };
}
