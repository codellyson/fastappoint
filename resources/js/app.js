import 'htmx.org'
import Alpine from 'alpinejs'

function formatPhoneNumber(phone) {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('234')) {
    return `+${cleaned}`
  }
  if (cleaned.startsWith('0')) {
    return `+234${cleaned.substring(1)}`
  }
  return `+234${cleaned}`
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(amount)
}

function appState() {
  return {
    toast: {
      show: false,
      message: '',
      type: 'success'
    },
    balanceVisible: true,
    loading: false,
    init() {
      window.showToast = (message, type = 'success') => {
        this.toast.message = message
        this.toast.type = type
        this.toast.show = true
        setTimeout(() => {
          this.toast.show = false
        }, 3000)
      }
      window.formatCurrency = formatCurrency
      window.formatPhoneNumber = formatPhoneNumber
    },
    async copyToClipboard(text, label) {
      try {
        await navigator.clipboard.writeText(text)
        window.showToast(`${label} copied!`, 'success')
      } catch (err) {
        window.showToast('Failed to copy', 'error')
      }
    },
    formatCurrency,
    formatPhoneNumber
  }
}

Alpine.data('appState', appState)
Alpine.start()
