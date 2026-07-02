import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFile = path.join(root, "data", "service-areas.json");
const sourceUrl = "https://apgutterguards.com/areas-we-serve";
const siteUrl = "https://www.allqualitygutters.com";
const updated = "2026-07-02";
const targetStates = new Set(["PA", "NJ"]);
const stateOrder = { PA: 0, NJ: 1 };
const stateNames = { PA: "Pennsylvania", NJ: "New Jersey" };
let sharedTrustBarMarkup = "";
let sharedFooterMarkup = "";
let sharedPageExtrasMarkup = "";

/* ------------------------------------------------------------------ */
/* Service definitions                                                 */
/* ------------------------------------------------------------------ */

const services = [
  {
    slug: "seamless-gutter-installation",
    name: "Seamless Gutter Installation",
    title: "Seamless Gutter Installation in PA & NJ",
    h1: "Seamless Gutter Installation in Pennsylvania & New Jersey",
    description: "Custom seamless aluminum gutters formed on-site for Pennsylvania and New Jersey homes. Fewer seams, fewer leaks, free on-site estimates.",
    intro: "Seamless gutters are measured and formed for your home, reducing the number of joints where leaks commonly begin. All Quality Gutters installs systems sized for the roofline, local rainfall and the safest route for moving water away from the foundation.",
    cardBlurb: "Continuous runs formed on-site with fewer leak-prone joints.",
    benefits: ["Fewer leak-prone seams", "Custom fit for the roofline", "Coordinated gutter and downspout sizing", "Color options selected to complement the home", "Clean removal of installation debris"],
    signs: ["Water spills over the gutter during moderate rain", "Sections pull away from the fascia or sag", "Rust, cracks or failed seams keep returning", "Water collects near the foundation", "The existing system is undersized for the roof area"],
    inspect: ["Roof area, pitch and valley locations that concentrate runoff", "Condition of the fascia boards the new gutters attach to", "Existing outlet and downspout positions", "Grading and safe discharge points around the foundation", "Ladder access and any obstacles along the roofline"],
    faq: [
      ["What makes a gutter seamless?", "Long gutter runs are formed from a continuous coil at the property, so joints are generally limited to corners and transitions."],
      ["Are 5-inch or 6-inch gutters better?", "The right size depends on roof area, pitch, valleys and rainfall. We assess those conditions before recommending a system."],
      ["How long does installation take?", "Many residential installations can be completed efficiently, but timing depends on the home, access, weather and project scope."],
      ["What colors are available for seamless gutters?", "Seamless aluminum gutters come in a range of factory finishes. We help you match or complement the existing trim, fascia and siding."],
    ],
  },
  {
    slug: "gutter-guards",
    name: "Gutter Guards",
    title: "Gutter Guard Installation in PA & NJ",
    h1: "Gutter Guard Installation in Pennsylvania & New Jersey",
    description: "Professional gutter guard installation for PA and NJ homes. Keep leaves, pine needles and roof grit out while rainwater keeps flowing.",
    intro: "Gutter guards can reduce the amount of leaves, seed pods and roof debris entering the system. We match the guard to the existing gutter, roof edge and surrounding tree cover instead of treating every home as the same installation.",
    cardBlurb: "Screens and covers matched to your tree cover and roof edge.",
    benefits: ["Less routine debris accumulation", "Better water flow during seasonal storms", "Reduced exposure to repeated ladder cleaning", "Options for new or existing gutters", "Inspection of gutter condition before installation"],
    signs: ["Gutters refill with leaves soon after cleaning", "Trees overhang or closely surround the roof", "Downspouts clog repeatedly", "Overflow appears at the same sections", "You want a lower-maintenance gutter system"],
    inspect: ["The type of debris the roof actually collects: leaves, needles or grit", "Gutter pitch, attachment strength and overall condition", "Shingle overhang and drip-edge details at the roof edge", "Downspout outlets that clog first", "Tree cover and which sections need the most protection"],
    faq: [
      ["Do gutter guards eliminate all maintenance?", "No system makes gutters maintenance-free. Guards can substantially reduce debris, while periodic inspection is still sensible."],
      ["Can guards be installed on existing gutters?", "Often yes, provided the gutters are correctly pitched, securely attached and in serviceable condition."],
      ["Will gutter guards work with heavy rain?", "Performance depends on product design, installation, roof flow and gutter capacity. We evaluate the complete drainage path."],
      ["Do you clean the gutters before installing guards?", "Yes. Guards are installed over clean, correctly pitched gutters so the system starts from a sound baseline."],
    ],
  },
  {
    slug: "gutter-replacement",
    name: "Gutter Replacement",
    title: "Gutter Replacement Services in PA & NJ",
    h1: "Gutter Replacement in Pennsylvania & New Jersey",
    description: "Replace leaking, sagging or undersized gutters with a seamless system planned as one drainage path. Serving PA and NJ homeowners with free estimates.",
    intro: "When repairs no longer solve recurring leaks, overflow or separation from the fascia, replacement can protect the roof edge, siding and foundation more reliably. We remove the failed system and plan the new gutters and downspouts as one drainage path.",
    cardBlurb: "Failed systems removed and replaced as one planned drainage path.",
    benefits: ["Removal of deteriorated gutter sections", "Assessment of fascia attachment points", "Improved pitch and outlet placement", "Updated downspout routing", "A cleaner, coordinated exterior finish"],
    signs: ["Multiple seams or corners leak", "Gutters have widespread rust or cracking", "Fasteners repeatedly pull loose", "Standing water remains after rain", "Previous spot repairs no longer hold"],
    inspect: ["Which seams, corners and end caps are actually failing", "Hidden fascia rot behind the existing gutter line", "Hanger spacing and how well fasteners still hold", "Whether the current size and outlet count match the roof", "Downspout routing and where discharge ends up"],
    faq: [
      ["Should I repair or replace my gutters?", "Localized damage may be repairable. Widespread deterioration, poor sizing or repeated failures often make replacement the more durable choice."],
      ["Do you remove the old gutters?", "Removal and disposal can be included in the project scope and will be explained in the estimate."],
      ["Can downspouts be changed during replacement?", "Yes. Replacement is a good time to correct outlet locations and direct discharge farther from vulnerable areas."],
      ["How long does gutter replacement take?", "Most single-family replacements are completed quickly once scheduled, though scope, access and weather affect timing. The estimate sets clear expectations."],
    ],
  },
  {
    slug: "soffit-fascia",
    name: "Soffit & Fascia",
    title: "Soffit & Fascia Installation in PA & NJ",
    h1: "Soffit & Fascia Installation in Pennsylvania & New Jersey",
    description: "Soffit and fascia repair and installation for PA and NJ homes. Protect the roof edge, keep ventilation working and give gutters a solid mounting line.",
    intro: "Soffit and fascia form the finished edge beneath the roofline and provide the mounting surface for the gutter system. Damaged materials can allow moisture and pests into vulnerable areas, while poor ventilation can trap heat and humidity.",
    cardBlurb: "Sound, finished roof edges that gutters can anchor to.",
    benefits: ["A sound mounting edge for gutters", "Improved roof-edge appearance", "Ventilation options where appropriate", "Replacement of visibly deteriorated sections", "Materials selected for exterior exposure"],
    signs: ["Peeling, soft or stained fascia boards", "Loose soffit panels", "Visible gaps along the roof edge", "Evidence of pests near the eaves", "Gutters cannot stay securely fastened"],
    inspect: ["Soft, stained or peeling fascia sections along the gutter line", "Soffit panels that have loosened or show pest activity", "Existing attic ventilation paths at the eaves", "How the current gutters attach and where fasteners failed", "Trim and paint condition where new material must blend in"],
    faq: [
      ["Can fascia be replaced with the gutters installed?", "The sequence depends on damage and access. When both systems need work, coordinating them usually produces the cleanest result."],
      ["Does every soffit need ventilation?", "Ventilation requirements depend on the roof assembly. We avoid blocking existing airflow and discuss suitable options."],
      ["What causes fascia damage?", "Common causes include overflowing gutters, roof-edge leaks, failed paint, repeated moisture exposure and loose gutter fasteners."],
      ["Do you match the existing trim color?", "We select materials and finishes that blend with the existing trim and siding, and review the options with you before installation."],
    ],
  },
  {
    slug: "downspout-installation",
    name: "Downspout Installation",
    title: "Downspout Installation in PA & NJ",
    h1: "Downspout Installation in Pennsylvania & New Jersey",
    description: "Downspout installation and replacement for Pennsylvania and New Jersey homes. Move roof runoff away from siding, walkways and the foundation.",
    intro: "A gutter is only effective when its outlets and downspouts can carry water away from the home. We size and position downspouts around roof valleys, long gutter runs, landscaping and practical discharge locations.",
    cardBlurb: "Outlets sized and placed so runoff actually leaves the house.",
    benefits: ["Better drainage from long gutter runs", "Reduced overflow near roof valleys", "Discharge directed away from the foundation", "Secure wall attachment", "Coordination with the gutter size and outlet"],
    signs: ["Water backs up near gutter outlets", "Downspouts leak at joints", "Discharge collects beside the foundation", "Existing downspouts are crushed or loose", "Large roof sections rely on too few outlets"],
    inspect: ["Roof area feeding each outlet and whether capacity matches", "Joints, elbows and straps on the existing downspouts", "Where discharge lands and how the ground slopes from there", "Crushed, disconnected or missing sections", "Practical routes that keep water off walkways and beds"],
    faq: [
      ["How many downspouts does a home need?", "The answer depends on gutter length, roof area, valleys, slope and outlet capacity. Placement matters as much as the count."],
      ["Where should downspouts discharge?", "They should move water to a safe drainage area and away from the foundation, entrances and neighboring property."],
      ["Can you replace only a downspout?", "Yes, when the gutter and outlet are otherwise serviceable. We inspect the connected sections before recommending the scope."],
      ["Can discharge be extended farther from the house?", "Yes. Extensions and rerouted elbows are a common, low-cost way to keep runoff away from foundations and basement walls."],
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Homeowner guides (informational content)                            */
/* ------------------------------------------------------------------ */

// Long-tail informational pages. Body markup is written per guide and reuses
// the existing seo-section / seo-checks classes. Keep advice honest: no
// invented prices, no absolute promises.
const guides = [
  {
    slug: "5-inch-vs-6-inch-gutters",
    title: "5-Inch vs 6-Inch Gutters: How to Choose",
    h1: "5-Inch vs 6-Inch Gutters: How to Choose the Right Size",
    description: "How roof area, pitch and rainfall determine whether 5-inch or 6-inch seamless gutters make sense for your home in Pennsylvania or New Jersey.",
    blurb: "Roof area, pitch and valleys decide the size — not habit.",
    published: "2026-07-02",
    body: `<section class="seo-section"><h2>What the Sizes Actually Mean</h2><p>Most residential seamless gutters are K-style profiles in 5-inch or 6-inch widths. The extra inch sounds small, but a 6-inch gutter holds roughly 40 percent more water and pairs with larger outlets and downspouts. Capacity is the whole question: can the trough move the water your roof sheds during a hard storm, or does it spill over the front edge?</p></section><section class="seo-section"><h2>When 5-Inch Gutters Are Enough</h2><p>For many homes, they simply are. A 5-inch system handles a modest roof area with a simple shape, a moderate pitch and downspouts placed at sensible intervals. If your current 5-inch gutters only overflow when they are clogged, the size is probably right and the maintenance routine is the real issue — see our comparison of <a href="/guides/gutter-guards-vs-cleaning/">gutter guards versus regular cleaning</a>.</p></section><section class="seo-section"><h2>When 6-Inch Gutters Earn Their Cost</h2><p>Certain conditions overwhelm a 5-inch trough no matter how clean it is:</p><ul class="seo-checks"><li>Large or steep roof planes that shed water fast</li><li>Roof valleys that concentrate two planes into one short gutter run</li><li>Long runs served by too few downspouts</li><li>Metal or slick roofing that accelerates runoff</li><li>A history of overflow during storms even with clean gutters</li></ul><p>If two or more of these describe your home, pricing a 6-inch system is worth it. The upgrade is far cheaper than repairing fascia, siding or a wet basement later.</p></section><section class="seo-section"><h2>The Downspout Question</h2><p>Gutter size gets the attention, but outlets are the usual bottleneck. A 6-inch gutter drained by small or scarce outlets still overflows. Sizing the <a href="/services/downspout-installation/">downspouts</a> and placing them where the roof actually concentrates water matters as much as the trough width.</p></section><section class="seo-section"><h2>How We Decide</h2><p>During a free estimate we measure roof area and pitch, note the valleys and count the practical outlet positions. That produces a recommendation you can check against your own roof rather than a one-size answer. Learn more about <a href="/services/seamless-gutter-installation/">seamless gutter installation</a> or find your town in our <a href="/areas-we-serve/">service-area directory</a>.</p></section>`,
  },
  {
    slug: "gutter-guards-vs-cleaning",
    title: "Gutter Guards vs Cleaning: Which Makes Sense",
    h1: "Gutter Guards vs. Regular Cleaning: Which Makes Sense for Your Home",
    description: "An honest comparison of gutter guards and routine gutter cleaning: tree cover, debris types, long-term effort and when each approach is the right call.",
    blurb: "Tree cover and debris type decide this one, honestly.",
    published: "2026-07-02",
    body: `<section class="seo-section"><h2>The Real Cost of Cleaning</h2><p>Cleaning is cheap per visit and completely effective — for a while. The catch is frequency. Under open sky, once or twice a year is fine. Under mature trees, gutters can refill within weeks each fall, and every skipped cleaning risks a clogged outlet during the next storm. The cost that matters is not one visit; it is every visit for as long as you own the home, plus the ladder time or scheduling effort each one takes.</p></section><section class="seo-section"><h2>What Guards Do — and Do Not Do</h2><p>A properly matched gutter guard keeps the bulk of leaves, seed pods and roof grit out of the trough while letting water in. What no guard does is make a system maintenance-free: fine debris still accumulates slowly, and an occasional inspection remains sensible. Any product pitched as “never think about your gutters again” is overpromising.</p></section><section class="seo-section"><h2>Tree Cover Decides It</h2><p>The honest rule of thumb:</p><ul class="seo-checks"><li>Few or no trees near the roof: cleaning wins. Guards would protect against debris you do not have.</li><li>Moderate tree cover: either works. Guards trade an upfront cost for fewer ladder visits.</li><li>Heavy canopy or overhanging branches: guards usually win. Cleaning frequency becomes a season-long chore, as homeowners in tree-lined areas like <a href="/service-areas/princeton-nj/">Princeton</a> or <a href="/service-areas/media/">Media</a> know well.</li></ul></section><section class="seo-section"><h2>Needles Are a Special Case</h2><p>Pine needles defeat basic screens by threading through the openings and matting in the trough. Around pine-heavy areas such as <a href="/service-areas/jackson-nj/">Jackson</a> and <a href="/service-areas/manchester-township-nj/">Manchester Township</a>, fine-mesh guards are usually the only style worth installing. This is exactly why we look at what is actually in your gutters before recommending a product.</p></section><section class="seo-section"><h2>Our Recommendation Process</h2><p>We inspect the gutter condition, pitch and attachment first — guards belong on a sound system, not over a problem. Then we match the guard to the debris load and roof edge. Read more about <a href="/services/gutter-guards/">gutter guard installation</a>, or request a free assessment for your address.</p></section>`,
  },
  {
    slug: "gutter-installation-cost-factors",
    title: "What Affects Gutter Installation Cost",
    h1: "What Actually Affects the Cost of Gutter Installation",
    description: "The factors that drive gutter installation pricing: footage, home height, roof complexity, materials, fascia condition, downspouts and site access.",
    blurb: "Footage is only the start — here is the rest of the math.",
    published: "2026-07-02",
    body: `<section class="seo-section"><h2>Why There Is No Single Price</h2><p>Two homes with identical square footage can differ meaningfully in gutter cost. Instead of quoting a misleading average, it is more useful to know the factors an estimator actually weighs — so you can read any quote, ours included, with clear eyes.</p></section><section class="seo-section"><h2>The Big Drivers</h2><ul class="seo-checks"><li><strong>Linear footage.</strong> The base of every quote: how many feet of gutter the roofline needs.</li><li><strong>Home height and access.</strong> Second and third stories take more time, more safety setup and sometimes special equipment. Landscaping or tight lot lines slow work down too.</li><li><strong>Roof complexity.</strong> Every corner is a fabricated joint, and every valley may need extra capacity or a diverter. A cut-up roofline costs more than a simple rectangle of the same footage.</li><li><strong>Gutter size and material.</strong> 6-inch systems and premium finishes cost more than standard 5-inch aluminum — see <a href="/guides/5-inch-vs-6-inch-gutters/">when the larger size is worth it</a>.</li><li><strong>Downspout count and routing.</strong> More outlets and longer or underground discharge runs add material and labor, but they are where drainage problems actually get solved.</li></ul></section><section class="seo-section"><h2>The Hidden Variable: Fascia Condition</h2><p>New gutters attach to the fascia boards behind them. If sections are soft or rotted, fastening new gutters to them wastes the whole project. Board replacement discovered during the assessment is the most common legitimate addition to a gutter quote — learn what is involved in <a href="/services/soffit-fascia/">soffit and fascia work</a>.</p></section><section class="seo-section"><h2>How to Compare Quotes Fairly</h2><p>Check that each quote covers the same scope: gutter size, outlet count, fascia repairs, old-system removal and cleanup. A low number that excludes removal or repairs is not a lower price — it is a smaller job. A clear written scope is a better signal of a good contractor than any single dollar figure.</p></section><section class="seo-section"><h2>Get a Real Number for Your Home</h2><p>We quote from the actual roofline, on-site, for free — whether you need <a href="/services/seamless-gutter-installation/">new installation</a> or full <a href="/services/gutter-replacement/">gutter replacement</a>. Check availability for your town in the <a href="/areas-we-serve/">service-area directory</a>.</p></section>`,
  },
  {
    slug: "keep-water-away-from-foundation",
    title: "Keeping Roof Runoff Away From the Foundation",
    h1: "How to Keep Roof Runoff Away From Your Foundation",
    description: "Practical ways to stop roof runoff from reaching basement walls: downspout placement, discharge extensions, capacity fixes and honest limits of gutters.",
    blurb: "Most wet-basement fixes start at the downspout, not the basement.",
    published: "2026-07-02",
    body: `<section class="seo-section"><h2>The Scale of the Problem</h2><p>A roof is a large collection surface: even a modest storm sends hundreds of gallons of water off an average residential roof. The gutter system's only real job is deciding where all of that water lands. When it lands beside the foundation, the soil against basement and crawlspace walls saturates — and repeated saturation is how damp walls, efflorescence and seepage begin.</p></section><section class="seo-section"><h2>Where Systems Go Wrong</h2><ul class="seo-checks"><li>Downspouts that stop at the foundation line with no extension</li><li>Discharge aimed at flower beds that hold water against the wall</li><li>Clogged outlets that force water over the gutter edge in sheets</li><li>Too few downspouts, so one corner of the house takes everything</li><li>Crushed or disconnected elbows dumping water in one spot</li></ul></section><section class="seo-section"><h2>Fixes, Cheapest First</h2><p>Foundation-water fixes have a satisfying property: the cheap ones often work. Start with discharge extensions that carry water several feet from the wall. Next, correct outlet placement so large roof sections stop draining to a single corner. Then address capacity — larger outlets or an added <a href="/services/downspout-installation/">downspout</a>. Full regrading or drainage systems are a last resort, not a starting point.</p></section><section class="seo-section"><h2>What Gutters Cannot Fix</h2><p>Honesty matters here: gutters control roof runoff only. If the yard slopes toward the house, if a neighboring property drains onto yours, or if groundwater rises seasonally, those need grading or waterproofing work by the appropriate trade. A good gutter assessment tells you which category your problem is in before you spend money in the wrong place.</p></section><section class="seo-section"><h2>A Simple Seasonal Check</h2><p>Twice a year, during a decent rain, walk the house perimeter. Watch for overflow lines on the gutters, water pooling within a couple of feet of the wall, and downspouts that gush at the elbow. Ten minutes of observation tells you more than any brochure — and if you would rather have a professional look, we do <a href="/#estimate" data-open-estimate-modal>free assessments</a> across <a href="/areas-we-serve/">Pennsylvania and New Jersey</a>.</p></section>`,
  },
  {
    slug: "winter-gutter-damage",
    title: "Winter Gutter Damage in PA & NJ",
    h1: "Winter Gutter Damage in Pennsylvania & New Jersey",
    description: "How freeze-thaw cycles, snow load and coastal winter storms damage gutters across PA and NJ, plus what to check before and after each winter.",
    blurb: "Freeze-thaw and snow load do their damage quietly.",
    published: "2026-07-02",
    body: `<section class="seo-section"><h2>Freeze-Thaw: The Quiet Damage</h2><p>Pennsylvania and inland New Jersey winters cross the freezing line dozens of times each season. Water sitting in a poorly pitched gutter freezes, expands and works at every seam and fastener — then melts and refreezes the next night. No single cycle breaks anything; the season's accumulation is what leaves gutters loose and leaking by spring.</p></section><section class="seo-section"><h2>Snow Load and Hangers</h2><p>Wet snow sliding off a roof loads the gutter far beyond its normal weight. Systems with wide hanger spacing or fasteners in aging fascia are the ones that end up visibly pulled away from the roofline in March. If your gutters already sag in autumn, winter will finish the argument — that is a case for <a href="/services/gutter-replacement/">replacement</a> before the snow, not after.</p></section><section class="seo-section"><h2>The Truth About Ice Dams</h2><p>Ice dams start with heat escaping through the roof, melting snow that refreezes at the cold eave. Gutters do not cause ice dams and cannot prevent them — anyone selling gutters as an ice-dam cure is overselling. What a sound gutter system does contribute: correct pitch and clear outlets reduce the standing water that adds to ice buildup at the edge, and strong hangers survive the load when ice forms anyway.</p></section><section class="seo-section"><h2>Shore Winters Are Their Own Season</h2><p>Along the Jersey Shore, winter means nor'easters: wind-driven rain and salt spray rather than deep cold. Fastener quality and attachment strength decide whether a system survives — a reality homeowners around <a href="/service-areas/barnegat-nj/">Barnegat</a> and <a href="/service-areas/longport-new-jersey/">Longport</a> know well. In the <a href="/service-areas/poconos-pa/">Poconos</a>, by contrast, snow depth and pine debris dominate. Same two states, very different winters.</p></section><section class="seo-section"><h2>Before-and-After Checklist</h2><p>Before winter: clear the gutters and outlets, confirm nothing sags, check that fasteners bite solid wood. After winter: walk the roofline and look for new gaps between gutter and fascia, separated seams at corners, and downspouts knocked out of alignment. Catching a loosened run in April is a repair; finding it in November is often a <a href="/services/gutter-replacement/">bigger project</a>. A <a href="/#estimate" data-open-estimate-modal>free spring assessment</a> covers all of it.</p></section>`,
  },
];

/* ------------------------------------------------------------------ */
/* Local knowledge used to vary service-area pages                     */
/* ------------------------------------------------------------------ */

// Shared library of common local gutter problems. Each area page picks the
// three keys from its profile, so combinations differ from city to city.
const gutterProblems = {
  heavyRain: {
    label: "Heavy rain and fast-moving storms",
    detail: (p) => `Short, intense downpours are common across ${p.region}. When a gutter is undersized or an outlet clogs, water sheets over the edge instead of reaching the downspout, soaking siding and flower beds below.`,
  },
  freezeThaw: {
    label: "Winter freeze-thaw cycles",
    detail: (p) => `Winters in ${p.region} swing above and below freezing repeatedly. Water trapped in poorly pitched gutters freezes, adds weight, strains hangers and can pry seams and fasteners loose by spring.`,
  },
  leafBuildup: {
    label: p => p.pines ? "Pine needles and fine debris" : "Leaf buildup every fall",
    detail: (p) => p.pines
      ? `Pine needles slip past basic screens and mat together in gutter troughs. Homes around ${p.name} often need guard styles chosen specifically for needle and fine-debris loads, not just leaves.`
      : `Fall leaf drop can fill an unprotected gutter in weeks. Repeated clogs near ${p.name} usually show up first at inside corners and downspout outlets, where debris collects fastest.`,
  },
  roofValleys: {
    label: "Roof valleys that overwhelm one spot",
    detail: (p) => `Many homes in the ${p.name} area have intersecting rooflines. Valleys funnel a large share of the roof's water into a short stretch of gutter, which overflows there first unless capacity and outlet placement account for it.`,
  },
  overflow: {
    label: "Overflow at the same sections",
    detail: () => `When overflow keeps returning to one stretch of gutter even after cleaning, the usual causes are incorrect pitch, an undersized outlet or a downspout that cannot drain fast enough. That is a layout problem, not a cleaning problem.`,
  },
  fasciaDamage: {
    label: "Fascia and roof-edge damage",
    detail: (p) => `Once gutters overflow or pull away, the wood fascia behind them stays wet after every storm. On older homes around ${p.name}, peeling paint and soft board sections along the roof edge are the usual first signs.`,
  },
  foundationWater: {
    label: "Water collecting near the foundation",
    detail: () => `Downspouts that dump runoff right beside the house saturate the soil against basement and crawlspace walls. Extending discharge and correcting outlet placement is one of the most cost-effective drainage fixes available.`,
  },
  coastal: {
    label: "Coastal air and storm exposure",
    detail: (p) => `Homes near the shore around ${p.name} face salt-laden air, wind-driven rain and the occasional nor'easter. Material choice, secure fastening and regular inspection matter more here than they do inland.`,
  },
  matureTrees: {
    label: "Mature trees over the roofline",
    detail: (p) => `Established neighborhoods in ${p.region} sit under decades-old shade trees. Branches over the roof mean steady debris in every season, so many homeowners pair cleaning-friendly layouts with gutter guards.`,
  },
};

// Reasons homeowners typically call, keyed to the same problem vocabulary.
const requestReasons = {
  heavyRain: "Overflow during fast-moving summer thunderstorms",
  freezeThaw: "Ice and packed snow pulling gutters loose over the winter",
  leafBuildup: "Gutters that refill with debris within weeks of cleaning",
  roofValleys: "Water shooting past the gutter below roof valleys",
  overflow: "Sheeting water over an entry, deck or walkway",
  fasciaDamage: "Peeling paint or soft wood along the roof edge",
  foundationWater: "Damp basement walls and washed-out beds after storms",
  coastal: "Faster wear on exterior metal and fasteners in shore air",
  matureTrees: "Constant cleaning under a heavy tree canopy",
};

// Locally themed FAQs, keyed by problem. Each area page uses the FAQs for its
// first two problem keys, so question sets differ across pages.
const problemFaqs = {
  heavyRain: (p) => [
    `Are 6-inch gutters worth it in ${p.name}?`,
    `For larger roofs, steep pitches or homes that see repeated overflow in heavy rain, a 6-inch gutter with larger outlets can make a real difference. We measure the roof area around ${p.name} before recommending a size rather than defaulting to one profile.`,
  ],
  freezeThaw: () => [
    "Can gutters help with winter ice buildup?",
    "Gutters do not stop ice dams, which begin with heat escaping through the roof. Correctly pitched gutters, clear outlets and solid hangers do reduce the standing water that freezes at the roof edge, and they survive snow load far better than loose, sagging runs.",
  ],
  leafBuildup: (p) => [
    p.pines ? "Which gutter guards handle pine needles?" : "Which gutter guards work best under heavy leaf drop?",
    p.pines
      ? "Fine-mesh guards generally outperform basic screens where pine needles dominate, because needles slide across a fine surface instead of threading through it. We look at the actual debris in your gutters before recommending a product."
      : "Where broadleaf trees dominate, several guard styles work well provided the gutter is sound and correctly pitched. We match the guard to the debris load, roof edge and gutter condition rather than selling one product for every home.",
  ],
  roofValleys: () => [
    "Why does my gutter overflow right below a roof valley?",
    "A valley concentrates water from two roof planes into one short stretch of gutter. Fixes include a larger outlet at that section, an added downspout, or a diverter that spreads the flow, and the right choice depends on the roof layout.",
  ],
  overflow: () => [
    "Why do my gutters overflow even when they are clean?",
    "Persistent overflow with clean gutters usually points to pitch, capacity or outlet problems rather than debris. We check the slope toward the outlets, the outlet size and the downspout route before recommending a fix.",
  ],
  fasciaDamage: () => [
    "Do you replace rotted fascia when installing gutters?",
    "Yes. New gutters should not be fastened to compromised wood. We inspect the fascia line during the estimate, and any needed board replacement is priced and explained before installation begins.",
  ],
  foundationWater: () => [
    "Can new gutters fix water in my basement?",
    "Gutters and downspouts control roof runoff, which is a major contributor to basement moisture. Moving discharge away from the foundation often helps substantially, though grading and groundwater issues can also play a role and may need separate attention.",
  ],
  coastal: () => [
    "Does salt air affect gutters near the shore?",
    "Coastal air accelerates corrosion on cheap fasteners and unfinished metal. Aluminum gutters with quality hangers and coated hardware hold up well, and a periodic rinse and inspection keeps shore-area systems in good shape.",
  ],
  matureTrees: () => [
    "How often should gutters be cleaned on a tree-lined street?",
    "Under mature trees, twice a year is a common baseline, with extra checks after storms. If cleaning has become a season-long chore, correctly matched gutter guards can cut the frequency dramatically.",
  ],
};

// Hand-written local profile for every hub, keyed by slug. This is what keeps
// each service-area page unique: title, H1, description, intro and housing
// copy are written per location, not generated from one template sentence.
const localProfiles = {
  "allentown-pa": {
    title: "Gutter Installation in Allentown, PA",
    h1: "Gutter Installation in Allentown, PA",
    description: "Seamless gutters, guards and replacements for Lehigh Valley homes in Allentown, Emmaus and Macungie. Systems sized for freeze-thaw winters. Free estimates.",
    region: "the Lehigh Valley",
    exposure: "pa",
    intro: "From older brick homes near center city to newer developments out toward Breinigsville and Trexlertown, Allentown rooflines deal with hard summer downpours and real winter freeze-thaw swings. We size and pitch gutter systems for both.",
    housing: "Many Lehigh Valley homes combine a steep main roof with porch roofs and additions, which concentrates runoff into a few short gutter runs. Outlet placement matters as much as gutter size here, and older fascia boards deserve a close look before anything new is fastened to them.",
    problems: ["freezeThaw", "heavyRain", "fasciaDamage"],
  },
  "poconos-pa": {
    title: "Gutter Services in Albrightsville & the Poconos",
    h1: "Gutter Services in Albrightsville & the Poconos",
    description: "Gutter installation, guards and downspouts for Pocono homes in Albrightsville, Blakeslee and Lake Harmony. Built for snow, pine debris and spring runoff.",
    region: "the Poconos",
    exposure: "pa",
    pines: true,
    intro: "Mountain properties around Albrightsville, Blakeslee and Lake Harmony collect more snow, more pine debris and more spring runoff than most Pennsylvania homes. Gutters up here need the pitch, capacity and hardware to handle all three.",
    housing: "Chalets, A-frames and wooded vacation homes are common across this part of the Poconos. Steep rooflines shed snow and water fast, and surrounding pines feed a steady stream of needles into any unprotected gutter, so guard selection is a frequent part of our work here.",
    problems: ["freezeThaw", "leafBuildup", "roofValleys"],
  },
  "carlisle-pa-gutter-services": {
    title: "Carlisle, PA Gutter Installation & Guards",
    h1: "Gutter Installation & Guards in Carlisle, PA",
    description: "Gutter installation, replacement and downspout work for Carlisle, Mechanicsburg and Cumberland Valley homes. Free on-site estimates and clear pricing.",
    region: "the Cumberland Valley",
    exposure: "pa",
    intro: "Carlisle's historic borough streets and the growing neighborhoods toward Mechanicsburg and Boiling Springs both depend on gutters that can move storm water off the roof and away from the house quickly. We plan that full path, not just the trough at the roof edge.",
    housing: "The borough's older homes often carry original wood fascia and long, straight gutter runs, while newer Cumberland Valley developments add valleys and complex rooflines. Both benefit from correctly sized outlets and downspouts that discharge well away from the foundation.",
    problems: ["heavyRain", "overflow", "foundationWater"],
  },
  "exton-pa": {
    title: "Gutter Services in Exton & Chester County, PA",
    h1: "Gutter Services in Exton & Chester County",
    description: "Seamless gutter installation and gutter guards for Exton, Downingtown and Chester County homes with wooded lots and busy rooflines. Free estimates.",
    region: "Chester County",
    exposure: "pa",
    intro: "Around Exton, Lionville and Downingtown, homes tend to sit on wooded lots with rooflines full of gables and valleys. That combination sends a lot of water and a lot of debris at a handful of gutter sections, and those are the spots we engineer around.",
    housing: "Chester County developments from the past few decades favor complex roof shapes that concentrate runoff, while tree cover keeps a steady supply of leaves and seed pods headed for the gutters. Guards and properly placed downspouts do a lot of work in this area.",
    problems: ["matureTrees", "roofValleys", "heavyRain"],
  },
  "furlong-pa": {
    title: "Gutter Installation in Furlong & Bucks County",
    h1: "Gutter Installation in Furlong & Central Bucks",
    description: "Gutter installation, guards and soffit work for Furlong, Doylestown and Central Bucks homes. Drainage planned for wooded lots and complex rooflines.",
    region: "Bucks County",
    exposure: "pa",
    intro: "Between Doylestown and Buckingham, Furlong-area properties are often larger homes on wooded lots. Long gutter runs, intersecting rooflines and mature trees make drainage planning here more involved than a simple footage measurement.",
    housing: "Central Bucks homes frequently pair big roof areas with landscaping close to the foundation, so where each downspout discharges matters. We route outlets so runoff clears beds, walkways and basements instead of ending up beside them.",
    problems: ["matureTrees", "foundationWater", "roofValleys"],
  },
  "harrisburg-pa": {
    title: "Gutter Contractor in Harrisburg, PA",
    h1: "Your Gutter Contractor in Harrisburg, PA",
    description: "Gutter contractor serving Harrisburg, Hershey and Dauphin County. Installation, replacement, guards and downspouts with free on-site estimates.",
    region: "the Harrisburg region",
    exposure: "pa",
    intro: "From city blocks near the river to suburbs out toward Hershey and Hummelstown, Harrisburg-area homes see the full Pennsylvania weather cycle: freeze-thaw winters, spring storms and humid summer downpours. Gutters here earn their keep in every season.",
    housing: "Dauphin County housing spans rowhomes with shared rooflines, post-war suburbs and newer developments. Each drains differently, and the estimates we prepare reflect the actual roof layout rather than a one-size price per foot.",
    problems: ["freezeThaw", "fasciaDamage", "overflow"],
  },
  "lancaster-pa": {
    title: "Gutter Installation in Lancaster, PA",
    h1: "Gutter Installation in Lancaster, PA",
    description: "Seamless gutters, guards and replacement for Lancaster city and county homes. Systems sized for summer downpours and tree-lined streets. Free estimates.",
    region: "Lancaster County",
    exposure: "pa",
    intro: "Lancaster's tree-lined city streets and the townships around Millersville, Lampeter and East Petersburg all put gutters to work hard: leaf drop in the fall, snow and ice in the winter and drenching thunderstorms in the summer.",
    housing: "The county mixes historic brick homes with farmland properties and newer suburban builds. Older homes often need fascia attention along with new gutters, while larger township lots benefit most from smart downspout routing and discharge extensions.",
    problems: ["heavyRain", "matureTrees", "freezeThaw"],
  },
  "media": {
    title: "Gutter Services in Media & Delaware County, PA",
    h1: "Gutter Services in Media & Delaware County",
    description: "Gutter services for Media, Havertown and Delaware County homes under mature trees: installation, guards, replacement and fascia repair. Free estimates.",
    region: "Delaware County",
    exposure: "pa",
    intro: "Media, Swarthmore, Havertown and the surrounding Delaware County boroughs are defined by mature shade trees and established homes. Beautiful streets, hard-working gutters: canopy debris lands on these roofs in every season.",
    housing: "Many Delco homes date back generations, with wood fascia, slate or older shingle roofs and gutters that have been repaired more than once. We check what the new system will attach to just as carefully as we measure the runs themselves.",
    problems: ["matureTrees", "leafBuildup", "fasciaDamage"],
  },
  "reading-pa": {
    title: "Reading, PA Gutter Installation & Replacement",
    h1: "Gutter Installation & Replacement in Reading, PA",
    description: "Gutter installation and replacement for Reading and Berks County homes. Correct pitch, solid fascia attachment and winter-ready drainage. Free estimates.",
    region: "Berks County",
    exposure: "pa",
    intro: "Reading rooflines run from city rowhomes below Mount Penn to suburban streets in Shillington, Kenhorst and Muhlenberg. Winter ice, spring rain and aging roof edges are the usual reasons Berks County homeowners call us.",
    housing: "Rowhome and twin rooflines drain shared valleys into short gutter runs, which magnifies any pitch or outlet problem. Detached homes in the suburbs face more typical leaf and storm loads, and both are quoted from the actual roof layout during a free assessment.",
    problems: ["freezeThaw", "heavyRain", "foundationWater"],
  },
  "willow-grove": {
    title: "Gutter Services in Willow Grove, PA",
    h1: "Gutter Services in Willow Grove, PA",
    description: "Gutter installation, guards and downspout upgrades for Willow Grove, Abington and eastern Montgomery County homes. Free on-site estimates.",
    region: "eastern Montgomery County",
    exposure: "pa",
    intro: "Willow Grove, Horsham and the Abington-area neighborhoods are classic post-war suburbs: solid homes, mature trees and gutters that have often been in place for decades. When they start overflowing, the roof edge and foundation both take the hit.",
    housing: "Lots here typically place driveways, walkways and planting beds close to the house, so a downspout that discharges in the wrong spot creates puddles you walk through and beds that wash out. Correct routing is a standard part of our installs in this area.",
    problems: ["matureTrees", "overflow", "foundationWater"],
  },
  "philadelphia-pa": {
    title: "Gutter Installation in Philadelphia, PA",
    h1: "Gutter Installation in Philadelphia, PA",
    description: "Seamless gutter installation, replacement and guards for Philadelphia rowhomes, twins and single-family houses. Local crews and free estimates.",
    region: "Philadelphia and its neighborhoods",
    exposure: "pa",
    intro: "Philadelphia's housing stock — rowhomes across the Northeast, twins in the near neighborhoods, stone singles in Chestnut Hill and Mount Airy — asks more of gutters than most cities. Shared rooflines mean one failing section can affect two houses at once.",
    housing: "On many Philadelphia blocks, long shared rooflines drain through a small number of downspouts, and decades-old wood fascia sits behind the gutter. We look at the whole run, including where a neighboring roof feeds into it, before quoting a scope.",
    problems: ["fasciaDamage", "overflow", "foundationWater"],
  },
  "levittown-pa": {
    title: "Gutter Company in Levittown, PA",
    h1: "Your Local Gutter Company in Levittown, PA",
    description: "All Quality Gutters is based in Levittown, PA. Seamless gutters, guards, fascia and downspouts for Lower Bucks County homes. Free local estimates.",
    region: "Lower Bucks County",
    exposure: "pa",
    intro: "Levittown is home base for All Quality Gutters — our shop is on Bristol Pike, and the streets from Fairless Hills to Croydon are where our crews spend the most time. Estimates here are quick to schedule, and follow-up help is minutes away.",
    housing: "Levittown's Levittowners, Ranchers and Jubilees have low, accessible rooflines but modest overhangs, so an overflowing gutter drops water right beside the slab or crawlspace. Outlet placement and discharge extensions matter more here than ladder height.",
    problems: ["heavyRain", "matureTrees", "overflow"],
  },
  "barnegat-nj": {
    title: "Gutter Installation in Barnegat, NJ",
    h1: "Gutter Installation in Barnegat & the Jersey Shore",
    description: "Gutter installation and guards for Barnegat, Manahawkin and Long Beach Island area homes. Systems built for coastal storms and shore weather. Free estimates.",
    region: "the southern Ocean County shore",
    exposure: "nj-coastal",
    intro: "Barnegat, Manahawkin and the Long Beach Island communities live with wind-driven rain, nor'easters and salt air. Gutters near the shore need secure fastening and corrosion-resistant hardware more than anywhere else we work.",
    housing: "Shore-area homes range from raised coastal construction to wooded inland streets in Waretown and Forked River. We match materials and attachment methods to the exposure, because a gutter that survives a shore winter is fastened differently than one two counties inland.",
    problems: ["coastal", "heavyRain", "overflow"],
  },
  "cape-may-new-jersey": {
    title: "Gutter Services in Cape May, NJ",
    h1: "Gutter Services in Cape May, NJ",
    description: "Gutter services for Cape May and shore-area homes: seamless gutters, guards, fascia repair and downspouts that stand up to salt air and coastal storms.",
    region: "the southern Jersey Shore",
    exposure: "nj-coastal",
    intro: "Cape May's painted trim and historic exteriors make failing gutters expensive: every overflow streaks siding and rots decorative woodwork. Coastal storms and salt air add wear that inland systems never see.",
    housing: "Between classic shore homes and newer coastal construction, roof edges in this area carry more detail and more paint than most. We plan gutter and downspout runs that protect that finish work and stand up to wind-driven rain.",
    problems: ["coastal", "fasciaDamage", "heavyRain"],
  },
  "eatontown-nj": {
    title: "Gutter Installation in Eatontown, NJ",
    h1: "Gutter Installation in Eatontown & Monmouth County",
    description: "Gutter installation, guards and replacement for Eatontown, Red Bank and Monmouth County homes near the shore. Free on-site estimates.",
    region: "Monmouth County",
    exposure: "nj-coastal",
    intro: "Eatontown sits in the middle of Monmouth County's shore corridor, with Red Bank, Long Branch and Tinton Falls minutes away. Homes here get coastal storm exposure and the debris load of established, tree-lined neighborhoods at the same time.",
    housing: "Monmouth County streets mix older colonials under mature trees with newer developments closer to the parkway. The right gutter setup differs between them, which is why every estimate here starts with the actual roofline rather than a standard package.",
    problems: ["coastal", "matureTrees", "heavyRain"],
  },
  "hampton-nj": {
    title: "Gutter Services in Hampton, NJ",
    h1: "Gutter Services in Hampton & Hunterdon County",
    description: "Gutter services for Hampton, Clinton and Hunterdon County homes: installation, guards, replacement and downspouts for wooded, hilly properties.",
    region: "Hunterdon County",
    exposure: "nj-inland",
    intro: "Hampton, Clinton and the surrounding Hunterdon County townships are hilly, wooded and rural — beautiful conditions that are genuinely hard on gutters. Slopes speed runoff toward foundations, and the tree cover never stops shedding.",
    housing: "Farmhouses, older colonials and homes on multi-acre wooded lots dominate this area. Long rooflines and detached garages or barns often need their own drainage planning, and discharge has to work with the natural slope of the property.",
    problems: ["matureTrees", "freezeThaw", "foundationWater"],
  },
  "jackson-nj": {
    title: "Gutter Installation in Jackson, NJ",
    h1: "Gutter Installation in Jackson, NJ",
    description: "Seamless gutter installation and pine-ready gutter guards for Jackson, Freehold and Lakewood area homes. Free estimates and clear recommendations.",
    region: "western Ocean County",
    exposure: "nj-inland",
    pines: true,
    intro: "Jackson's neighborhoods border the Pinelands, which means pine needles — the debris that defeats basic gutter screens. Add fast-growing developments with valley-heavy rooflines, and gutter systems here need real planning.",
    housing: "Newer developments across Jackson, Howell and Freehold favor complex roof designs that concentrate runoff at a few points. Combined with needle drop from surrounding pines, fine-mesh guards and well-placed outlets are the usual recipe here.",
    problems: ["leafBuildup", "heavyRain", "roofValleys"],
  },
  "longport-new-jersey": {
    title: "Gutter Services in Longport, NJ",
    h1: "Gutter Services in Longport & Absecon Island",
    description: "Gutter services for Longport, Margate and Ventnor homes: seamless gutters, guards and downspouts built for direct coastal exposure on Absecon Island.",
    region: "Absecon Island and the Atlantic County shore",
    exposure: "nj-coastal",
    intro: "Longport, Margate and Ventnor homes take the shore head-on: salt spray, hard wind and storms that push rain sideways. Gutter systems on the island earn replacement sooner than inland systems unless materials and fastening are chosen for the exposure.",
    housing: "Island properties are close-set, so an overflowing gutter often sheets water onto a neighbor's walkway or your own outdoor shower and deck. Tight, correctly routed downspouts matter as much as the gutters themselves on these lots.",
    problems: ["coastal", "overflow", "fasciaDamage"],
  },
  "manchester-township-nj": {
    title: "Gutter Services in Manchester Township, NJ",
    h1: "Gutter Services in Manchester Township, NJ",
    description: "Gutter guards, installation and fascia work for Manchester Township, Whiting and Ocean County adult communities. Low-maintenance drainage options.",
    region: "central Ocean County",
    exposure: "nj-inland",
    pines: true,
    intro: "Manchester Township, Whiting and the surrounding adult communities sit deep in pine country. For many homeowners here the goal is simple: a gutter system that does not require getting on a ladder every month.",
    housing: "Single-story homes in communities like Crestwood Village and Holiday City make gutter work accessible, but the surrounding pines keep needles falling year-round. Fine-mesh guards over correctly pitched gutters are the most requested combination in this area.",
    problems: ["leafBuildup", "fasciaDamage", "overflow"],
  },
  "moorestown-nj": {
    title: "Gutter Installation in Mt Laurel, NJ",
    h1: "Gutter Installation in Mt Laurel & Burlington County",
    description: "Gutter installation, guards and replacement for Mt Laurel, Cherry Hill and Burlington County homes under mature South Jersey trees. Free estimates.",
    region: "Burlington County",
    exposure: "nj-inland",
    intro: "Mt Laurel, Cherry Hill and the surrounding Burlington County towns are established South Jersey suburbs where mature oaks and maples shade most streets. Great for summer, relentless for gutters.",
    housing: "Post-war neighborhoods here have seen roofs and gutters replaced in layers over the decades, and not always well. We frequently correct pitch problems and undersized outlets left over from earlier work while installing new seamless runs.",
    problems: ["matureTrees", "heavyRain", "foundationWater"],
  },
  "princeton-nj": {
    title: "Gutter Installation in Princeton, NJ",
    h1: "Gutter Installation in Princeton, NJ",
    description: "Gutter installation, guards and replacement for Princeton area homes with heavy tree canopy. Careful work on established and historic properties.",
    region: "the Princeton area",
    exposure: "nj-inland",
    intro: "Princeton's canopy of mature trees is part of what makes the town, and it is also why gutters here fill faster than almost anywhere else in central New Jersey. Established homes deserve drainage that protects original trim and stonework.",
    housing: "From historic in-town homes to wooded lots in Montgomery and Hopewell, roof edges here often carry detailed trim and older fascia. We plan attachment and flashing carefully so new gutters protect that material rather than stressing it.",
    problems: ["matureTrees", "leafBuildup", "foundationWater"],
  },
  "vineland-new-jersey": {
    title: "Gutter Installation in Vineland, NJ",
    h1: "Gutter Installation in Vineland & Cumberland County",
    description: "Seamless gutters, downspouts and replacements for Vineland, Bridgeton and Cumberland County homes. Drainage that handles South Jersey downpours.",
    region: "Cumberland County",
    exposure: "nj-inland",
    intro: "Vineland and the Cumberland County towns around it are flat, open and prone to drenching summer storms. With little natural slope to help, roof runoff goes exactly where the downspouts put it — which makes placement the whole game.",
    housing: "Ranch homes and larger rural lots are common from Vineland out toward Bridgeton and Buena. Flat ground means discharge needs deliberate extensions to keep water away from crawlspaces and slabs, a detail we build into every estimate here.",
    problems: ["heavyRain", "foundationWater", "fasciaDamage"],
  },
  "gloucester-county-nj": {
    title: "Gutter Services in Williamstown, NJ",
    h1: "Gutter Services in Williamstown & Gloucester County",
    description: "Gutter installation, guards and downspout services for Williamstown, Sicklerville and Gloucester County homes. Free on-site estimates.",
    region: "Gloucester County",
    exposure: "nj-inland",
    intro: "Williamstown, Sicklerville and the fast-growing Gloucester County townships combine newer developments with older streets near the Pinelands edge. Both get South Jersey's hard summer rain, and both depend on downspouts that actually clear the house.",
    housing: "Newer builds here favor tall rooflines with multiple valleys, while older ranches carry long, low gutter runs. We quote from the actual layout, because the failure points — and the fixes — differ completely between the two.",
    problems: ["heavyRain", "roofValleys", "foundationWater"],
  },
};

// Hubs that are not part of the imported source data but matter for the
// business: Philadelphia (the homepage's primary target market) and Levittown
// (the company's home base). Defined here so `--import` cannot wipe them.
const extraHubs = [
  {
    name: "Philadelphia",
    state: "PA",
    slug: "philadelphia-pa",
    nearby: ["Northeast Philadelphia", "Somerton", "Bustleton", "Mayfair", "Fox Chase", "Rhawnhurst", "Oxford Circle", "Frankford", "Tacony", "Holmesburg", "Torresdale", "Chestnut Hill", "Mount Airy", "Roxborough", "Manayunk"].map((name) => ({ name, state: "PA", slug: name.toLowerCase().replaceAll(" ", "-") })),
  },
  {
    name: "Levittown",
    state: "PA",
    slug: "levittown-pa",
    nearby: ["Fairless Hills", "Bristol", "Tullytown", "Morrisville", "Yardley", "Langhorne", "Penndel", "Hulmeville", "Croydon", "Bensalem", "Feasterville", "Newtown", "Richboro", "Falls Township", "Middletown Township"].map((name) => ({ name, state: "PA", slug: name.toLowerCase().replaceAll(" ", "-") })),
  },
];

// State-level copy varies by exposure so shore pages and inland pages do not
// read the same.
const exposureCopy = {
  pa: "Pennsylvania weather works gutters from both ends of the thermometer. Freeze-thaw cycles pry at seams and fasteners through the winter, snow load tests every hanger, and summer brings short, hard thunderstorms that expose any undersized outlet. A correctly pitched system with solid fascia attachment handles all of it; a marginal one fails a little more each season.",
  "nj-coastal": "Near the Jersey Shore, gutters face conditions inland systems never see: salt-laden air that corrodes cheap hardware, nor'easters that drive rain sideways, and wind that works loose anything not fastened well. Material quality and attachment strength are not upgrades here — they are the baseline for a system that lasts.",
  "nj-inland": "Inland New Jersey brings heavy summer downpours, humid conditions that keep wood fascia vulnerable, and enough winter freeze to punish standing water in a poorly pitched gutter. Homes on wooded lots add a steady debris load on top. The fix is consistent: correct pitch, adequate capacity and downspouts that discharge well away from the house.",
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function decodeHtml(value) {
  return value
    .replace(/<!--.*?-->/gs, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function json(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function slugFromHref(href) {
  return href.split("/").filter(Boolean).at(-1);
}

function problemLabel(key, profile) {
  const label = gutterProblems[key].label;
  return typeof label === "function" ? label(profile) : label;
}

/* ------------------------------------------------------------------ */
/* Source import                                                       */
/* ------------------------------------------------------------------ */

async function importAreas() {
  const response = await fetch(sourceUrl, { headers: { "user-agent": "AllQualityGutters-SEO-Importer/1.0" } });
  if (!response.ok) throw new Error(`Could not load service-area source: ${response.status}`);
  const html = await response.text();
  const blockPattern = /<div class="mb-12"><h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>\s*<\/h2><ul[^>]*>(.*?)<\/ul><\/div>/gis;
  const linkPattern = /<a[^>]*href="(\/areas-we-serve\/[^"]+)"[^>]*>(.*?)<\/a>/gis;
  const hubs = [];
  for (const block of html.matchAll(blockPattern)) {
    const label = decodeHtml(block[2]);
    const match = label.match(/^(.*),\s*(PA|NJ|MD|DE|VA)$/);
    if (!match) continue;
    const nearby = [...block[3].matchAll(linkPattern)].map((item) => {
      const nearbyLabel = decodeHtml(item[2]);
      const nearbyMatch = nearbyLabel.match(/^(.*),\s*(PA|NJ|MD|DE|VA)$/);
      return { name: nearbyMatch?.[1] ?? nearbyLabel, state: nearbyMatch?.[2] ?? match[2], slug: slugFromHref(item[1]) };
    });
    hubs.push({ name: match[1], state: match[2], slug: slugFromHref(block[1]), nearby });
  }
  if (hubs.length < 30) throw new Error(`Expected at least 30 service hubs, found ${hubs.length}`);
  const data = { source: sourceUrl, importedAt: updated, hubs };
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

/* ------------------------------------------------------------------ */
/* Shared markup                                                       */
/* ------------------------------------------------------------------ */

function organizationSchema() {
  return {
    "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
    "@id": `${siteUrl}/#business`,
    name: "All Quality Gutters LLC",
    url: `${siteUrl}/`,
    logo: `${siteUrl}/assets/img/logo-site.webp`,
    image: `${siteUrl}/assets/img/hero-bg-source-match.webp`,
    telephone: "+1-844-588-0075",
    email: "aqgllc2@gmail.com",
    priceRange: "$$",
    address: { "@type": "PostalAddress", streetAddress: "7025 Bristol Pike, Unit 1", addressLocality: "Levittown", addressRegion: "PA", postalCode: "19057", addressCountry: "US" },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "07:00", closes: "18:00" }],
    areaServed: ["Pennsylvania", "New Jersey"],
  };
}

function head({ title, description, canonical, schema }) {
  return `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="All Quality Gutters LLC" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${siteUrl}/assets/img/hero-bg-source-match.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#07130d" />
    <link rel="icon" href="/favicon.png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/assets/css/styles.css?v=20260703-homepage-redesign" />
    <link rel="stylesheet" href="/assets/css/seo-pages.css?v=20260703-homepage-redesign" />
    <script type="application/ld+json">${json(schema)}</script>`;
}

function header() {
  if (!sharedTrustBarMarkup) throw new Error("Shared trust bar was not loaded from index.html");
  return `<a class="skip-link" href="#main">Skip to content</a>
  ${sharedTrustBarMarkup}
  <header class="seo-header"><div class="container seo-header__inner">
    <a class="logo logo--image" href="/" aria-label="All Quality Gutters LLC home"><img class="logo__image" src="/assets/img/logo-site.webp" width="480" height="188" alt="All Quality Gutters LLC" /></a>
    <nav aria-label="Primary navigation"><a href="/#services">Services</a><a href="/areas-we-serve/">Service Areas</a><a href="/guides/">Guides</a><a href="/#reviews">Reviews</a></nav>
    <a class="header-phone" href="tel:+18445880075">+1 844 588 0075</a><a class="btn btn--primary" href="/#estimate" data-open-estimate-modal>Free Estimate</a>
  </div></header>`;
}

function footer() {
  if (!sharedFooterMarkup) throw new Error("Shared footer was not loaded from index.html");
  return sharedFooterMarkup;
}

function pageExtras() {
  if (!sharedPageExtrasMarkup) throw new Error("Shared page extras were not loaded from index.html");
  return sharedPageExtrasMarkup;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map((item, index) => index === items.length - 1 ? `<span aria-current="page">${esc(item.name)}</span>` : `<a href="${item.url}">${esc(item.name)}</a>`).join("<span aria-hidden=\"true\">/</span>")}</nav>`;
}

function breadcrumbSchema(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, ...(item.url ? { item: item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}` } : {}) })),
  };
}

