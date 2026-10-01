import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { ROUTES } from '@/lib/constants'

const TEAMS = [
  {
    key: 'photography-team',
    title: 'Photography team',
    text: 'The photographers covering weddings and events, led shot by shot from getting ready to the farewell.',
    accent: 'blue',
  },
  {
    key: 'cinematography-team',
    title: 'Cinematography and candid expert team',
    text: 'A dedicated crew for films and candid coverage: the unposed glances, the laughter and the movement between rituals.',
    accent: 'green',
  },
  {
    key: 'editing-team',
    title: 'Editing and color lab',
    text: 'Post production, color grading and the print setup, finished in house on the studio lab with twelve color printing machines.',
    accent: 'pink',
  },
]

/**
 * The studio's team approach. The departments and the way they work
 * together are real; individual introductions join when the studio
 * publishes them.
 */
export function AboutStudio() {
  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow="The studio"
          title="The people behind the work"
          description="Three crews, one roof. Every Markipie event is covered by the photography team and the cinematography and candid experts, then finished by the in-house editing and color lab."
          align="center"
        />
        <div className="mp-about-studio">
          {TEAMS.map((team) => (
            <article key={team.key} className={`mp-team-card mp-team-card--${team.accent}`}>
              <h3 className="mp-team-card__title">{team.title}</h3>
              <p className="mp-team-card__text">{team.text}</p>
            </article>
          ))}
        </div>
        <div className="mp-section-actions mp-section-actions--center">
          <Button to={ROUTES.CONTACT.path} variant="secondary">
            Talk to the studio
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </Container>
    </Section>
  )
}
