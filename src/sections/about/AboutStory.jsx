import { Container } from '@/components/ui/Container'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'

/**
 * The studio story, written from the confirmed facts only: more than a
 * thousand weddings, seven-plus years of work, and a studio that kept
 * finishing everything in house. No names, cities or awards are invented.
 */
export function AboutStory() {
  return (
    <Section>
      <Container>
        <div className="mp-about-story">
          <div className="mp-about-story__text">
            <SectionHeading
              eyebrow="The story"
              title="How Markipie came to be"
              description="Markipie grew out of a simple conviction: a wedding deserves one team that shoots, films, edits and finishes the work themselves."
            />
            <div className="mp-about-story__body">
              <p>
                Over seven-plus years, the studio has covered more than a thousand weddings. Each
                one pushed the same lesson forward: couples remember how the day felt, not just how
                it looked. So Markipie built its practice around both sides, photography and
                cinematography, with candid specialists who watch for the moments in between.
              </p>
              <p>
                Instead of sending work out, the studio kept bringing it in house. The editing
                suite, the color lab and twelve color printing machines all live under one roof,
                which means a Markipie gallery is graded, retouched and printed by the same hands
                that shot it.
              </p>
              <p>
                Today the studio covers weddings and events end to end and applies the same craft
                to creative and marketing work for brands. The story continues with every
                celebration that trusts the team with it.
              </p>
            </div>
          </div>
          <figure className="mp-about-story__figure">
            <img
              src="/assets/placeholders/wide-ink.jpg"
              alt="Markipie studio artwork in deep charcoal tones"
              width="1280"
              height="800"
              loading="lazy"
            />
          </figure>
        </div>
      </Container>
    </Section>
  )
}
