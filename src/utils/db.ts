import * as dotenv from 'dotenv'
dotenv.config()

import * as bluebird from 'bluebird'
import * as  mysql from 'mysql'
const connection = bluebird.promisifyAll(mysql.createPool({
  connectionLimit: parseInt(process.env.JIBLA_MYSQL_CONNECTION_LIMIT, 10),
  host: process.env.JIBLA_MYSQL_HOST,
  user: process.env.JIBLA_MYSQL_USERNAME,
  password: process.env.JIBLA_MYSQL_PASSWORD,
  database: process.env.JIBLA_MYSQL_DATABASE,
  supportBigNumbers: true,
}))


export let query = (sql, args) => {
  return new Promise((resolve, reject) => {
    connection.query(sql, args, (error, rows) => {
      if (error) {
        return reject(error)
      }
      resolve(rows)
    })
  })
}

export let close = () => {
  return new Promise((resolve, reject) => {
    connection.end(error => {
      if (error) {
        return reject(error)
      }
      resolve()
    })
  })
}