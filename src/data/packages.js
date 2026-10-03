/**
 * Photography packages, transcribed exactly as provided by the studio.
 * Prices, crew, deliverables and complimentary items are not to be edited:
 * wording and figures stay as given. The UI renders titles in caps for the
 * display style, but the stored wording is untouched.
 *
 * Groups drive the package tabs on the home page. A future phase moves this
 * data to the admin CMS without changing the card structure.
 */
export const PACKAGE_GROUPS = [
  {
    id: 'wedding',
    label: 'Wedding',
    packages: [
      {
        id: 'single-side-photography',
        number: '01',
        title: 'Single-Side Photography',
        context: null,
        events: [
          { name: 'Haldi-Mehndi', crew: ['1 Photographer', '1 Videographer'] },
          {
            name: 'Wedding',
            crew: ['1 Photographer', '1 Videographer', '1 Candid', '1 Cinematographer'],
          },
        ],
        deliverables: [
          'Unlimited Raw Photos',
          'Teaser Cinematic Video',
          'Short Video or Reels',
          'Long Edited Videos',
          '1 Album 50 Sheet 12x36 Glossy',
          '250 Album Edited Photos',
        ],
        complimentary: ['16X24 Big Size Frame', 'AI Face Recognition', 'Album Selection Tool'],
        price: '₹65,000',
        priceNote: null,
        accent: 'blue',
      },
      {
        id: 'engagement-haldi-mehndi-wedding',
        number: '02',
        title: 'Engagement + Haldi-Mehndi + Wedding',
        context: null,
        events: [
          {
            name: 'Engagement',
            crew: ['1 Photographer', '1 Videographer', '1 Candid', '1 Cinematographer'],
          },
          { name: 'Haldi-Mehndi', crew: ['1 Photographer', '1 Videographer'] },
          {
            name: 'Wedding',
            crew: ['1 Photographer', '1 Videographer', '1 Candid', '1 Cinematographer'],
          },
        ],
        deliverables: [
          'Unlimited Raw Photos',
          'Teaser Cinematic Video',
          'Short Video or Reels',
          'Long Edited Videos',
          '1 Album 60 Sheet 12x36 Glossy',
          '350 Album Edited Photos',
        ],
        complimentary: [
          '16X24 Big Size Frame (2 Nos)',
          'AI Face Recognition',
          'Album Selection Tool',
        ],
        price: '₹90,000',
        priceNote: null,
        accent: 'green',
      },
      {
        id: 'both-side-photography',
        number: '03',
        title: 'Both Side Photography',
        context: null,
        events: [
          {
            name: 'Engagement',
            crew: ['1 Photographer', '1 Videographer', '1 Candid', '1 Cinematographer'],
          },
          { name: 'Haldi-Mehndi', crew: ['1 Photographer', '1 Videographer'] },
          {
            name: 'Wedding',
            crew: ['1 Photographer', '1 Videographer', '1 Candid', '1 Cinematographer'],
          },
        ],
        deliverables: [
          'Unlimited Raw Photos',
          'Teaser Cinematic Video',
          'Short Video or Reels',
          'Long Edited Videos',
          '1 Album 50 Sheet 12x36 Glossy (Each Side)',
          '300 Album Edited Photos (Each Side)',
        ],
        complimentary: [
          '16X24 Big Size Frame (2 Nos)',
          'AI Face Recognition',
          'Album Selection Tool',
        ],
        price: '₹1,20,000',
        priceNote: null,
        accent: 'pink',
      },
      {
        id: 'engagement-wedding-reception',
        number: '04',
        title: 'Engagement + Wedding + Reception',
        context: null,
        events: [
          {
            name: 'Engagement',
            crew: ['1 Photographer', '1 Videographer', '1 Candid', '1 Cinematographer'],
          },
          { name: 'Haldi-Mehndi', crew: ['1 Photographer', '1 Videographer'] },
          {
            name: 'Wedding',
            crew: [
              '1 Photographer',
              '1 Videographer',
              '1 Candid',
              '1 Cinematographer',
              '1 Drone',
            ],
          },
          {
            name: 'Reception',
            crew: [
              '1 Photographer',
              '1 Videographer',
              '1 Cinematographer',
              '1 Candid',
              '1 Drone',
            ],
          },
        ],
        deliverables: [
          'Unlimited Raw Photos',
          'Teaser Cinematic Video',
          'Short Video or Reels',
          'Long Edited Videos',
          '2 Album 40 Sheet 12x36 Glossy (Each Side)',
          'Total 400 Album Edited Photos (Each Side)',
        ],
        complimentary: [
          '16X24 Big Size Frame (2 Nos)',
          'AI Face Recognition',
          'Album Selection Tool',
        ],
        price: '₹1,85,000',
        priceNote: null,
        accent: 'blue',
      },
    ],
  },
  {
    id: 'engagement',
    label: 'Engagement',
    packages: [
      {
        id: 'engagement-photography-100',
        number: '05',
        title: 'Engagement Photography',
        context: 'Up to 100 Gathering',
        events: null,
        crew: ['1 Cinematographer', '1 Candid'],
        deliverables: [
          'Unlimited Raw Photos',
          'Teaser Cinematic Video',
          'Short Video or Reel',
          'Long Edited Video',
        ],
        complimentary: ['16X24 Frame'],
        price: '₹15,000',
        priceNote: 'With Album: ₹18,000',
        accent: 'green',
      },
      {
        id: 'engagement-photography-200',
        number: '06',
        title: 'Engagement Photography',
        context: 'Up to 125-200 Gathering',
        events: null,
        crew: ['1 Photographer', '1 Videographer', '1 Candid', '1 Cinematographer'],
        deliverables: [
          'Unlimited Raw Photos',
          'Teaser Cinematic Video',
          'Short Video or Reel',
          'Long Edited Video',
          '1 Album 30 Sheet 12X36 Glossy',
          '150 Album Edited Photos',
        ],
        complimentary: ['16X24 Big Size Frame', 'AI Face Recognition', 'Album Selection Tool'],
        price: '₹35,000',
        priceNote: null,
        accent: 'pink',
      },
    ],
  },
  {
    id: 'pre-wedding',
    label: 'Pre-Wedding',
    packages: [
      {
        id: 'pre-wedding-drone',
        number: '07',
        title: 'Pre-Wedding',
        context: 'Paid Location Delhi-NCR',
        events: null,
        crew: ['1 Cinematographer', '1 Candid Photographer', '1 Drone'],
        deliverables: [
          'Unlimited Raw Photos',
          'Teaser Cinematic Video',
          'Short Video or Reel',
          '1 Album 20 Sheet 12x36 Glossy',
          '100 Album Edited Photos',
        ],
        complimentary: ['16x24 Frame', '1 Magazine Style Album 15 Pages'],
        price: '₹45,000',
        priceNote: null,
        accent: 'blue',
      },
      {
        id: 'pre-wedding',
        number: '08',
        title: 'Pre-Wedding',
        context: 'Paid Location Delhi-NCR',
        events: null,
        crew: ['1 Cinematographer', '1 Candid Photographer'],
        deliverables: [
          'Unlimited Raw Photos',
          'Teaser Cinematic Video',
          'Short Video or Reel',
          '1 Album 15 Sheet 12x36 Glossy',
          '75 Album Edited Photos',
        ],
        complimentary: ['16x24 Frame', '1 Magazine Style Album 10 Pages'],
        price: '₹25,000',
        priceNote: null,
        accent: 'green',
      },
    ],
  },
  {
    id: 'birthday',
    label: 'Birthday',
    packages: [
      {
        id: 'birthday-photography-100',
        number: '09',
        title: 'Birthday Photography',
        context: 'Up to 100 Gathering',
        events: null,
        crew: ['1 Cinematographer', '1 Candid'],
        deliverables: [
          'Unlimited Raw Photos',
          'Teaser Cinematic Video',
          'Short Video or Reel',
          'Long Edited Video',
        ],
        complimentary: ['16X24 Frame'],
        price: '₹15,000',
        priceNote: 'With Album: ₹18,000',
        accent: 'pink',
      },
    ],
  },
]
