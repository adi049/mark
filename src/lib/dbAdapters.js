/**
 * Adapters that map Supabase rows onto the shapes the public pages use.
 * The blog pages consume them today; the services and marketing pages
 * keep their built-in presentation and can switch to these without
 * touching their markup.
 */

/** A blogs row to the public post shape. */
export function blogFromDb(row) {
  if (!row) {
    return null
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || '',
    content: row.content || '',
    cover: row.cover_image || null,
    category: row.category || 'Journal',
    publishedAt: row.published_at || row.created_at || null,
  }
}

/** Published blogs, newest first. Returns rows or throws. */
export async function fetchPublishedBlogs(client) {
  const { data, error } = await client
    .from('blogs')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
  if (error) {
    throw error
  }
  return (data ?? []).map(blogFromDb)
}

/** One published blog by slug. Returns the post or null. */
export async function fetchPublishedBlogBySlug(client, slug) {
  const { data, error } = await client
    .from('blogs')
    .select('*')
    .eq('published', true)
    .eq('slug', slug)
    .limit(1)
  if (error) {
    throw error
  }
  return blogFromDb(Array.isArray(data) ? data[0] : null)
}

/** A services row to the public service shape. */
export function serviceFromDb(row) {
  if (!row) {
    return null
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    image: row.image || null,
    price: row.price || '',
    sortOrder: row.sort_order ?? 0,
  }
}

/** Active services in display order. Returns rows or throws. */
export async function fetchActiveServices(client) {
  const { data, error } = await client
    .from('services')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    throw error
  }
  return (data ?? []).map(serviceFromDb)
}

/** A marketing_services row to the public offer shape. */
export function marketingFromDb(row) {
  if (!row) {
    return null
  }
  return {
    id: row.id,
    key: row.key ?? null,
    title: row.title,
    description: row.description || '',
    startingPrice: row.starting_price || '',
    content: row.content || '',
    // Optional fields some rows carry; used when present.
    period: row.period ?? null,
    inclusions: row.inclusions ?? null,
  }
}

/** Active marketing offers in display order. Returns rows or throws. */
export async function fetchActiveMarketing(client) {
  const { data, error } = await client
    .from('marketing_services')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    throw error
  }
  return (data ?? []).map(marketingFromDb)
}