function faqMarkup(items, title = "Frequently Asked Questions") {
  return `<section class="seo-section seo-faq"><h2>${esc(title)}</h2><div class="seo-faq__list">${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div></section>`;
}

function faqSchema(items) {
  return { "@type": "FAQPage", mainEntity: items.map(([name, answer]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text: answer } })) };
}

function heroActions() {
  return `<div class="seo-hero__actions"><a class="btn btn--primary btn--large" href="/#estimate" data-open-estimate-modal>Get a Free Estimate</a><a class="btn btn--outline btn--large" href="tel:+18445880075">Call +1 844 588 0075</a></div>`;
}

function areaLinkGrid(hubs) {
  return `<ul class="seo-area-links">${hubs.map((hub) => `<li><a href="/service-areas/${hub.slug}/">${esc(hub.name)}, ${hub.state}</a></li>`).join("")}</ul>`;
}

/* ------------------------------------------------------------------ */
/* Service pages                                                       */
/* ------------------------------------------------------------------ */

function servicePage(service, serviceIndex, hubs) {
  const canonical = `${siteUrl}/services/${service.slug}/`;
  // Rotate which hubs each service page links to, so every service-area page
  // receives internal links from at least one service page.
  const linkedHubs = Array.from({ length: 8 }, (_, i) => hubs[(serviceIndex * 8 + i) % hubs.length]);
  const crumbs = [{ name: "Home", url: "/" }, { name: "Services", url: "/#services" }, { name: service.name }];
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(),
      { "@type": "Service", "@id": `${canonical}#service`, name: service.name, description: service.description, provider: { "@id": `${siteUrl}/#business` }, areaServed: [{ "@type": "State", name: "Pennsylvania" }, { "@type": "State", name: "New Jersey" }], url: canonical },
      breadcrumbSchema([{ name: "Home", url: "/" }, { name: "Services", url: "/#services" }, { name: service.name, url: `/services/${service.slug}/` }]),
      faqSchema(service.faq),
    ],
  };
  return `<!DOCTYPE html><html lang="en"><head>${head({ title: `${service.title} | All Quality Gutters`, description: service.description, canonical, schema })}</head><body>${header()}<main id="main"><section class="seo-hero"><div class="container">${breadcrumbs(crumbs)}<p class="seo-eyebrow">Residential Gutter Services</p><h1>${esc(service.h1)}</h1><p>${esc(service.intro)}</p>${heroActions()}</div></section><div class="container seo-layout"><article><section class="seo-section"><h2>Built Around the Complete Water-Drainage Path</h2><p>${esc(service.intro)}</p><p>Every estimate starts with the visible conditions at the property: roofline, gutter length, valleys, fascia, outlet locations, grading and safe access. Recommendations are explained before work begins.</p></section><section class="seo-section seo-two-col"><div><h2>What the Service Includes</h2><ul class="seo-checks">${service.benefits.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div><div><h2>When You Need This Service</h2><ul class="seo-checks">${service.signs.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div></section><section class="seo-section"><h2>What We Inspect Before Recommending Anything</h2><p>A useful quote depends on looking at the right things. During the on-site assessment we check:</p><ul class="seo-checks">${service.inspect.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section><section class="seo-section"><h2>Our Installation Process</h2><ol class="seo-process"><li><strong>Request an estimate.</strong><span>Share the property location and the problem you are seeing.</span></li><li><strong>On-site assessment.</strong><span>We inspect the relevant roof edge and drainage conditions.</span></li><li><strong>Clear recommendation.</strong><span>You receive a defined scope based on the home.</span></li><li><strong>Professional installation.</strong><span>The work area is protected and cleaned when installation is complete.</span></li></ol></section><section class="seo-section"><h2>${esc(service.name)} Across Pennsylvania &amp; New Jersey</h2><p>We provide ${esc(service.name.toLowerCase())} throughout our Pennsylvania and New Jersey coverage area, including these communities:</p>${areaLinkGrid(linkedHubs)}<p class="seo-area-links__more"><a href="/areas-we-serve/">Browse the full service-area directory &rarr;</a></p></section>${faqMarkup(service.faq, `${service.name} FAQs`)}</article><aside class="seo-sidebar"><div class="seo-cta-card"><h2>Get a Free Estimate</h2><p>Tell us what your home needs and we will confirm service availability for your location.</p><a class="btn btn--primary btn--block" href="/#estimate" data-open-estimate-modal>Request an Estimate</a><a href="tel:+18445880075">Or call +1 844 588 0075</a></div><div class="seo-sidebar__links"><h2>Related Services</h2>${services.filter((item) => item.slug !== service.slug).map((item) => `<a href="/services/${item.slug}/">${esc(item.name)}</a>`).join("")}</div><div class="seo-sidebar__links"><h2>Service Areas</h2><a href="/areas-we-serve/">Browse all locations</a></div></aside></div></main>${footer()}${pageExtras()}</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Service-area pages                                                  */
/* ------------------------------------------------------------------ */

function areaFaqs(hub, profile) {
  const label = `${hub.name}, ${hub.state}`;
  const localPair = profile.problems.slice(0, 2).map((key) => problemFaqs[key]({ ...profile, name: hub.name }));
  return [
    [`Do you provide free gutter estimates in ${label}?`, `Yes. Send the property address or ZIP code and a note about the problem you are seeing, and we will confirm current availability in the ${hub.name} area and schedule a no-obligation assessment.`],
    ...localPair,
    [`How do I schedule gutter service near ${hub.name}?`, "Use the estimate form or call the team. We collect the property details, coordinate the next available on-site assessment and explain the recommended scope before any work is scheduled."],
  ];
}

function areaProblemsSection(hub, profile) {
  const ctx = { ...profile, name: hub.name };
  const cards = profile.problems.map((key) => `<li><strong>${esc(problemLabel(key, ctx))}</strong><p>${esc(gutterProblems[key].detail(ctx))}</p></li>`).join("");
  return `<section class="seo-section"><h2>Common Gutter Problems in ${esc(hub.name)}, ${esc(stateNames[hub.state])}</h2><p>These are the drainage issues we see most often on homes around ${esc(hub.name)}:</p><ul class="seo-problem-list">${cards}</ul></section>`;
}

function areaReasonsSection(hub, profile) {
  const reasons = [
    ...profile.problems.map((key) => requestReasons[key]),
    "Preparing for a roof replacement or exterior repaint",
    "Fixing inspection items when buying or selling a home",
  ];
  return `<section class="seo-section"><h2>Why Homeowners in ${esc(hub.name)} Request Gutter Service</h2><ul class="seo-checks">${reasons.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>`;
}

function nearbyHubLinks(hub, hubs) {
  const sameState = hubs.filter((item) => item.state === hub.state && item.slug !== hub.slug);
  const start = sameState.findIndex((item) => item.name.localeCompare(hub.name, "en") > 0);
  const rotated = start === -1 ? sameState : [...sameState.slice(start), ...sameState.slice(0, start)];
  return rotated.slice(0, 4);
}

function areaPage(hub, hubs) {
  const profile = localProfiles[hub.slug];
  if (!profile) throw new Error(`Missing local profile for hub: ${hub.slug}`);
  const label = `${hub.name}, ${hub.state}`;
  const canonical = `${siteUrl}/service-areas/${hub.slug}/`;
  const nearbyNames = hub.nearby.map((item) => `${item.name}, ${item.state}`);
  const faqs = areaFaqs(hub, profile);
  const neighbors = nearbyHubLinks(hub, hubs);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(),
      {
        "@type": "Service",
        "@id": `${canonical}#service`,
        name: `Gutter services in ${label}`,
        description: profile.description,
        provider: { "@id": `${siteUrl}/#business` },
        areaServed: { "@type": "City", name: label, containedInPlace: { "@type": "State", name: stateNames[hub.state] } },
        serviceType: services.map((item) => item.name),
        url: canonical,
      },
      breadcrumbSchema([{ name: "Home", url: "/" }, { name: "Service Areas", url: "/areas-we-serve/" }, { name: label, url: `/service-areas/${hub.slug}/` }]),
      faqSchema(faqs),
    ],
  };
  return `<!DOCTYPE html><html lang="en"><head>${head({ title: `${profile.title} | All Quality Gutters`, description: profile.description, canonical, schema })}</head><body>${header()}<main id="main"><section class="seo-hero"><div class="container">${breadcrumbs([{ name: "Home", url: "/" }, { name: "Service Areas", url: "/areas-we-serve/" }, { name: label }])}<p class="seo-eyebrow">Local Gutter Contractor</p><h1>${esc(profile.h1)}</h1><p>${esc(profile.intro)}</p>${heroActions()}</div></section><div class="container seo-layout"><article><section class="seo-section"><h2>Gutter Services for ${esc(hub.name)} Homeowners</h2><p>${esc(profile.housing)}</p><p>${esc(exposureCopy[profile.exposure])}</p><p>All Quality Gutters plans each system around the roofline, fascia condition, expected runoff and practical discharge points. The goal is straightforward: collect roof water and move it away from vulnerable exterior areas.</p></section>${areaProblemsSection(hub, profile)}<section class="seo-section"><h2>Services Available in the ${esc(hub.name)} Area</h2><div class="seo-service-links">${services.map((service) => `<a href="/services/${service.slug}/"><strong>${esc(service.name)}</strong><span>${esc(service.cardBlurb)}</span></a>`).join("")}</div></section>${areaReasonsSection(hub, profile)}<section class="seo-section"><h2>Nearby Communities We Serve</h2><p>Coverage around ${esc(hub.name)} extends across ${esc(profile.region)}. Service availability depends on project location and scheduling, so call or send the property ZIP code to confirm your address.</p><ul class="seo-location-list">${nearbyNames.map((name) => `<li>${esc(name)}</li>`).join("")}</ul></section><section class="seo-section"><h2>What to Expect</h2><ol class="seo-process"><li><strong>Tell us about the property.</strong><span>Share the ZIP code, service needed and any visible problems.</span></li><li><strong>Review the conditions.</strong><span>We look at roof runoff, existing gutters, fascia and drainage.</span></li><li><strong>Receive a clear scope.</strong><span>The recommendation and project details are explained before scheduling.</span></li><li><strong>Complete the installation.</strong><span>Our team installs the approved system and cleans the work area.</span></li></ol></section>${faqMarkup(faqs, `Gutter Service FAQs for ${hub.name}`)}<section class="seo-section seo-request-cta"><h2>Request an Estimate in ${esc(hub.name)}</h2><p>Tell us what your home needs and we will confirm availability for your address in ${esc(label)}. Estimates are free and there is no obligation.</p>${heroActions()}</section></article><aside class="seo-sidebar"><div class="seo-cta-card"><h2>Protect Your Home</h2><p>Request a no-obligation gutter assessment in ${esc(label)}.</p><a class="btn btn--primary btn--block" href="/#estimate" data-open-estimate-modal>Request an Estimate</a><a href="tel:+18445880075">Or call +1 844 588 0075</a></div><div class="seo-sidebar__links"><h2>Popular Services</h2>${services.map((item) => `<a href="/services/${item.slug}/">${esc(item.name)}</a>`).join("")}</div><div class="seo-sidebar__links"><h2>Nearby Service Areas</h2>${neighbors.map((item) => `<a href="/service-areas/${item.slug}/">${esc(item.name)}, ${item.state}</a>`).join("")}<a href="/areas-we-serve/">Browse all service areas</a></div></aside></div></main>${footer()}${pageExtras()}</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Directory page                                                      */
/* ------------------------------------------------------------------ */

function directoryPage(data) {
  const canonical = `${siteUrl}/areas-we-serve/`;
  const description = "Explore gutter installation service areas across Pennsylvania and New Jersey. Find the nearest All Quality Gutters regional service hub and request an estimate.";
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(),
      { "@type": "CollectionPage", name: "Gutter Service Areas", url: canonical, description, mainEntity: { "@type": "ItemList", numberOfItems: data.hubs.length, itemListElement: data.hubs.map((hub, index) => ({ "@type": "ListItem", position: index + 1, name: `${hub.name}, ${hub.state}`, url: `${siteUrl}/service-areas/${hub.slug}/` })) } },
      breadcrumbSchema([{ name: "Home", url: "/" }, { name: "Service Areas", url: "/areas-we-serve/" }]),
    ],
  };
  const stateCounts = data.hubs.flatMap((hub) => hub.nearby).reduce((acc, item) => ({ ...acc, [item.state]: (acc[item.state] || 0) + 1 }), {});
  const renderHub = (hub) => `<details><summary><span>${esc(hub.name)}, ${hub.state}</span><small>${hub.nearby.length} nearby communities</small></summary><div><a class="area-directory__hub" href="/service-areas/${hub.slug}/">View ${esc(hub.name)} gutter services &rarr;</a><ul>${hub.nearby.map((item) => `<li>${esc(item.name)}, ${item.state}</li>`).join("")}</ul></div></details>`;
  const stateColumns = [
    ["Pennsylvania", data.hubs.filter((hub) => hub.state === "PA")],
    ["New Jersey", data.hubs.filter((hub) => hub.state === "NJ")],
  ];
  const directoryMarkup = stateColumns.map(([label, hubs]) => `<div class="area-directory__column"><h2>${label}</h2>${hubs.map(renderHub).join("")}</div>`).join("");
  return `<!DOCTYPE html><html lang="en"><head>${head({ title: "Gutter Service Areas in PA & NJ | All Quality Gutters", description, canonical, schema })}</head><body>${header()}<main id="main"><section class="seo-hero seo-hero--directory"><div class="container">${breadcrumbs([{ name: "Home", url: "/" }, { name: "Service Areas" }])}<p class="seo-eyebrow">Areas We Serve</p><h1>Gutter Services Across Pennsylvania &amp; New Jersey</h1><p>Find the regional service hub nearest your property, then request an estimate to confirm availability for your address.</p></div></section><section class="container seo-directory-intro"><h2>Regional Coverage</h2><p>All Quality Gutters serves homeowners from our Levittown, Pennsylvania base throughout Pennsylvania and New Jersey. The directory includes ${stateCounts.PA} Pennsylvania and ${stateCounts.NJ} New Jersey communities represented below.</p><p>Locations are grouped by the nearest regional hub. Every hub page covers the local conditions we plan for — freeze-thaw winters inland, salt air at the shore, tree cover in established suburbs — along with the services available there. Service availability can vary by project location and schedule.</p></section><section class="container area-directory" aria-label="Pennsylvania and New Jersey service areas">${directoryMarkup}</section><section class="seo-directory-cta"><div class="container"><h2>Not Sure Which Area Covers Your Home?</h2><p>Send your ZIP code and the type of gutter work you need. We will confirm availability.</p><a class="btn btn--primary btn--large" href="/#estimate" data-open-estimate-modal>Get a Free Estimate</a></div></section></main>${footer()}${pageExtras()}</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Guide pages                                                         */
