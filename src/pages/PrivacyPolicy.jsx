import { LegalPage } from '@/components/ui/LegalPage'
import { useSEO } from '@/hooks/useSEO'

const PRIVACY_SECTIONS = [
  {
    heading: 'Information we collect',
    paragraphs: [
      'This website is built so that it collects as little information as possible. There is no account signup for visitors and no newsletter form.',
      'When you contact the studio you do it directly through WhatsApp, phone or Instagram, so the conversation and any details you share there stay in that channel with you and the studio.',
      'If you open a client gallery you enter an event code or scan the event QR code. The website records which event you opened and the likes and dislikes you leave on photos, tied to a random session identifier created in your browser for that gallery.',
      'Studio staff sign in to the admin panel with an account created by the studio. Those sign-ins are handled by the platform authentication service and are limited to studio use.',
    ],
  },
  {
    heading: 'How the information is used',
    paragraphs: [
      'Event access is used only to show you the gallery that code belongs to. Reactions are used to mark your selected photos and help the studio understand which images you care about. Nothing is sold, and nothing is shared with advertisers.',
      'The website contains no advertising or tracking pixels and no third-party analytics scripts.',
    ],
  },
  {
    heading: 'Client galleries and photos',
    paragraphs: [
      'Event photos and films are stored on the studio\'s private cloud storage and streamed to you through this website. The storage links are never exposed, and a gallery can only be opened with its event code or QR code.',
      'Galleries are visible only while the studio keeps the event active. When an event is archived, its media can no longer be opened with the code.',
      'Downloads, watermarks and reactions are set per event by the studio. If downloads are switched off for your event, the website and its server both refuse download requests.',
    ],
  },
  {
    heading: 'Face scan',
    paragraphs: [
      'The face scan is optional. It uses your device camera, live, to find photos of you inside the single event you have opened. The video from your camera is processed in your browser and is never uploaded, stored or sent anywhere.',
      'To make the search work, the studio generates face descriptors from the event photos. These descriptors are numbers, not images, and they work only within that event. There is no search across events and no face database of visitors.',
      'The camera stream stops the moment the scan finishes or you cancel it. If you prefer not to use the camera at all, you can browse every photo in the gallery normally without scanning.',
    ],
  },
  {
    heading: 'Storage on your device',
    paragraphs: [
      'The website keeps a few small values in your browser: your choice about the opening animation, your gallery session identifier and your reactions while a gallery is open. These stay on your device and can be cleared at any time from your browser settings.',
      'The website loads its typefaces from Google Fonts, so Google sees the requests your browser makes for those files. Standard hosting logs may also record requests to keep the site secure and available.',
    ],
  },
  {
    heading: 'Your choices',
    paragraphs: [
      'You can remove a like or dislike by tapping the same reaction again. You can ask the studio to remove your event gallery, your reactions or your face descriptors from an event by contacting us.',
      'You never have to use the face scan, and you can browse and download (where your event allows it) without it.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: [
      'For any privacy question or request, call or message the studio on WhatsApp at 8586000345, or reach the studio on Instagram at @markipieofficial.',
    ],
  },
]

/**
 * Privacy policy. Written to match what the website actually does today:
 * event-code galleries, streamed media, browser-local face scan and no
 * trackers. Kept in plain language on purpose.
 */
export default function PrivacyPolicy() {
  useSEO({
    title: 'Privacy Policy',
    description: 'How Markipie handles information collected through this website.',
    path: '/privacy-policy',
  })

  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="How information collected through this website is handled."
      intro="This policy explains what the website collects, why, and the choices you have. It is written to match how the site actually works."
      updated="30 September 2026"
      sections={PRIVACY_SECTIONS}
    />
  )
}
