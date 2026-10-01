import { useEffect } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { useSEO } from '@/hooks/useSEO'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { fetchPublishedBlogBySlug } from '@/lib/dbAdapters'
import { ROUTES } from '@/lib/constants'
import { formatDate } from '@/lib/format'

/**
 * A published post. Content is plain text where blank lines separate
 * paragraphs, which is exactly what the admin editor asks for.
 */
export default function BlogPost() {
  const { slug } = useParams()
  const { status, data, error, refetch } = useSupabaseQuery(
    (client) => fetchPublishedBlogBySlug(client, slug),
    [slug]
  )

  useSEO({
    title: data ? data.title : 'Post not found',
    description: data && data.excerpt ? data.excerpt : 'This post does not exist.',
    type: 'article',
    path: `/blogs/${slug}`,
    noindex: !data,
  })

  // Scroll up when switching between posts.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [slug])

  if (status === 'loading') {
    return (
      <>
        <PageHero
          eyebrow="Journal"
          title="Loading post"
          description="One moment while the post arrives."
        />
        <Section>
          <Container width="narrow">
            <div className="mp-state-note" aria-live="polite" aria-busy="true">
              <p>Fetching the post.</p>
            </div>
          </Container>
        </Section>
      </>
    )
  }

  if (status === 'error') {
    return (
      <>
        <PageHero
          eyebrow="Journal"
          title="Post unavailable"
          description="The post could not be loaded right now."
        />
        <Section>
          <Container width="narrow">
            <div className="mp-state-note">
              <p role="alert">{error}</p>
              <Button variant="secondary" onClick={refetch}>
                <RefreshCw size={16} aria-hidden="true" />
                Try again
              </Button>
            </div>
          </Container>
        </Section>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <PageHero
          eyebrow="Journal"
          title="Post not found"
          description="This post does not exist or is no longer published."
        />
        <Section>
          <Container width="narrow" className="mp-section-actions">
            <Button to={ROUTES.BLOGS.path} variant="secondary">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to journal
            </Button>
          </Container>
        </Section>
      </>
    )
  }

  const paragraphs = (data.content || '').split(/\n{2,}/).filter(Boolean)

  return (
    <>
      <PageHero
        eyebrow={`Journal · ${data.category}`}
        title={data.title}
        description={data.excerpt || undefined}
      />

      <Section className="mp-blog-post">
        <Container width="narrow">
          {data.cover ? (
            <figure className="mp-blog-post__cover">
              <img src={data.cover} alt="" />
            </figure>
          ) : null}

          <div className="mp-blog-post__body">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p>{data.excerpt}</p>
            )}
          </div>

          <div className="mp-blog-post__meta">
            <span className="mp-blog-card__date">{formatDate(data.publishedAt)}</span>
          </div>

          <div className="mp-section-actions">
            <Button to={ROUTES.BLOGS.path} variant="secondary">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to journal
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