/* ------------------------------------------------------------------ */

function guideSidebar(currentSlug) {
  return `<aside class="seo-sidebar"><div class="seo-cta-card"><h2>Get a Free Estimate</h2><p>Questions about your own roofline? An on-site assessment answers them for free.</p><a class="btn btn--primary btn--block" href="/#estimate" data-open-estimate-modal>Request an Estimate</a><a href="tel:+18445880075">Or call +1 844 588 0075</a></div><div class="seo-sidebar__links"><h2>More Guides</h2>${guides.filter((item) => item.slug !== currentSlug).map((item) => `<a href="/guides/${item.slug}/">${esc(item.title)}</a>`).join("")}</div><div class="seo-sidebar__links"><h2>Our Services</h2>${services.map((item) => `<a href="/services/${item.slug}/">${esc(item.name)}</a>`).join("")}</div></aside>`;
}

function guidePage(guide) {
  const canonical = `${siteUrl}/guides/${guide.slug}/`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(),
      { "@type": "Article", "@id": `${canonical}#article`, headline: guide.h1, description: guide.description, author: { "@id": `${siteUrl}/#business` }, publisher: { "@id": `${siteUrl}/#business` }, datePublished: guide.published, dateModified: updated, mainEntityOfPage: canonical, image: `${siteUrl}/assets/img/hero-bg-source-match.webp` },
      breadcrumbSchema([{ name: "Home", url: "/" }, { name: "Guides", url: "/guides/" }, { name: guide.title, url: `/guides/${guide.slug}/` }]),
    ],
  };
  return `<!DOCTYPE html><html lang="en"><head>${head({ title: `${guide.title} | All Quality Gutters`, description: guide.description, canonical, schema })}</head><body>${header()}<main id="main"><section class="seo-hero"><div class="container">${breadcrumbs([{ name: "Home", url: "/" }, { name: "Guides", url: "/guides/" }, { name: guide.title }])}<p class="seo-eyebrow">Homeowner Guide</p><h1>${esc(guide.h1)}</h1><p>${esc(guide.description)}</p>${heroActions()}</div></section><div class="container seo-layout"><article>${guide.body}<section class="seo-section seo-request-cta"><h2>Ready for a Professional Look at Your Gutters?</h2><p>Free on-site assessments across Pennsylvania and New Jersey. No pressure, no obligation — just a clear recommendation for your home.</p>${heroActions()}</section></article>${guideSidebar(guide.slug)}</div></main>${footer()}${pageExtras()}</body></html>`;
}

