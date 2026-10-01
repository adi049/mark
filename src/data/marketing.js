/**
 * Marketing service pricing as provided. Starting prices only; the
 * architecture accepts additional packages later by extending this array.
 */
export const MARKETING_PACKAGES = [
  {
    id: 'social-media-management',
    name: 'Social Media Management',
    price: '₹15,000',
    unit: 'starting per month',
    features: ['Video Shoot', 'Video Editing', 'Social Media Management'],
    accent: 'blue',
    featured: true,
  },
  {
    id: 'video-editing',
    name: 'Video Editing',
    price: '₹1,500',
    unit: 'starting',
    features: [],
    accent: 'green',
    featured: false,
    text: 'Your footage, cut and finished by the studio editing team.',
  },
  {
    id: 'graphic-design',
    name: 'Graphic Design',
    price: '₹700',
    unit: 'starting',
    features: [],
    accent: 'pink',
    featured: false,
    text: 'Design work for invitations, albums and brand assets.',
  },
]
