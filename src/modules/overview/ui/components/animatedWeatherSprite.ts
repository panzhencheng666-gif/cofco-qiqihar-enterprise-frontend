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
      // The motion is illustrative; location and weather type come from observations.
      for (let i = 0; i < 7; i += 1) {
        const x = 36 + i * 19 + Math.sin(time / 1500 + i) * 6;
        const y = 48 + Math.sin(i * 2) * 10;
        const g = ctx.createRadialGradient(x - 5, y - 8, 2, x, y, 32);
        g.addColorStop(0, "#ffffffef");
        g.addColorStop(0.48, kind === "STORM" ? "#8a9caee6" : "#dceef5e6");
        g.addColorStop(1, "#c7eaff00");
        ctx.fillStyle = g;
        ctx.fillRect(x - 34, y - 34, 68, 68);
      }
      if (kind === "RAIN" || kind === "STORM" || kind === "SNOW") {
        ctx.strokeStyle = "#b9edffdd";
        ctx.fillStyle = "#eefaff";
        ctx.lineWidth = 2;
        for (let i = 0; i < 18; i += 1) {
          const x = 43 + ((i * 29) % 112);
          const y = 70 + ((time / (kind === "SNOW" ? 65 : 14) + i * 17) % 58);
          ctx.globalAlpha = Math.max(0, 1 - (y - 80) / 55);
          ctx.beginPath();
          if (kind === "SNOW") {
            ctx.arc(x + Math.sin(time / 700 + i) * 5, y, 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.moveTo(x, y);
            ctx.lineTo(x - 4, y + 10);
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
