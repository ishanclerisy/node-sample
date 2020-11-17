import * as dotenv from 'dotenv'
dotenv.config()

import * as bodyParser from 'body-parser'
import * as cors from 'cors'
import * as express from 'express'
import * as http from 'http'
import { getLogger } from 'log4js'
import * as path from 'path'
import routes from './routes/routes'

const logger = getLogger()
logger.level = 'debug'

const port = process.env.TS_PORT || 5555

const app = express()

app.set('case sensitive routing', false)
app.set('json spaces', 2)
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')
app.use(express.static(path.join(__dirname, 'public')))
app.use(cors())

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use('/', routes)

app.all("*", (req, res) => {
	return res.status(404).send({
        error: {
          message: 'No route found to handle such request.',
          type: 'no_route_found',
        },
    })
})

http.createServer(app).listen(port, function _() {
  logger.info('Listening http on:', this.address().port)
})