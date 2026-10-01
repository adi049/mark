/**
 * Service lines offered by the studio. Icons map to lucide icons in the
 * services grids; accents rotate between the three brand tints. The first
 * two services render as large image cards on the home and services pages.
 *
 * Copy stays within the confirmed studio facts: photography and
 * cinematography crews, candid specialists, in-house editing, color lab and
 * print. Package numbers live in packages.js and are never duplicated here.
 */
export const SERVICES = [
  {
    slug: 'wedding-photography',
    title: 'Wedding Photography',
    icon: 'Camera',
    accent: 'blue',
    text: 'Complete wedding day coverage by the Markipie photography team, from getting ready to the last dance.',
    points: ['Full-day coverage by the studio photography team', 'Edited and color finished in house'],
    featured: true,
    image: '/assets/placeholders/portrait-blush.jpg',
    imageAlt: 'Studio brand artwork in soft blush pink tones',
  },
  {
    slug: 'wedding-cinematography',
    title: 'Wedding Cinematography',
    icon: 'Clapperboard',
    accent: 'green',
    text: 'Wedding films shot and edited by the in-house cinematography crew, from highlight reels to full-length edits.',
    points: ['Filmed by the studio cinematography crew', 'Edited and graded in the studio suite'],
    featured: true,
    image: '/assets/placeholders/landscape-sky.jpg',
    imageAlt: 'Studio brand artwork in soft sky blue tones',
  },
  {
    slug: 'candid-photography',
    title: 'Candid Photography',
    icon: 'Aperture',
    accent: 'pink',
    text: 'Unposed, natural coverage across all your functions, led by the studio candid specialists.',
    points: ['Dedicated candid team on every event'],
  },
  {
    slug: 'engagement-photography',
    title: 'Engagement Photography',
    icon: 'Sparkles',
    accent: 'green',
    text: 'Engagement sessions with a relaxed, editorial approach, planned around you as a couple.',
    points: ['A planned couple session', 'Edited gallery delivered in house'],
  },
  {
    slug: 'haldi',
    title: 'Haldi Coverage',
    icon: 'Sun',
    accent: 'pink',
    text: 'Haldi mornings covered in their own bright, joyful mood, from the first turmeric touch to the family fun.',
    points: ['Full haldi function coverage', 'Bright, color finished edits'],
  },
  {
    slug: 'mehendi',
    title: 'Mehendi Coverage',
    icon: 'Flower2',
    accent: 'green',
    text: 'Mehendi afternoons documented in detail: the patterns, the people and the music in between.',
    points: ['Detail coverage of the mehendi artistry', 'Candid frames of family and friends'],
  },
  {
    slug: 'reception',
    title: 'Reception Coverage',
    icon: 'GlassWater',
    accent: 'blue',
    text: 'Reception evenings covered as they happen: entrances, speeches, dinner and the dance floor.',
    points: ['Coverage from entry to the last song', 'Evening portraits and group frames'],
  },
  {
    slug: 'pre-wedding',
    title: 'Pre-Wedding',
    icon: 'Heart',
    accent: 'blue',
    text: 'Pre-wedding stories planned and shot as a couple session, at the studio or a location of your choice.',
    points: ['Story planned with the couple', 'Shot at the studio or your location'],
  },
  {
    slug: 'drone-coverage',
    title: 'Drone Coverage',
    icon: 'Plane',
    accent: 'green',
    text: 'Aerial coverage for venues, outdoor functions and cinematic establishing shots. Included in the packages that list it.',
    points: ['Aerial venue and function coverage', 'Flown where venue rules permit'],
  },
  {
    slug: 'album-design',
    title: 'Album Design',
    icon: 'BookOpen',
    accent: 'pink',
    text: 'Hand-finished printed albums, designed and produced by the studio. Album sheets and finishes follow your package.',
    points: ['Spread by spread album design', 'Printed on the in-house machines'],
  },
  {
    slug: 'colour-lab-printing',
    title: 'Colour Lab and Printing',
    icon: 'Printer',
    accent: 'blue',
    text: 'Color grading and print production run on the in-house lab with twelve color printing machines.',
    points: ['Calibrated color grading', 'Prints produced on twelve in-house machines'],
  },
  {
    slug: 'event-photography',
    title: 'Event Photography',
    icon: 'CalendarDays',
    accent: 'pink',
    text: 'Coverage for family functions, receptions and celebrations of every scale.',
    points: ['Coverage sized to your function', 'Edited gallery delivered in house'],
  },
  {
    slug: 'video-editing',
    title: 'Editing',
    icon: 'Film',
    accent: 'blue',
    text: 'Video editing finished in the studio editing suite, from event footage to brand films.',
    points: ['Edited in the studio suite', 'Event footage and brand films'],
  },
  {
    slug: 'graphic-design',
    title: 'Graphic Design',
    icon: 'PenTool',
    accent: 'green',
    text: 'Design work for invitations, albums and brand assets, produced by the studio design desk.',
    points: ['Invitations and album layouts', 'Brand assets from the studio design desk'],
  },
  {
    slug: 'social-media-management',
    title: 'Social Media Management',
    icon: 'Megaphone',
    accent: 'pink',
    text: 'Planning, shooting and running social content for brands, handled end to end by the studio.',
    points: ['Content planned and shot by the studio', 'Managed end to end'],
  },
]

/** The full list, split for the layered grids on home and services. */
export const FEATURED_SERVICES = SERVICES.filter((service) => service.featured)
export const STANDARD_SERVICES = SERVICES.filter((service) => !service.featured)
