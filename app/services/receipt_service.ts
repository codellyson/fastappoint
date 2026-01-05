import { DateTime } from 'luxon'
import Booking from '#models/booking'
import Transaction from '#models/transaction'
import Business from '#models/business'
import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..', '..')
const receiptsDir = join(projectRoot, 'storage', 'receipts')

// Ensure receipts directory exists
if (!existsSync(receiptsDir)) {
  mkdirSync(receiptsDir, { recursive: true })
}

class ReceiptService {
  /**
   * Generate PDF receipt for a successful payment
   */
  async generateReceipt(booking: Booking, transaction: Transaction): Promise<string> {
    // Try to import pdfkit dynamically
    let PDFDocument: any
    try {
      // @ts-ignore - pdfkit may not be installed
      const pdfkit = await import('pdfkit')
      PDFDocument = pdfkit.default
    } catch (error) {
      console.error('[ReceiptService] PDFKit not installed. Run: pnpm add pdfkit @types/pdfkit')
      throw new Error('PDF generation library not available')
    }

    const business = await Business.findOrFail(booking.businessId)

    const receiptNumber = `REC-${transaction.id}-${DateTime.now().toFormat('yyyyMMdd')}`
    const filename = `${receiptNumber}.pdf`
    const filepath = join(receiptsDir, filename)

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      })

      const stream = createWriteStream(filepath)
      doc.pipe(stream)

      // Header
      doc.fontSize(24).text('PAYMENT RECEIPT', { align: 'center' })
      doc.moveDown()

      // Receipt Number
      doc.fontSize(10).fillColor('#666666').text(`Receipt #: ${receiptNumber}`, { align: 'right' })
      doc.text(`Date: ${DateTime.now().toFormat('MMMM d, yyyy')}`, { align: 'right' })
      doc.moveDown()

      // Business Info
      doc.fontSize(14).fillColor('#000000').text(business.name, { align: 'left' })
      if (business.email) {
        doc.fontSize(10).fillColor('#666666').text(`Email: ${business.email}`, { align: 'left' })
      }
      if (business.phone) {
        doc.fontSize(10).fillColor('#666666').text(`Phone: ${business.phone}`, { align: 'left' })
      }
      doc.moveDown(2)

      // Customer Info
      doc.fontSize(12).fillColor('#000000').text('Bill To:', { underline: true })
      doc.fontSize(10).fillColor('#000000').text(booking.customerName)
      doc.text(booking.customerEmail)
      if (booking.customerPhone) {
        doc.text(booking.customerPhone)
      }
      doc.moveDown(2)

      // Booking Details
      doc.fontSize(12).fillColor('#000000').text('Booking Details:', { underline: true })
      doc.fontSize(10).fillColor('#000000')
      doc.text(`Service: ${booking.service.name}`)
      doc.text(`Date: ${booking.date.toFormat('EEEE, MMMM d, yyyy')}`)
      doc.text(`Time: ${booking.startTime} - ${booking.endTime}`)
      doc.moveDown(2)

      // Payment Details
      doc.fontSize(12).fillColor('#000000').text('Payment Details:', { underline: true })
      doc.fontSize(10).fillColor('#000000')

      const tableTop = doc.y
      const itemHeight = 20

      // Table header
      doc.fontSize(10).fillColor('#000000')
      doc.text('Description', 50, tableTop)
      doc.text('Amount', 400, tableTop, { align: 'right' })

      // Table line
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke()

      // Service item
      const serviceY = tableTop + itemHeight
      doc.text(booking.service.name, 50, serviceY)
      doc.text(`₦${transaction.amount.toLocaleString()}`, 400, serviceY, { align: 'right' })

      // Platform fee (if applicable)
      if (transaction.platformFee > 0) {
        const feeY = serviceY + itemHeight
        doc.fillColor('#666666').fontSize(9).text('Platform Fee', 50, feeY)
        doc.text(`₦${transaction.platformFee.toLocaleString()}`, 400, feeY, { align: 'right' })
      }

      // Total
      const totalY = (transaction.platformFee > 0 ? serviceY + itemHeight * 2 : serviceY + itemHeight) + 10
      doc.moveTo(50, totalY - 5).lineTo(550, totalY - 5).stroke()
      doc.fontSize(12).fillColor('#000000').font('Helvetica-Bold')
      doc.text('Total Paid', 50, totalY)
      doc.text(`₦${transaction.amount.toLocaleString()}`, 400, totalY, { align: 'right' })
      doc.font('Helvetica') // Reset font

      doc.moveDown(3)

      // Transaction Reference
      doc.fontSize(10).fillColor('#666666')
      doc.text(`Transaction Reference: ${transaction.reference}`, { align: 'center' })
      if (transaction.providerReference) {
        doc.text(`Payment Provider Reference: ${transaction.providerReference}`, { align: 'center' })
      }
      doc.moveDown(2)

      // Footer
      doc.fontSize(8).fillColor('#999999')
      doc.text('This is an official receipt for your payment.', { align: 'center' })
      doc.text('Please keep this receipt for your records.', { align: 'center' })
      doc.moveDown()
      doc.text(`Generated by FastAppoint on ${DateTime.now().toFormat('MMMM d, yyyy \'at\' h:mm a')}`, {
        align: 'center',
      })

      doc.end()

      stream.on('finish', () => {
        resolve(`/receipts/${filename}`)
      })

      stream.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * Get receipt file path
   */
  getReceiptPath(receiptNumber: string): string {
    return join(receiptsDir, `${receiptNumber}.pdf`)
  }

  /**
   * Check if receipt exists
   */
  receiptExists(receiptNumber: string): boolean {
    return existsSync(this.getReceiptPath(receiptNumber))
  }
}

export default new ReceiptService()

