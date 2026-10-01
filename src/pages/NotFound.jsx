import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { useSEO } from '@/hooks/useSEO'
import { ROUTES } from '@/lib/constants'

/**
 * 404. Quiet, on brand, with two useful exits.
 */
export default function NotFound() {
  useSEO({
    title: 'Page not found',
    description: 'The page you are looking for does not exist or may have moved.',
    noindex: true,
  })

  return (
    <>
      <PageHero
        eyebrow="404"
        title="Page not found"
        description="The page you are looking for does not exist or may have moved."
      />
      <Section>
        <Container className="mp-section-actions">
          <Button to={ROUTES.HOME.path} variant="secondary">
            Back to home
          </Button>
          <Button to={ROUTES.SERVICES.path} variant="ghost">
            Explore services
          </Button>
        </Container>
      </Section>
    </>
  )
}
