import type { HttpContext } from '@adonisjs/core/http'

interface BlogPost {
  slug: string
  title: string
  excerpt: string
  category: string
  publishedAt: string
  readTime: string
  image: string
  featured?: boolean
}

export default class BlogController {
  private posts: BlogPost[] = [
    {
      slug: 'fastappoint-vs-calendly',
      title: 'FastAppoint vs Calendly: Why Nigerian Businesses Are Making the Switch',
      excerpt:
        'Calendly is great for meetings, but service businesses need more. Discover why FastAppoint is the better choice for salons, photographers, and local service providers.',
      category: 'Comparison',
      publishedAt: '2025-01-05',
      readTime: '8 min read',
      image:
        'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=400&fit=crop&q=80',
      featured: true,
    },
    {
      slug: 'fastappoint-vs-acuity-scheduling',
      title: 'FastAppoint vs Acuity Scheduling: The Complete Comparison for Service Businesses',
      excerpt:
        'Acuity Scheduling is popular, but is it right for your business? Compare features, pricing, and discover which platform delivers more value.',
      category: 'Comparison',
      publishedAt: '2025-01-04',
      readTime: '10 min read',
      image:
        'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=400&fit=crop&q=80',
    },
    {
      slug: 'fastappoint-vs-square-appointments',
      title: 'FastAppoint vs Square Appointments: Which Is Better for Your Business?',
      excerpt:
        'Square is known for payments, but how does Square Appointments stack up against FastAppoint for booking management? A detailed comparison.',
      category: 'Comparison',
      publishedAt: '2025-01-03',
      readTime: '9 min read',
      image:
        'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop&q=80',
    },
    {
      slug: 'fastappoint-vs-booksy',
      title: 'FastAppoint vs Booksy: The Ultimate Showdown for Beauty & Wellness Professionals',
      excerpt:
        "Booksy targets beauty professionals, but does it deliver? See why many salon owners prefer FastAppoint's simpler, more affordable approach.",
      category: 'Comparison',
      publishedAt: '2025-01-02',
      readTime: '8 min read',
      image:
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=400&fit=crop&q=80',
    },
    {
      slug: 'fastappoint-vs-fresha',
      title: "FastAppoint vs Fresha: Why 'Free' Isn't Always Better",
      excerpt:
        "Fresha advertises as free, but hidden costs add up. Learn the true cost of booking software and why transparent pricing matters.",
      category: 'Comparison',
      publishedAt: '2025-01-01',
      readTime: '7 min read',
      image:
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=400&fit=crop&q=80',
    },
    {
      slug: 'fastappoint-vs-simplybook',
      title: 'FastAppoint vs SimplyBook.me: Simplicity vs Complexity',
      excerpt:
        'SimplyBook.me offers 50+ features, but do you need them all? Discover why focused simplicity often beats feature overload.',
      category: 'Comparison',
      publishedAt: '2024-12-28',
      readTime: '8 min read',
      image:
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop&q=80',
    },
    {
      slug: 'fastappoint-vs-setmore',
      title: 'FastAppoint vs Setmore: Which Booking Platform Delivers More Value?',
      excerpt:
        "Setmore has a free tier, but what do you sacrifice? Compare the real value proposition of both platforms.",
      category: 'Comparison',
      publishedAt: '2024-12-25',
      readTime: '7 min read',
      image:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop&q=80',
    },
    {
      slug: 'why-fastappoint-for-nigerian-businesses',
      title: 'Why FastAppoint is the Best Booking Platform for Nigerian Businesses',
      excerpt:
        'Built for Africa, priced for Africa. Discover why FastAppoint is the go-to booking solution for Nigerian service businesses.',
      category: 'Guide',
      publishedAt: '2024-12-20',
      readTime: '12 min read',
      image:
        'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=400&fit=crop&q=80',
      featured: true,
    },
    {
      slug: 'best-booking-software-2025',
      title: 'Best Booking Software for Service Businesses in 2025: A Complete Guide',
      excerpt:
        'Not sure which booking software to choose? This comprehensive guide compares all major platforms to help you make the right decision.',
      category: 'Guide',
      publishedAt: '2024-12-15',
      readTime: '15 min read',
      image:
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop&q=80',
      featured: true,
    },
    {
      slug: 'hidden-costs-booking-software',
      title: 'The Hidden Costs of "Free" Booking Software: What They Don\'t Tell You',
      excerpt:
        'Free booking software sounds great until you see the transaction fees. Learn how to calculate the true cost of booking platforms.',
      category: 'Guide',
      publishedAt: '2024-12-10',
      readTime: '6 min read',
      image:
        'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=400&fit=crop&q=80',
    },
  ]

  async index({ view }: HttpContext) {
    const featuredPosts = this.posts.filter((post) => post.featured)
    const recentPosts = this.posts.filter((post) => !post.featured)

    return view.render('pages/blog/index', {
      title: 'Blog - FastAppoint',
      featuredPosts,
      recentPosts,
      allPosts: this.posts,
    })
  }

  async show({ view, params, response }: HttpContext) {
    const post = this.posts.find((p) => p.slug === params.slug)

    if (!post) {
      return response.redirect().toRoute('blog.index')
    }

    // Get related posts (same category, different slug)
    const relatedPosts = this.posts
      .filter((p) => p.category === post.category && p.slug !== post.slug)
      .slice(0, 3)

    return view.render(`pages/blog/${params.slug}`, {
      title: `${post.title} - FastAppoint Blog`,
      post,
      relatedPosts,
    })
  }
}
