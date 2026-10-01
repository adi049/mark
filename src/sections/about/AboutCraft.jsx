import { Container } from '@/components/ui/Container'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'

const CRAFTS = [
  {
    key: 'photography',
    eyebrow: 'Photography',
    title: 'Coverage by the photography team',
    text: 'Weddings, candid moments and events, covered by a dedicated photography crew from the first ritual to the final send off. The candid specialists work alongside the main coverage, watching for the moments that happen between the poses.',
    image: '/assets/placeholders/portrait-sage.jpg',
    imageAlt: 'Markipie studio artwork in soft sage green tones',
  },
  {
    key: 'cinematography',
    eyebrow: 'Cinematography',
    title: 'Films by the cinematography crew',
    text: 'Event films shot by the cinematography team and finished in the studio editing suite, from teasers to full cuts. Sound, pace and music are cut to match how the day actually felt.',
    image: '/assets/placeholders/landscape-blush.jpg',
    imageAlt: 'Markipie studio artwork in soft blush pink tones',
  },
]

const WORKFLOW = [
  {
    key: 'plan',
    title: 'Before the event',
    text: 'Dates, functions and the coverage plan are agreed with the studio, so the right crews and gear are booked for every ritual.',
  },
  {
    key: 'cover',
    title: 'On the day',
    text: 'Photography, cinematography and candid teams work the event together, without directing it away from what is actually happening.',
  },
  {
    key: 'finish',
    title: 'After the wedding',
    text: 'Selection, editing and color grading happen in house, and prints and albums come off the studio lab with twelve color printing machines.',
  },
]

/**
 * The two crafts as editorial rows, plus the studio's working method:
 * plan, cover, finish. Everything stays within the confirmed studio facts.
 */
export function AboutCraft() {
  return (
    <Section tint="alt">
      <Container>
        <SectionHeading
          eyebrow="The craft"
          title="Photography and cinematography, side by side"
        />
        <div className="mp-about-craft">
          {CRAFTS.map((craft, index) => (
            <article
              key={craft.key}
              className={`mp-about-craft__row${index % 2 === 1 ? ' mp-about-craft__row--flip' : ''}`}
            >
              <figure className="mp-about-craft__figure">
                <img src={craft.image} alt={craft.imageAlt} width="780" height="1040" loading="lazy" />
              </figure>
              <div className="mp-about-craft__body">
                <p className="mp-eyebrow">{craft.eyebrow}</p>
                <h3 className="mp-about-craft__title">{craft.title}</h3>
                <p className="mp-about-craft__text">{craft.text}</p>
              </div>
            </article>
          ))}

          <article className="mp-about-craft__row mp-about-craft__row--solo">
            <div className="mp-about-craft__body">
              <p className="mp-eyebrow">Creative approach</p>
              <h3 className="mp-about-craft__title">How a Markipie event runs</h3>
              <div className="mp-about-craft__steps">
                {WORKFLOW.map((step, index) => (
                  <div key={step.key} className="mp-about-craft__step">
                    <span className="mp-about-craft__step-index">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h4 className="mp-about-craft__step-title">{step.title}</h4>
                      <p className="mp-about-craft__step-text">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </Container>
    </Section>
  )
}
