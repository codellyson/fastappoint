import edge from 'edge.js'
import { migrate } from 'edge.js/plugins/migrate'
import env from '#start/env'
import { DateTime } from 'luxon'

edge.use(migrate)

edge.global('isDev', env.get('NODE_ENV') === 'development')
edge.global('DateTime', DateTime)
edge.global('appName', 'BookMe')
