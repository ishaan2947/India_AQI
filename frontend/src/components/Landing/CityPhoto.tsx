/**
 * The hero photograph, and the cross-fade between cities.
 *
 * Swapping `src` on a single <img> is the obvious implementation and the
 * wrong one: the old frame is torn down the instant the new one is assigned,
 * so the hero flashes its background colour for however long the new file
 * takes to decode — which on a slow connection is the most visible moment on
 * the page.
 *
 * So two layers. The outgoing photograph stays mounted and fully painted
 * until the incoming one has *decoded*, and only then do they cross-fade.
 * Nothing ever fades to nothing, and a swap on a cached image is seamless.
 *
 * Each layer carries its own 20px LQIP behind the real file, so even a
 * cold-cache swap fades to a blurred version of the right photograph rather
 * than to black. Under `prefers-reduced-motion` the global stylesheet
 * collapses the transition and the swap is instant — still correct, just not
 * animated.
 */

import { useEffect, useRef, useState } from "react";

import type { CityImage } from "../../data/cityImages";

interface Layer {
  image: CityImage;
  /** Decoded and safe to reveal. */
  ready: boolean;
}

export default function CityPhoto({
  image,
  alt,
}: {
  image: CityImage;
  alt: string;
}) {
  // `layers[0]` is what is showing; a second layer exists only while a swap
  // is in flight.
  const [layers, setLayers] = useState<Layer[]>([{ image, ready: false }]);
  const settleTimer = useRef<number | null>(null);

  useEffect(() => {
    setLayers((current) => {
      if (current[current.length - 1]?.image.src === image.src) return current;
      // Keep the outgoing layer; drop anything older than it, so a reader
      // clicking through ten cities doesn't accumulate ten <img> elements.
      const outgoing = current[current.length - 1];
      return [outgoing, { image, ready: false }].filter(Boolean) as Layer[];
    });
  }, [image.src]);

  useEffect(
    () => () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const markReady = (src: string) => {
    setLayers((current) =>
      current.map((layer) =>
        layer.image.src === src ? { ...layer, ready: true } : layer,
      ),
    );
    // Once the fade has run, retire the outgoing layer. Timed rather than
    // listening for transitionend, because a layer that is already opacity-1
    // (a cached image swapped in instantly) never fires one.
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      setLayers((current) =>
        current.length > 1 ? current.slice(current.length - 1) : current,
      );
    }, 900);
  };

  return (
    <>
      {layers.map((layer, index) => {
        const isIncoming = index > 0;
        return (
          <div
            key={layer.image.src}
            aria-hidden={isIncoming ? true : undefined}
            className={`absolute inset-0 transition-opacity duration-enter ease-air ${
              isIncoming && !layer.ready ? "opacity-0" : "opacity-100"
            }`}
          >
            {/* The blurred stand-in, underneath, so the layer is never empty. */}
            <div
              aria-hidden
              className="absolute inset-0 scale-105 bg-cover blur-sm"
              style={{
                backgroundImage: `url("${layer.image.lqip}")`,
                backgroundPosition: layer.image.objectPosition,
              }}
            />
            <img
              src={layer.image.src}
              srcSet={layer.image.srcSet}
              sizes="100vw"
              alt={isIncoming ? "" : alt}
              decoding="async"
              onLoad={() => markReady(layer.image.src)}
              onError={() => markReady(layer.image.src)}
              className={`haze-subject absolute inset-0 h-full w-full object-cover transition-opacity duration-move ease-air ${
                layer.ready ? "opacity-100" : "opacity-0"
              }`}
              style={{ objectPosition: layer.image.objectPosition }}
            />
          </div>
        );
      })}
    </>
  );
}
