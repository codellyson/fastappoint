import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import env from '#start/env'
import Subscription from '#models/subscription'
import Business from '#models/business'
import emailService from '#services/email-service'

export default class MonitorSubscriptions extends BaseCommand {
  static commandName = 'subscriptions:monitor'
  static description = 'Monitor subscriptions for expiration, renewals, and send reminders'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Starting subscription monitoring...')

    const now = DateTime.now()

    // 1. Check for expired trials
    await this.handleExpiredTrials(now)

    // 2. Check for expired subscriptions
    await this.handleExpiredSubscriptions(now)

    // 3. Send renewal reminders (3 days before expiration)
    await this.sendRenewalReminders(now)

    // 4. Check for subscriptions expiring soon (1 day before)
    await this.handleExpiringSoon(now)

    this.logger.info('Subscription monitoring completed')
  }

  private async handleExpiredTrials(now: DateTime) {
    const expiredTrials = await Subscription.query()
      .where('status', 'trialing')
      .whereNotNull('trialEndsAt')
      .where('trialEndsAt', '<', now.toSQL()!)
      .preload('business')

    this.logger.info(`Found ${expiredTrials.length} expired trials`)

    for (const subscription of expiredTrials) {
      // Update business subscription status
      const business = await Business.find(subscription.businessId)
      if (business) {
        business.subscriptionStatus = 'cancelled'
        business.subscriptionEndsAt = subscription.trialEndsAt
        await business.save()

        this.logger.info(`Marked trial as expired for business ${business.id} (${business.name})`)

        // Send email notification
        try {
          await emailService.send({
            to: business.email,
            subject: 'Your Free Trial Has Ended',
            html: this.getTrialExpiredEmail(business.name),
          })
        } catch (error) {
          this.logger.error(`Failed to send trial expired email to ${business.email}:`, error)
        }
      }
    }
  }

  private async handleExpiredSubscriptions(now: DateTime) {
    const expiredSubscriptions = await Subscription.query()
      .where('status', 'active')
      .whereNotNull('currentPeriodEnd')
      .where('currentPeriodEnd', '<', now.toSQL()!)
      .preload('business')
      .preload('plan')

    this.logger.info(`Found ${expiredSubscriptions.length} expired subscriptions`)

    for (const subscription of expiredSubscriptions) {
      // Update subscription status
      subscription.status = 'cancelled'
      await subscription.save()

      // Update business
      const business = await Business.find(subscription.businessId)
      if (business) {
        business.subscriptionStatus = 'cancelled'
        business.subscriptionEndsAt = subscription.currentPeriodEnd
        await business.save()

        this.logger.info(`Marked subscription as expired for business ${business.id} (${business.name})`)

        // Send email notification
        try {
          await emailService.send({
            to: business.email,
            subject: 'Your Subscription Has Expired',
            html: this.getSubscriptionExpiredEmail(
              business.name,
              subscription.plan?.displayName || 'your plan'
            ),
          })
        } catch (error) {
          this.logger.error(`Failed to send expiration email to ${business.email}:`, error)
        }
      }
    }
  }

  private async sendRenewalReminders(now: DateTime) {
    const threeDaysFromNow = now.plus({ days: 3 })
    const subscriptionsNeedingReminder = await Subscription.query()
      .where('status', 'active')
      .whereNotNull('currentPeriodEnd')
      .whereBetween('currentPeriodEnd', [now.toSQL()!, threeDaysFromNow.toSQL()!])
      .preload('business')
      .preload('plan')

    this.logger.info(`Found ${subscriptionsNeedingReminder.length} subscriptions needing renewal reminder`)

    for (const subscription of subscriptionsNeedingReminder) {
      const business = subscription.business
      const daysUntilExpiry = Math.ceil(subscription.currentPeriodEnd!.diffNow('days').days)

      try {
        await emailService.send({
          to: business.email,
          subject: `Your Subscription Renews in ${daysUntilExpiry} Days`,
          html: this.getRenewalReminderEmail(
            business.name,
            subscription.plan?.displayName || 'your plan',
            subscription.currentPeriodEnd!,
            daysUntilExpiry
          ),
        })

        this.logger.info(`Sent renewal reminder to ${business.email}`)
      } catch (error) {
        this.logger.error(`Failed to send renewal reminder to ${business.email}:`, error)
      }
    }
  }

  private async handleExpiringSoon(now: DateTime) {
    const oneDayFromNow = now.plus({ days: 1 })
    const expiringSoon = await Subscription.query()
      .where('status', 'active')
      .whereNotNull('currentPeriodEnd')
      .whereBetween('currentPeriodEnd', [now.toSQL()!, oneDayFromNow.toSQL()!])
      .preload('business')
      .preload('plan')

    this.logger.info(`Found ${expiringSoon.length} subscriptions expiring within 24 hours`)

    for (const subscription of expiringSoon) {
      const business = subscription.business

      try {
        await emailService.send({
          to: business.email,
          subject: 'Your Subscription Expires Tomorrow',
          html: this.getExpiringSoonEmail(
            business.name,
            subscription.plan?.displayName || 'your plan',
            subscription.currentPeriodEnd!
          ),
        })

        this.logger.info(`Sent expiration warning to ${business.email}`)
      } catch (error) {
        this.logger.error(`Failed to send expiration warning to ${business.email}:`, error)
      }
    }
  }

  private getTrialExpiredEmail(businessName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #5A45FF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #5A45FF; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Free Trial Has Ended</h1>
          </div>
          <div class="content">
            <p>Hi ${businessName},</p>
            <p>Your 5-day free trial has ended. To continue using FastAppoint and keep your booking page active, please choose a subscription plan.</p>
            <p>All your data and settings are safe - simply choose a plan to reactivate your account.</p>
            <a href="${env.get('APP_URL', 'https://fastappoint.com')}/subscriptions/select" class="button">Choose a Plan</a>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private getSubscriptionExpiredEmail(businessName: string, planName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #5A45FF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #5A45FF; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Expired</h1>
          </div>
          <div class="content">
            <p>Hi ${businessName},</p>
            <p>Your ${planName} subscription has expired. To continue using FastAppoint, please renew your subscription.</p>
            <a href="${env.get('APP_URL', 'https://fastappoint.com')}/subscriptions/manage" class="button">Renew Subscription</a>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private getRenewalReminderEmail(
    businessName: string,
    planName: string,
    renewalDate: DateTime,
    daysRemaining: number
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #5A45FF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #5A45FF; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Renewal Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${businessName},</p>
            <p>Your ${planName} subscription will renew in ${daysRemaining} days (${renewalDate.toFormat('MMMM d, yyyy')}).</p>
            <p>Your subscription will automatically renew. If you need to make any changes, you can manage your subscription below.</p>
            <a href="${env.get('APP_URL', 'https://fastappoint.com')}/subscriptions/manage" class="button">Manage Subscription</a>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  private getExpiringSoonEmail(businessName: string, planName: string, expiryDate: DateTime): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #5A45FF; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Expiring Tomorrow</h1>
          </div>
          <div class="content">
            <p>Hi ${businessName},</p>
            <p><strong>Important:</strong> Your ${planName} subscription expires tomorrow (${expiryDate.toFormat('MMMM d, yyyy')}).</p>
            <p>To avoid service interruption, please renew your subscription now.</p>
            <a href="${env.get('APP_URL', 'https://fastappoint.com')}/subscriptions/manage" class="button">Renew Now</a>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}
