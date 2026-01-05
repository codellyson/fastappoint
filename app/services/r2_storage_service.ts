import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

class R2StorageService {
  private client: S3Client | null = null
  private bucketName: string
  private publicUrl: string | null = null

  constructor() {
    const accountId = env.get('R2_ACCOUNT_ID')
    const accessKeyId = env.get('R2_ACCESS_KEY_ID')
    const secretAccessKey = env.get('R2_SECRET_ACCESS_KEY')
    this.bucketName = env.get('R2_BUCKET_NAME', '')
    this.publicUrl = env.get('R2_PUBLIC_URL', '')

    if (accountId && accessKeyId && secretAccessKey && this.bucketName) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    }
  }

  isConfigured(): boolean {
    return this.client !== null
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error('R2 storage is not configured')
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      })

      await this.client.send(command)

      if (this.publicUrl) {
        return `${this.publicUrl}/${key}`
      }

      return key
    } catch (error) {
      logger.error({ err: error }, 'Failed to upload file to R2')
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) {
      throw new Error('R2 storage is not configured')
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })

      await this.client.send(command)
    } catch (error) {
      logger.error({ err: error }, 'Failed to delete file from R2')
      throw error
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.client) {
      throw new Error('R2 storage is not configured')
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })

      return await getSignedUrl(this.client, command, { expiresIn })
    } catch (error) {
      logger.error({ err: error }, 'Failed to generate signed URL from R2')
      throw error
    }
  }

  getPublicUrl(key: string): string | null {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`
    }
    return null
  }

  extractKeyFromUrl(url: string): string {
    if (this.publicUrl && url.startsWith(this.publicUrl)) {
      return url.replace(`${this.publicUrl}/`, '')
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url)
      return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname
    }
    return url
  }

  isR2Url(url: string): boolean {
    if (this.publicUrl && url.startsWith(this.publicUrl)) {
      return true
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url)
      return urlObj.hostname.includes('r2.dev') || urlObj.hostname.includes('cloudflarestorage.com')
    }
    return false
  }
}

export default new R2StorageService()
