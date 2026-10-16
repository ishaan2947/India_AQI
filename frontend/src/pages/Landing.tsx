/**
 * The landing page, as one scroll: the answer, then the evidence, then the
 * explanation.
 *
 *   Hero      a live reading, printed over the air it describes. Scrolling
 *             thickens the haze over the photograph to today's real level.
 *   RightNow  the haze resolves into all thirty cities, ranked, with bars.
 *   MapBand   the same thirty plotted at their coordinates, handing off to
 *             the live map.
 *   Story     three beats of writing about where this comes from.
 *   Colophon  who built it, and where everything else lives.
 *
 * The order is the argument: you are shown the air before you are told
 * anything about it.
 */

import Colophon from "../components/Landing/Colophon";
import Hero from "../components/Landing/Hero";
import MapBand from "../components/Landing/MapBand";
import RightNow from "../components/Landing/RightNow";
import Story from "../components/Landing/Story";

export default function Landing() {
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <Hero />
      <RightNow />
      <MapBand />
      <Story />
      <Colophon />
    </div>
  );
}
