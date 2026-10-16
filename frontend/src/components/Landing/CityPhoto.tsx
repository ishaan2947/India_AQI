/**
 * The hero photograph, and the cross-fade between cities.
 *
 * Four things make a photo swap look cheap, and this avoids all of them:
 *
 *   1. Swapping `src` on one <img> tears the old frame down the instant the
 *      new one is assigned, so the hero flashes its background while the new
 *      file decodes. Two layers instead: the outgoing photograph holds, fully
 *      painted, until the incoming one is ready.
 *   2. Fading a layer that itself contains a fading image multiplies two
 *      easing curves into a muddy ramp. There is exactly one transition here,
 *      on the incoming layer, and nothing inside it animates.
 *   3. `onLoad` means "bytes arrived", not "pixels are ready" — start a fade
 *      there and the first frames stutter while the browser rasterises. So we
 *      `decode()` first and only mount the layer once it is genuinely ready.
 *      That also means a blurred placeholder is pointless for a swap: there
 *      is a real photograph underneath the whole time. (The LQIP still earns
 *      its place on the *first* paint, when there is nothing underneath.)
 *   4. The haze filter must sit on each layer, never on their shared parent:
 *      a filtered parent re-rasterises every time a child's opacity changes,
 *      which during a cross-fade means every single frame.
 *
 * Rapid switching is handled by only ever revealing the newest request, so
 * arrowing through ten cities paints the tenth, not all ten.
 */

import { useEffect, useRef, useState } from "react";

import type { CityImage } from "../../data/cityImages";

interface Layer {
  image: CityImage;
  /** First layer of the session: fades up from its own blur, not from a
      previous photograph. */
  initial: boolean;
}

/** Matches --t-photo in index.css; the JS fallback timer needs the same idea. */
const FADE_MS = 900;

export default function CityPhoto({
  image,
  alt,
}: {
  image: CityImage;
  alt: string;
}) {
  const [shown, setShown] = useState<Layer>({ image, initial: true });
  const [incoming, setIncoming] = useState<Layer | null>(null);
  /** Set on the frame after the incoming layer mounts, to start its fade. */
  const [revealed, setRevealed] = useState(false);

  // Only the newest request may reveal itself — otherwise arrowing quickly
  // through the list paints every city it passed through.
  const requestId = useRef(0);
  const promoteTimer = useRef<number | null>(null);

  useEffect(() => {
    if (image.src === shown.image.src) return;

    const id = ++requestId.current;
    let cancelled = false;

    (async () => {
      // Decode off-screen. The <img> we render afterwards hits the memory
      // cache, so it paints on its first frame with nothing left to do.
      const preload = new Image();
      preload.sizes = "100vw";
      preload.srcset = image.srcSet;
      preload.src = image.src;
      try {
        await preload.decode();
      } catch {
        // Decode can reject on a cancelled or broken image. Showing a frame
        // that may still be loading beats showing nothing at all.
      }
      if (cancelled || id !== requestId.current) return;

      setIncoming({ image, initial: false });
      setRevealed(false);
      // Two frames: one for the layer to mount at opacity 0, one for the
      // style change to register as a transition rather than an initial value.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (id === requestId.current) setRevealed(true);
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [image, shown.image.src]);

  // Once the incoming layer has finished fading it becomes the only layer.
  const promote = () => {
    if (!incoming) return;
    setShown(incoming);
    setIncoming(null);
    setRevealed(false);
  };

  useEffect(() => {
    if (!revealed || !incoming) return;
    // transitionend is the accurate signal; the timer is the guarantee (it
    // never fires for a layer that was already opaque, or in a background
    // tab where transitions are suspended).
    promoteTimer.current = window.setTimeout(promote, FADE_MS + 120);
    return () => {
      if (promoteTimer.current) window.clearTimeout(promoteTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, incoming]);

  return (
    // The haze is applied per layer (see .photo-layer in index.css), so this
    // wrapper is pure structure and never re-rasterises during a fade.
    <div className="absolute inset-0 overflow-hidden">
      <Photo layer={shown} alt={alt} />
      {incoming ? (
        <Photo
          layer={incoming}
          alt=""
          fading
          revealed={revealed}
          onDone={promote}
        />
      ) : null}
    </div>
  );
}

function Photo({
  layer,
  alt,
  fading = false,
  revealed = false,
  onDone,
}: {
  layer: Layer;
  alt: string;
  fading?: boolean;
  revealed?: boolean;
  onDone?: () => void;
}) {
  return (
    <div
      aria-hidden={fading ? true : undefined}
      onTransitionEnd={(e) => {
        if (e.propertyName === "opacity") onDone?.();
      }}
      className={`photo-layer absolute inset-0 ${
        fading ? (revealed ? "photo-layer--in" : "photo-layer--out") : ""
      }`}
    >
      {/* The blur only exists for the very first paint of the session. On a
          swap there is a real photograph underneath, which is a better
          placeholder than a blurred copy of the one arriving. */}
      {layer.initial ? (
        <div
          aria-hidden
          className="absolute inset-0 scale-105 bg-cover blur-md"
          style={{
            backgroundImage: `url("${layer.image.lqip}")`,
            backgroundPosition: layer.image.objectPosition,
          }}
        />
      ) : null}
      <img
        src={layer.image.src}
        srcSet={layer.image.srcSet}
        sizes="100vw"
        alt={alt}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: layer.image.objectPosition }}
      />
    </div>
  );
}
