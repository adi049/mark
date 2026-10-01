import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Reveal } from '@/components/ui/Reveal'
import { Section } from '@/components/ui/Section'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { fetchPublishedBlogs } from '@/lib/dbAdapters'
import { formatDate } from '@/lib/format'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ROUTES } from '@/lib/constants'

/**
 * Latest journal posts on the home page. Real, published posts from the
 * studio database; an empty journal says so quietly. The section stays
 * hidden entirely while the site runs without a backend configured.
 */
export function LatestBlogs() {
  const { configured, status, data } = useSupabaseQuery(fetchPublishedBlogs, [])

  if (!configured) {
    return null
  }

  const posts = (Array.isArray(data) ? data : []).slice(0, 3)

  return (
    <Section className="mp-home-blogs">
      <Container>
        <SectionHeading
          eyebrow="Journal"
          title="Latest from the studio"
          description="Shoot notes, studio updates and stories from the Markipie team."
        />

        {status === 'loading' ? (
          <div className="mp-home-blogs__grid" aria-live="polite" aria-busy="true">
            {[0, 1, 2].map((key) => (
              <article key={key} className="mp-home-blogs__card is-loading">
                <span className="mp-skeleton mp-skeleton--chip" />
                <span className="mp-skeleton mp-skeleton--title" />
                <span className="mp-skeleton" />
              </article>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="mp-section-note">
            The journal launches with the studio&apos;s first post. New stories appear here first.
          </p>
        ) : (
          <div className="mp-home-blogs__grid">
            {posts.map((post, index) => (
              <Reveal key={post.slug} className="mp-home-blogs__card" delay={Math.min(index * 0.06, 0.2)}>
                <Link className="mp-home-blogs__link" to={`/blogs/${post.slug}`}>
                  <span className="mp-home-blogs__meta">
                    {post.category}
                    {post.publishedAt ? ` · ${formatDate(post.publishedAt)}` : ''}
                  </span>
                  <h3 className="mp-home-blogs__title">{post.title}</h3>
                  <p className="mp-home-blogs__excerpt">{post.excerpt}</p>
                  <span className="mp-home-blogs__more">
                    Read the post
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        <div className="mp-section-actions mp-section-actions--center">
          <Link className="mp-text-link" to={ROUTES.BLOGS.path}>
            Read the journal
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </Container>
    </Section>
  )
}