function guidesIndexPage() {
  const canonical = `${siteUrl}/guides/`;
  const description = "Practical gutter guides for PA and NJ homeowners: gutter sizing, guards vs cleaning, installation cost factors, foundation drainage and winter damage.";
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(),
      { "@type": "CollectionPage", name: "Homeowner Gutter Guides", url: canonical, description, mainEntity: { "@type": "ItemList", numberOfItems: guides.length, itemListElement: guides.map((guide, index) => ({ "@type": "ListItem", position: index + 1, name: guide.title, url: `${siteUrl}/guides/${guide.slug}/` })) } },
      breadcrumbSchema([{ name: "Home", url: "/" }, { name: "Guides", url: "/guides/" }]),
    ],
  };
  return `<!DOCTYPE html><html lang="en"><head>${head({ title: "Homeowner Gutter Guides | All Quality Gutters", description, canonical, schema })}</head><body>${header()}<main id="main"><section class="seo-hero seo-hero--directory"><div class="container">${breadcrumbs([{ name: "Home", url: "/" }, { name: "Guides" }])}<p class="seo-eyebrow">Homeowner Guides</p><h1>Gutter Guides for PA &amp; NJ Homeowners</h1><p>Straight answers to the questions we hear on estimates every week — sizing, guards, costs, drainage and winter damage. No sales pitch, just the reasoning we use on real roofs.</p></div></section><section class="container seo-directory-intro"><h2>Start With Your Question</h2><div class="seo-service-links">${guides.map((guide) => `<a href="/guides/${guide.slug}/"><strong>${esc(guide.title)}</strong><span>${esc(guide.blurb)}</span></a>`).join("")}</div></section><section class="seo-directory-cta"><div class="container"><h2>Prefer an Answer for Your Exact Roof?</h2><p>Guides explain the reasoning. A free on-site assessment applies it to your home.</p><a class="btn btn--primary btn--large" href="/#estimate" data-open-estimate-modal>Get a Free Estimate</a></div></section></main>${footer()}${pageExtras()}</body></html>`;
}

