import { PageHero } from '@/components/ui/PageHero'
import { Container } from '@/components/ui/Container'
import { STUDIO_STATS } from '@/data/facts'

/**
 * About page opener: what Markipie is, plus the quiet facts row.
 */
export function AboutIntro() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="A studio built around weddings, events and brands"
        description="Markipie is a photography, cinematography and creative digital services studio. Everything from the shoot to the edit, color and print stays with the in-house teams."
      />
      <Container className="mp-about-intro__stats">
        <dl className="mp-hero__stats">
          {STUDIO_STATS.map((stat) => (
            <div key={stat.label} className="mp-hero__stat">
              <dt className="mp-hero__stat-value">{stat.value}</dt>
              <dd className="mp-hero__stat-label">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </>
  )
}
