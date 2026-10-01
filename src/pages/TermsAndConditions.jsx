import { LegalPage } from '@/components/ui/LegalPage'
import { useSEO } from '@/hooks/useSEO'

const TERMS_SECTIONS = [
  {
    heading: 'Services and bookings',
    paragraphs: [
      'Markipie provides photography, cinematography, candid coverage, editing, color grading, album design, printing and creative digital services. The packages and prices shown on this website describe the standard offerings; anything beyond them is agreed with the studio individually.',
      'Bookings are made by contacting the studio directly on WhatsApp, phone or Instagram. A booking is confirmed only when the studio confirms it back to you in writing on the same channel.',
    ],
  },
  {
    heading: 'Payments',
    paragraphs: [
      'This website does not process online payments. Payment amounts, schedule and method are agreed between you and the studio at the time of booking.',
      'The studio records the payment status of each event internally. Gallery features such as downloads are set per event by the studio and follow the permissions agreed for your booking, not an automatic rule.',
    ],
  },
  {
    heading: 'Delivery and client galleries',
    paragraphs: [
      'Delivered photos and films are published to a private gallery on this website. Access is by the event code or QR code given to you by the studio. Keep that code private: anyone holding it can open the gallery while the event is active.',
      'Watermarks, downloads, reactions and the face scan are enabled or disabled per event by the studio. Photos may be added, updated or removed as the studio finishes work on the event.',
      'Where your event allows downloads, downloads are for your personal use. The website and its server refuse downloads for events where the studio has disabled them.',
    ],
  },
  {
    heading: 'Copyright and use of photos',
    paragraphs: [
      'Copyright in all photographs and films remains with Markipie and its photographers. When your event permits downloads, you receive a personal, non-commercial licence to keep and share those files with family and friends.',
      'Commercial use, resale, entering the files into competitions, and editing or cropping to remove watermarks are not permitted without the studio\'s written permission.',
      'The studio may feature its work publicly, including on its Instagram profile and website. If you prefer that images from your event are not featured, tell the studio at booking or at any time afterwards and the request will be respected.',
    ],
  },
  {
    heading: 'Acceptable use',
    paragraphs: [
      'Do not share event codes or gallery links in public places, attempt to open events that are not yours, scrape or bulk-download the website, or interfere with how the website works.',
      'Access to a gallery can be revoked by the studio, for example when a code is leaked publicly or the terms in this section are broken.',
    ],
  },
  {
    heading: 'Liability and governing law',
    paragraphs: [
      'The website and galleries are provided with reasonable care. To the extent permitted by law, the studio\'s liability for any claim connected with a booking is limited to the amount actually paid for that booking.',
      'These terms are governed by the laws of India, and any dispute is subject to the exclusive jurisdiction of the courts of Jaipur, Rajasthan.',
    ],
  },
  {
    heading: 'Changes',
    paragraphs: [
      'The studio may update these terms as the services evolve. The date of the latest change is always shown on this page, and the version in force is the one published here at the time you use the website.',
    ],
  },
]

/**
 * Terms and conditions, written to match how the studio actually operates:
 * direct bookings, offline payments, event-code galleries with per-event
 * permissions, and studio copyright with personal-use downloads.
 */
export default function TermsAndConditions() {
  useSEO({
    title: 'Terms & Conditions',
    description: 'The terms that govern Markipie services and this website.',
    path: '/terms-and-conditions',
  })

  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms & Conditions"
      description="The terms that govern services and use of this website."
      intro="These terms cover bookings, payments, galleries and the use of photos delivered by Markipie. By using this website and its client galleries you agree to them."
      updated="30 September 2026"
      sections={TERMS_SECTIONS}
    />
  )
}
