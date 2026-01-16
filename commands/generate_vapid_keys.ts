import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import pushNotificationService from '#services/push_notification_service'

export default class GenerateVapidKeys extends BaseCommand {
  static commandName = 'generate:vapid'
  static description = 'Generate VAPID keys for push notifications'

  static options: CommandOptions = {
    startApp: false,
  }

  async run() {
    this.logger.info('Generating VAPID keys...')

    const vapidKeys = pushNotificationService.generateVapidKeys()

    this.logger.success('VAPID keys generated successfully!')
    this.logger.info('')
    this.logger.info('Add these to your .env file:')
    this.logger.info('')
    this.logger.info(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
    this.logger.info(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
    this.logger.info(`VAPID_SUBJECT=mailto:support@fastappoint.com`)
    this.logger.info('')
    this.logger.warning('Keep the private key secret!')
  }
}
