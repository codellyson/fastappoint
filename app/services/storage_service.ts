import { unlink } from 'node:fs/promises'

import app from '@adonisjs/core/services/app'
import env from '#start/env'
import r2StorageService from './r2_storage_service.js'
import logger from '@adonisjs/core/services/logger'
import { existsSync, readFileSync } from 'node:fs'

class StorageService {
  private r2Enabled: boolean

  constructor() {
    this.r2Enabled = env.get('R2_ENABLED', 'false') === 'true' && r2StorageService.isConfigured()
  }

  async save(
    path: string,
    content: Buffer | Uint8Array | string,
    options?: { contentType?: string; localFallback?: boolean }
  ): Promise<string> {
    if (this.r2Enabled) {
      try {
        const url = await r2StorageService.upload(path, content, options?.contentType)
        return url
      } catch (error) {
        logger.error({ err: error, path }, 'R2 upload failed')
        if (options?.localFallback !== false) {
          logger.info({ path }, 'Falling back to local storage')
          return this.saveLocal(path, content)
        }
        throw error
      }
    }

    return this.saveLocal(path, content)
  }

  private async saveLocal(path: string, content: Buffer | Uint8Array | string): Promise<string> {
    const fullPath = app.publicPath(path)
    const { mkdir } = await import('node:fs/promises')
    const { dirname: dirnamePath } = await import('node:path')

    await mkdir(dirnamePath(fullPath), { recursive: true })

    if (typeof content === 'string') {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(fullPath, content, 'utf-8')
    } else {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(fullPath, content)
    }

    return `/${path}`
  }

  async delete(pathOrUrl: string): Promise<void> {
    if (this.r2Enabled && r2StorageService.isR2Url(pathOrUrl)) {
      try {
        const key = r2StorageService.extractKeyFromUrl(pathOrUrl)
        await r2StorageService.delete(key)
        return
      } catch (error) {
        logger.error({ err: error, path: pathOrUrl }, 'R2 delete failed')
        if (this.isLocalPath(pathOrUrl)) {
          await this.deleteLocal(pathOrUrl)
        }
        throw error
      }
    }

    if (this.isLocalPath(pathOrUrl)) {
      await this.deleteLocal(pathOrUrl)
    }
  }

  private async deleteLocal(path: string): Promise<void> {
    try {
      const fullPath = app.publicPath(path)
      await unlink(fullPath)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }

  async getUrl(
    pathOrUrl: string,
    options?: { signed?: boolean; expiresIn?: number }
  ): Promise<string> {
    if (this.r2Enabled && r2StorageService.isR2Url(pathOrUrl)) {
      if (options?.signed) {
        const key = r2StorageService.extractKeyFromUrl(pathOrUrl)
        return await r2StorageService.getSignedUrl(key, options.expiresIn)
      }
      const publicUrl = r2StorageService.getPublicUrl(r2StorageService.extractKeyFromUrl(pathOrUrl))
      if (publicUrl) {
        return publicUrl
      }
      const key = r2StorageService.extractKeyFromUrl(pathOrUrl)
      return await r2StorageService.getSignedUrl(key, options?.expiresIn)
    }

    return pathOrUrl
  }

  async exists(pathOrUrl: string): Promise<boolean> {
    if (this.r2Enabled && r2StorageService.isR2Url(pathOrUrl)) {
      return true
    }

    if (this.isLocalPath(pathOrUrl)) {
      const fullPath = app.publicPath(pathOrUrl)
      return existsSync(fullPath)
    }

    return false
  }

  async read(pathOrUrl: string): Promise<Buffer> {
    if (this.r2Enabled) {
      if (r2StorageService.isR2Url(pathOrUrl)) {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3')
        const key = r2StorageService.extractKeyFromUrl(pathOrUrl)

        if (!r2StorageService.isConfigured()) {
          throw new Error('R2 storage is not configured')
        }

        const r2Client = (r2StorageService as any).client
        const bucketName = (r2StorageService as any).bucketName

        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        })

        const response = await r2Client.send(command)
        const chunks: Uint8Array[] = []

        if (response.Body) {
          for await (const chunk of response.Body as any) {
            chunks.push(chunk)
          }
        }

        return Buffer.concat(chunks)
      } else if (
        !this.isLocalPath(pathOrUrl) &&
        !pathOrUrl.startsWith('http://') &&
        !pathOrUrl.startsWith('https://')
      ) {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3')

        if (!r2StorageService.isConfigured()) {
          throw new Error('R2 storage is not configured')
        }

        const r2Client = (r2StorageService as any).client
        const bucketName = (r2StorageService as any).bucketName

        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: pathOrUrl,
        })

        const response = await r2Client.send(command)
        const chunks: Uint8Array[] = []

        if (response.Body) {
          for await (const chunk of response.Body as any) {
            chunks.push(chunk)
          }
        }

        return Buffer.concat(chunks)
      }
    }

    if (this.isLocalPath(pathOrUrl)) {
      const fullPath = app.publicPath(pathOrUrl)
      return readFileSync(fullPath)
    }

    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      const response = await fetch(pathOrUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch file from ${pathOrUrl}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }

    throw new Error(`Cannot read file: ${pathOrUrl}`)
  }

  private isLocalPath(path: string): boolean {
    return path.startsWith('/') && !path.startsWith('http://') && !path.startsWith('https://')
  }

  isR2Enabled(): boolean {
    return this.r2Enabled
  }
}

export default new StorageService()
