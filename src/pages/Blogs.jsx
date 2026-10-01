import { ArrowRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { useSEO } from '@/hooks/useSEO'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { fetchPublishedBlogs } from '@/lib/dbAdapters'
import { formatDate } from '@/lib/format'

/**
 * The journal. Posts come from the studio database: whatever is published
 * in the admin panel appears here, and nothing else does. An empty or
 * unconnected journal says so honestly.
 */
export default function Blogs() {
  const { status, data, error, refetch } = useSupabaseQuery(fetchPublishedBlogs, [])
  const posts = Array.isArray(data) ? data : []

  useSEO({
    title: 'Blogs',
    description:
      'The Markipie journal: stories, shoot notes and studio updates from the photography and cinematography team.',
    path: '/blogs',
  })

  return (
    <>
      <PageHero
        eyebrow="Journal"
        title="Blogs"
        description="Stories, shoot notes and studio updates from the Markipie team."
      />

      <Section className="mp-blogs">
        <Container>
          {status === 'loading' ? (
            <div className="mp-blogs__grid" aria-live="polite" aria-busy="true">
              {[0, 1, 2].map((key) => (
                <article key={key} className="mp-blog-card is-loading">
                  <span className="mp-blog-card__media mp-blog-card__media--skeleton" />
                  <div className="mp-blog-card__body">
                    <span className="mp-skeleton mp-skeleton--chip" />
                    <span className="mp-skeleton mp-skeleton--title" />
                    <span className="mp-skeleton" />
                    <span className="mp-skeleton mp-skeleton--short" />
                  </div>
                </article>
              ))}
            </div>
          ) : status === 'error' ? (
            <div className="mp-state-note">
              <p role="alert">{error}</p>
              <Button variant="secondary" onClick={refetch}>
                <RefreshCw size={16} aria-hidden="true" />
                Try again
              </Button>
            </div>
          ) : status === 'not-configured' ? (
            <div className="mp-state-note">
              <p>The journal is not connected yet. Studio posts will appear here once the studio database is linked.</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="mp-state-note">
              <p>No posts yet. New stories from the studio will appear here first.</p>
            </div>
          ) : (
            <div className="mp-blogs__grid">
              {posts.map((post) => (
                <article key={post.id ?? post.slug} className="mp-blog-card">
                  {post.cover ? (
                    <Link
                      to={`/blogs/${post.slug}`}
                      className="mp-blog-card__media"
                      aria-label={`Read: ${post.title}`}
                    >
                      <img src={post.cover} alt="" loading="lazy" />
                    </Link>
                  ) : null}
                  <div className="mp-blog-card__body">
                    <p className="mp-blog-card__meta">
                      <span className="mp-blog-card__category">{post.category}</span>
                    </p>
                    <h2 className="mp-blog-card__title">
                      <Link to={`/blogs/${post.slug}`}>{post.title}</Link>
                    </h2>
                    {post.excerpt ? <p className="mp-blog-card__excerpt">{post.excerpt}</p> : null}
                    <div className="mp-blog-card__foot">
                      <span className="mp-blog-card__date">{formatDate(post.publishedAt)}</span>
                      <Link className="mp-blog-card__read" to={`/blogs/${post.slug}`}>
                        Read more
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  )
}
