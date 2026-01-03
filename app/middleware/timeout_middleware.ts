import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'

export default class TimeoutMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options?: { timeout?: number }) {
    const timeoutMs = options?.timeout || env.get('REQUEST_TIMEOUT', 30000)

    let timeoutId: NodeJS.Timeout | null = null
    let isTimedOut = false

    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => {
        isTimedOut = true
        reject(new Error('Request timeout'))
      }, timeoutMs)
    })

    try {
      await Promise.race([
        next().finally(() => {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
        }),
        timeoutPromise,
      ])
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      if (error instanceof Error && error.message === 'Request timeout' && isTimedOut) {
        ctx.logger.warn(`Request timeout after ${timeoutMs}ms: ${ctx.request.url()}`)

        const acceptHeader = ctx.request.header('accept') || ''
        if (acceptHeader.includes('application/json')) {
          return ctx.response.status(408).send({
            error: 'Request Timeout',
            message: 'The request took too long to process. Please try again.',
            timeout: timeoutMs,
          })
        }

        ctx.session.flash('error', 'The request took too long to process. Please try again.')
        return ctx.response.status(408).redirect().back()
      }

      throw error
    }
  }
}

