import { useState } from 'react'
import { Camera } from 'lucide-react'
import { FaceScanFlow } from '@/components/facescan/FaceScanFlow'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { Section } from '@/components/ui/Section'
import { ROUTES } from '@/lib/constants'

/**
 * Client access call to action. The gallery opens with a personal event
 * code, and the AI face scan finds the visitor's own photos with a live
 * camera scan. The scan searches only the visitor's authorized event, so
 * it asks for the event code after the scan.
 */
export function ClientAccessCta() {
  const [scanOpen, setScanOpen] = useState(false)

  return (
    <Section tint="blue">
      <Container width="narrow" className="mp-cta">
        <p className="mp-eyebrow mp-eyebrow--center">For clients</p>
        <h2 className="mp-client-cta__title">Your memories. Your gallery.</h2>
        <p className="mp-cta__text">
          If Markipie has covered your event, your private gallery is one code away. Open it
          with your event code, a QR link, or a quick face scan.
        </p>
        <div className="mp-section-actions mp-section-actions--center">
          <Button to={ROUTES.CLIENT_ACCESS.path}>Access Your Gallery</Button>
        </div>
        <div className="mp-cta__face">
          <p className="mp-cta__face-title">Find your photos</p>
          <p className="mp-cta__face-text">
            Scan your face and discover your Markipie moments. The camera scan runs in your
            browser and searches only your own event after your event code.
          </p>
          <button type="button" className="mp-cta__face-btn" onClick={() => setScanOpen(true)}>
            <Camera size={15} aria-hidden="true" />
            Start Face Scan
          </button>
        </div>
      </Container>

      <FaceScanFlow open={scanOpen} onClose={() => setScanOpen(false)} />
    </Section>
  )
}