/* ------------------------------------------------------------------ */
/* About page                                                          */
/* ------------------------------------------------------------------ */

function aboutPage(hubs) {
  const canonical = `${siteUrl}/about/`;
  const description = "Family-owned gutter company based in Levittown, PA. Seamless gutters, guards, replacement, soffit, fascia and downspouts across Pennsylvania and New Jersey.";
  const featuredHubs = hubs.filter((hub) => ["levittown-pa", "philadelphia-pa", "media", "willow-grove", "princeton-nj", "moorestown-nj", "eatontown-nj", "jackson-nj"].includes(hub.slug));
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(),
      { "@type": "AboutPage", "@id": `${canonical}#about`, url: canonical, name: "About All Quality Gutters LLC", description, mainEntity: { "@id": `${siteUrl}/#business` } },
      breadcrumbSchema([{ name: "Home", url: "/" }, { name: "About Us", url: "/about/" }]),
    ],
  };
  return `<!DOCTYPE html><html lang="en"><head>${head({ title: "About All Quality Gutters LLC | Levittown, PA", description, canonical, schema })}</head><body>${header()}<main id="main"><section class="seo-hero"><div class="container">${breadcrumbs([{ name: "Home", url: "/" }, { name: "About Us" }])}<p class="seo-eyebrow">About Us</p><h1>About All Quality Gutters LLC</h1><p>A local, family-owned gutter company based in Levittown, Pennsylvania — installing, replacing and protecting gutter systems for homeowners across Pennsylvania and New Jersey.</p>${heroActions()}</div></section><div class="container seo-layout"><article><section class="seo-section"><h2>A Local Company, Not a Call Center</h2><p>All Quality Gutters works out of 7025 Bristol Pike in Levittown, PA. When you call, you reach the team that will actually look at your roofline — not a national lead desk reselling your project. Our crews cover Pennsylvania and New Jersey from Lower Bucks County outward, so scheduling, estimates and any follow-up stay local.</p><p>We are licensed in Pennsylvania and New Jersey, fully insured, and the products we install carry a 50-year product warranty.</p></section><section class="seo-section"><h2>What We Do</h2><p>Residential gutter work is the whole business — not a sideline to roofing or siding:</p><div class="seo-service-links">${services.map((service) => `<a href="/services/${service.slug}/"><strong>${esc(service.name)}</strong><span>${esc(service.cardBlurb)}</span></a>`).join("")}</div></section><section class="seo-section"><h2>How We Work</h2><ol class="seo-process"><li><strong>Free estimate.</strong><span>Send the form or call. We collect the property details and schedule an assessment.</span></li><li><strong>On-site assessment.</strong><span>We measure the actual roofline and check fascia, outlets and drainage.</span></li><li><strong>Clear written scope.</strong><span>You see what we recommend and why before anything is scheduled.</span></li><li><strong>Clean installation.</strong><span>Work areas are protected and cleaned when the job is done.</span></li></ol></section><section class="seo-section"><h2>Where We Work</h2><p>From our Levittown base we serve communities throughout Pennsylvania and New Jersey, including:</p>${areaLinkGrid(featuredHubs)}<p class="seo-area-links__more"><a href="/areas-we-serve/">Browse the full service-area directory &rarr;</a></p></section><section class="seo-section seo-request-cta"><h2>Get in Touch</h2><p>7025 Bristol Pike, Unit 1, Levittown, PA 19057 &middot; Mon&ndash;Sat, 7:00 AM&ndash;6:00 PM &middot; <a href="mailto:aqgllc2@gmail.com">aqgllc2@gmail.com</a></p>${heroActions()}</section></article><aside class="seo-sidebar"><div class="seo-cta-card"><h2>Talk to the Team</h2><p>Free estimates, straight answers and a local crew that shows up.</p><a class="btn btn--primary btn--block" href="/#estimate" data-open-estimate-modal>Request an Estimate</a><a href="tel:+18445880075">Or call +1 844 588 0075</a></div><div class="seo-sidebar__links"><h2>Our Services</h2>${services.map((item) => `<a href="/services/${item.slug}/">${esc(item.name)}</a>`).join("")}</div><div class="seo-sidebar__links"><h2>Homeowner Guides</h2><a href="/guides/">Browse all guides</a></div></aside></div></main>${footer()}${pageExtras()}</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Build pipeline                                                      */
/* ------------------------------------------------------------------ */

function restrictToTargetStates(data) {
  return {
    ...data,
    hubs: data.hubs
      .filter((hub) => targetStates.has(hub.state))
      .map((hub) => ({ ...hub, nearby: hub.nearby.filter((item) => targetStates.has(item.state)) }))
      .sort((a, b) => stateOrder[a.state] - stateOrder[b.state] || a.name.localeCompare(b.name, "en")),
  };
}

async function loadSharedFooter() {
  const homepage = await fs.readFile(path.join(root, "index.html"), "utf8");
  const trustBarMatch = homepage.match(/<div class="trust-bar"[^>]*>\s*<div class="container trust-bar__inner">[\s\S]*?<\/div>\s*<\/div>/);
  const match = homepage.match(/<footer class="footer"[\s\S]*?<\/footer>/);
  const extrasMatch = homepage.match(/<!-- Shared estimate modal -->[\s\S]*?<!-- \/Shared estimate modal -->/);
  if (!trustBarMatch) throw new Error("Could not find the shared trust bar in index.html");
  if (!match) throw new Error("Could not find the shared footer in index.html");
  if (!extrasMatch) throw new Error("Could not find the shared estimate modal in index.html");
  sharedTrustBarMarkup = trustBarMatch[0].replaceAll('src="assets/', 'src="/assets/');
  sharedFooterMarkup = match[0].replaceAll('src="assets/', 'src="/assets/');
  sharedPageExtrasMarkup = extrasMatch[0].replaceAll('src="assets/', 'src="/assets/');
}

async function cleanRegionalPages(activeHubs) {
  const regionalRoot = path.resolve(root, "service-areas");
  const activeSlugs = new Set(activeHubs.map((hub) => hub.slug));
  const entries = await fs.readdir(regionalRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || activeSlugs.has(entry.name)) continue;
    const target = path.resolve(regionalRoot, entry.name);
    if (path.dirname(target) !== regionalRoot) throw new Error(`Refusing to remove unexpected path: ${target}`);
    await fs.rm(target, { recursive: true, force: true });
  }
}

async function writeRedirects(excludedHubs) {
  const rules = [
    "https://allqualitygutters.com/* https://www.allqualitygutters.com/:splat 301",
    "/index.html / 301",
    "/areas /areas-we-serve/ 301",
    "/service-area /areas-we-serve/ 301",
    ...excludedHubs.map((hub) => `/service-areas/${hub.slug}/ /areas-we-serve/ 301`),
  ];
  await fs.writeFile(path.join(root, "_redirects"), `${rules.join("\n")}\n`);
}

function markEstimateModalLinks(html) {
  return html.replace(/<a\b(?![^>]*data-open-estimate-modal)([^>]*href="\/#estimate"[^>]*)>/g, "<a$1 data-open-estimate-modal>");
}

function syncSharedPageExtras(html) {
  const cleaned = html
    .replace(/\s*<!-- Shared estimate modal -->[\s\S]*?<!-- \/Shared estimate modal -->/g, "")
    .replace(/\s*<div class="mobile-sticky" aria-label="Mobile quick actions">[\s\S]*?<\/div>\s*(?=<\/body>)/g, "")
    .replace(/\s*<script src="\/?assets\/js\/main\.js[^"]*"><\/script>\s*/g, "")
    .replace(/\s*<script src="\/?assets\/js\/estimate-modal\.js[^"]*"><\/script>\s*/g, "");

  return cleaned.replace(/\s*<\/body>/, `\n\n${pageExtras()}\n  </body>`);
}

async function syncStandaloneFooters() {
  for (const relativePath of ["privacy-policy/index.html", "terms-conditions/index.html", "disclaimer/index.html"]) {
    const output = path.join(root, relativePath);
    let html = await fs.readFile(output, "utf8");
    html = html.replace(/<div class="trust-bar"[^>]*>\s*<div class="container trust-bar__inner">[\s\S]*?<\/div>\s*<\/div>/, sharedTrustBarMarkup);
    html = html.replace(/<footer class="footer"[\s\S]*?<\/footer>/, footer());
    html = markEstimateModalLinks(html);
    html = syncSharedPageExtras(html);
    await fs.writeFile(output, html);
  }
}

async function writePage(relativePath, html) {
  const output = path.join(root, relativePath);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${html}\n`);
}

function sitemapEntry(url) {
  const priority = url === "/" ? "1.0"
    : url.startsWith("/services/") ? "0.9"
    : url === "/areas-we-serve/" ? "0.9"
    : url.startsWith("/service-areas/") ? "0.6"
    : url === "/about/" || url.startsWith("/guides/") ? "0.5"
    : "0.3";
  const changefreq = url === "/" ? "weekly" : "monthly";
  return `  <url><loc>${siteUrl}${url}</loc><lastmod>${updated}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

async function build(data, excludedHubs) {
  await cleanRegionalPages(data.hubs);
  for (const [index, service] of services.entries()) await writePage(path.join("services", service.slug, "index.html"), servicePage(service, index, data.hubs));
  for (const hub of data.hubs) await writePage(path.join("service-areas", hub.slug, "index.html"), areaPage(hub, data.hubs));
  await writePage(path.join("areas-we-serve", "index.html"), directoryPage(data));
  for (const guide of guides) await writePage(path.join("guides", guide.slug, "index.html"), guidePage(guide));
  await writePage(path.join("guides", "index.html"), guidesIndexPage());
  await writePage(path.join("about", "index.html"), aboutPage(data.hubs));
  await syncStandaloneFooters();
  await writeRedirects(excludedHubs);
  const urls = ["/", ...services.map((service) => `/services/${service.slug}/`), "/areas-we-serve/", ...data.hubs.map((hub) => `/service-areas/${hub.slug}/`), "/guides/", ...guides.map((guide) => `/guides/${guide.slug}/`), "/about/", "/privacy-policy/", "/terms-conditions/", "/disclaimer/"];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(sitemapEntry).join("\n")}\n</urlset>\n`;
  await fs.writeFile(path.join(root, "sitemap.xml"), sitemap);
  console.log(`Generated ${services.length} service pages, ${data.hubs.length} regional pages, ${guides.length} guides, the about page and a ${data.hubs.flatMap((hub) => hub.nearby).length}-location directory.`);
}

const sourceData = process.argv.includes("--import") ? await importAreas() : JSON.parse(await fs.readFile(dataFile, "utf8"));
const data = restrictToTargetStates({ ...sourceData, hubs: [...sourceData.hubs, ...extraHubs] });
const excludedHubs = sourceData.hubs.filter((hub) => !targetStates.has(hub.state));
await loadSharedFooter();
await build(data, excludedHubs);
