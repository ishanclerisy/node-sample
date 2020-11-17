import * as AWS from 'aws-sdk'
import * as bcrypt from 'bcrypt-nodejs'
import * as bluebird from 'bluebird'
import * as fs from 'fs'
import * as gm from 'gm'
import { getLogger } from 'log4js'
import * as moment from 'moment'
import * as mongodb from 'mongodb'
import * as uuid from 'node-uuid'
import * as nodemailer from 'nodemailer'
import * as path from 'path'
import * as Redis from 'redis'
import * as util from 'util'
import * as DB from './db'

/**
 * Connections and bindings for helper functions
 */
const logger = getLogger()
logger.level = 'debug'
const basePath = '/v2'
const baseURL = process.env.JIBLA_BASEURL + basePath
const keys = {
  resetPassword: 'resetPassword:%s',
  verifyEmail: 'verifyEmail:%s',
  resetCooldown: 'resetCooldown:%s',
}
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.JIBLA_EMAIL,
    pass: process.env.JIBLA_EMAIL_PASSWORD,
  },
})
const redis = Redis.createClient(process.env.JIBLA_REDIS_PORT, process.env.JIBLA_REDIS_HOST, {
  detect_buffers: true,
})
const MongoClient = bluebird.promisifyAll(
  mongodb.MongoClient
)
const imageMagick = gm.subClass({ imageMagick: true })
const s3 = new AWS.S3({
  accessKeyId: process.env.JIBLA_S3_ACCESS_KEY,
  secretAccessKey: process.env.JIBLA_S3_SECRET_ACCESS_KEY,
  region: process.env.JIBLA_S3_REGION
})

let mongoDB
MongoClient.connect(
  process.env.JIBLA_CLOUDSTORE_CONN,
  (err, database) => {
    if (err) {
      throw err
    }
    mongoDB = database
  }
)

const profilePicThumbPath = 'amit-endpoints/uploads/thumb/'

/**
 * Insert user's data during signup
 * @param data 
 */
export let insertUserData = async (data) => {
  try {
    return await DB.query(
      'INSERT INTO users SET ?', [data]
    )
  } catch (error) {
    logger.error('SQL Error while inserting users------------------>', error)
    return null
  }
}

/**
 * Send verification link to user's email
 * @param email 
 */
export let sendVerificationEmail = (email) => {
  return new Promise((resolve, reject) => {
    const token = uuid.v4()
    const link = baseURL + '/auth/verify?token=' + token
    redis.set(util.format(keys.verifyEmail, token), email)
    redis.expire(util.format(keys.verifyEmail, token), 86400)

    const mailOptions = {
      from: process.env.JIBLA_MAIL_FROM,
      replyTo: process.env.JIBLA_MAIL_REPLY_TO,
      to: email,
      subject: 'Verify your KSE account',
      text: 'Hello.  \n\n  Please verify your e-mail by clicking the link below:  \n\n' + link,
      html: '<b>Hello</b><br><br>Please verify your e-mail by <a href=' + link + '>clicking this link</a><p>Jibla tech</p>'
    }

    transporter.sendMail(mailOptions, (error, response) => {
      if (error) {
        logger.error('Error in sending verification link email: ', error)
        reject(error)
      } else {
        logger.info('Message sent successfully: ' + response.response)
        resolve(response.response)
      }
    })
  })
}

/**
 * Return productId based on bundleId
 * @param bundleId 
 */
export let getProductIDforBundle = (bundleId) => {
  let productId
  switch (bundleId) {
    case 'com.jiblatech.tadawul':
      productId = 17
      break

    default:
      productId = 34
      break
  }
  return productId
}

/**
 * Insert user's subscription data
 * @param data 
 */
export let insertUserSubscriptionData = async (data) => {
  try {
    return await DB.query(
      'INSERT INTO subscriptions SET ?', [data]
    )
  } catch (error) {
    logger.error('SQL Error while inserting subscriptions------------------>', error)
    return null
  }
}

/**
 * Insert an entry into access-logs
 * @param data 
 */
export let insertDataIntoAccessLogs = async (data) => {
  try {
    const collection = await mongoDB.collection('access-log')
    return await collection.insertOne(data)
  } catch (error) {
    logger.error('Mongo Error while inserting access-logs------------------>', error)
    return null
  }
}

export let insertProductRecord = async ( data ) => {
  try {
    const collection = await mongoDB.collection('products')
    return await collection.insertMany(data)
  } catch (error) {
    logger.error('Mongo Error while inserting prodcuts------------------>', error)
    return null
  }
}

/**
 * Get only user's active subscriptions
 * @param id 
 */
export let getActiveSubscriptions = async (id) => {
  try {
    return await DB.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND end > ?',
      [id, moment().format('YYYY-MM-DD')]
    )
  } catch (error) {
    logger.error('SQL Error while getting active subscriptions------------>', error)
    return null
  }
}

/**
 * Get user's all subscriptions
 * @param id 
 */
export let getAllSubscriptions = async (id) => {
  try {
    return await DB.query(
      'SELECT * FROM subscriptions WHERE user_id = ? ',
      [id]
    )
  } catch (error) {
    logger.error('SQL Error while getting all subscriptions------------>', error)
    return null
  }
}

/**
 * Delete user's transactions
 * @param id 
 */
export let deleteUsertransaction = async (id) => {
  try {
     await DB.query(
      'DELETE FROM transactions WHERE id IN (SELECT transaction_id FROM subscriptions WHERE user_id = ?) ',
      [id] 
    )
    return true
  } catch (error) {
    logger.error('SQL Error while deleting users transactions------------>', error)
    return null
  }
}

/**
 * Deleting user's all subscriptions
 * @param id 
 */
export let deleteUserSubscriptions = async (id) => {
  try {
     await DB.query(
      'DELETE FROM subscriptions WHERE user_id = ? ',
      [id] 
    )
    return true
  } catch (error) {
    logger.error('SQL Error while deleting users subscriptions------------>', error)
    return null
  }
}


/**
 * Return user's email from redis using token and email/password keys
 * @param key 
 * @param token 
 */
export let verifyUserUsingRedis = async (key, token) => {
  try {
    return await getUserFromRedis(key, token).then((email) => {
      return email
    }, (error) => {
      return 'error'
    })
  } catch (error) {
    logger.error('Error while getting user email from redis------------>', error)
    return null
  }
}

function getUserFromRedis(key, token) {
  return new Promise((resolve, reject) => {
    redis.get(util.format(getKeyForRedis(key), token), (error, email) => {
      if (error) {
        return reject('error')
      } else {
        return resolve(email)
      }
    })
  })
}

/**
 * Set user'status to Verified
 * @param id 
 */
export let verifyUserStatus = async (id) => {
  try {
    return await DB.query(
      'UPDATE users SET status = "verified" WHERE id = ?',
      [id]
    )
  } catch (error) {
    logger.error('SQL Error while verifying user------------>', error)
    return null
  }
}

/**
 * Remove token keys from redis
 * @param key 
 * @param token 
 */
export let cleanRedis = async (key, token) => {
  return await redis.del(util.format(getKeyForRedis(key), token))
}

/**
 * Update user's password
 * @param username 
 * @param password 
 */
export let changePassword = async (username, password) => {
  try {
    const hash = bcrypt.hashSync(password)
    return await DB.query(
      'UPDATE users SET password = ? WHERE username = ?', [hash, username]
    )
  } catch (error) {
    logger.error('SQL Error while changing user password------------>', error)
    return null
  }
}

/**
 * Send password changed successfully mail to user
 * @param email 
 * @param username 
 */
export let sendPasswordChangeSuccessEmail = (email, username) => {
  const mailOptions = {
    from: process.env.JIBLA_MAIL_FROM,
    replyTo: process.env.JIBLA_MAIL_REPLY_TO,
    to: email,
    subject: 'Password change successful',
    text:
      'Hello ' + username + '  \n\n  Your password has been changed successfully.  \n\n Jibla tech.',
    html:
      'Hello <b>' + username + '</b><br><br>Your password has been changed successfully.<br> <p>Jibla tech</p>'
  }
  transporter.sendMail(mailOptions, (error, response) => {
    if (error) {
      logger.error('Error in sending password changed email :', error)
    } else {
      logger.info('Message sent successfully: ' + response.response)
    }
  })
}

/**
 * Get user detail using id, email and username
 * @param key 
 * @param value 
 */
export let getUserInfo = async (key, value) => {
  try {
    let query
    switch (key) {
      case 'username':
        query = 'SELECT * FROM users WHERE username = ?'
        break

      case 'email':
        query = 'SELECT * FROM users WHERE email = ?'
        break

      case 'id':
        query = 'SELECT * FROM users WHERE id = ? LIMIT 1'
        break

      default:
        break
    }
    return await DB.query(
      query, [value]
    )
  } catch (error) {
    logger.error('SQL Error while getting user data------------>', error)
    return null
  }
}

/**
 * Return key for redis using email or password
 * @param key 
 */
const getKeyForRedis = (key) => {
  let query
  switch (key) {
    case 'email':
      query = keys.verifyEmail
      break
    case 'password':
      query = keys.resetPassword
      break
    default:
      break
  }
  return query
}

/**
 * Send password reset email to user
 * @param email 
 * @param username 
 */
export let sendPasswordResetEmail = (email, username) => {
  return new Promise((resolve, reject) => {
    const token = uuid.v4()
    const link = baseURL + '/auth/resetPassword?token=' + token
    redis.set(util.format(keys.resetPassword, token), email)
    redis.expire(util.format(keys.resetPassword, token), 86400)

    const mailOptions = {
      from: process.env.JIBLA_MAIL_FROM,
      replyTo: process.env.JIBLA_MAIL_REPLY_TO,
      to: email,
      subject: "Reset your KSE password",
      text:
        "Hello " + username + "  \n\n  Someone requested a password reset.  If this is not you, please ignore this e-mail.\n\nIf this was you, please click  \n\n" +
        link,
      html:
        "Hello <b>" + username + "</b><br><br>Someone requested a password reset.  If this is not you, please ignore this e-mail.   <br> If this was you, <a href=" +
        link + ">click here</a> to reset your password.<p>Jibla tech</p>"
    }

    transporter.sendMail(mailOptions, (error, response) => {
      if (error) {
        logger.error('Error in sending password reset email: ', error)
        reject(error)
      } else {
        logger.info('Message sent successfully: ' + response.response)
        resolve(response.response)
      }
    })
  })
}

/**
 * Get all jibla products
 */
export let getAllJiblaProducts = async () => {
  try {
    const collection = await mongoDB.collection('products').find({})
    return await collection.toArray()
  } catch (error) {
    logger.error('Mongo Error while getting jibla all products------------>', error)
    return null
  }
}

/**
 * Get jibla products using available market and version
 * @param market 
 * @param version 
 */
export let getJiblaProducts = async (market, version) => {
  try {
    const collection = await mongoDB.collection('products').find({
      available: true,
      market,
      version: Number(version)
    })
    return await collection.toArray()
  } catch (error) {
    logger.error('Mongo Error while getting jibla products---------------->', error)
    return null
  }
}

/**
 * Remove invalid file from tmp
 * @param file 
 */
export let unlinkinvalidImageFile = (file) => {
  fs.unlinkSync(path.join(file.path))
}

/**
 * Used to upload user image to S3
 * @param file 
 * @param id 
 */
export let uploadProfilePictoBucket = (req, id) => {
  return new Promise((resolve, reject) => {
    const file = req.file
    let bucketPath = ''
    switch (req.body.purpose) {
      case 'profile_pic':
        bucketPath = 'jibla-users-profile/org'
        break
      case 'pdf_document':
        bucketPath = 'jibla-pdf-document'
        break
      case 'user_files_upload':
        bucketPath = 'jibla-users-files'
        break

      default:
        break
    }
    const fileName = file.originalname.split('.').join('_' + moment().format('x') + '.')
    let params = {
      Bucket: bucketPath,
      Key: fileName,
      Body: fs.readFileSync(path.join(file.path)),
      ContentType: file.mimetype,
      ACL: 'public-read'
    }
    s3.upload(params, (error) => {
      if (error) {
        logger.error('Error while uploading image------------>', error)
        reject(error)
      } else {
        if (req.body.purpose !== 'profile_pic') {
          resolve({
            msg: 'Uploaded successfully'
          })
        } else {
          if (!fs.existsSync(path.join(profilePicThumbPath))) {
            fs.mkdirSync(path.join(profilePicThumbPath))
          }
          const thumbPath = path.join(profilePicThumbPath + fileName)
          imageMagick(fs.readFileSync(path.join(file.path)))
          .resize('200', '200', '!')
          .write(thumbPath, (err) => {
            if (err) {
              logger.error('Error while creating thumb------------>', err)
              reject(err)
            } else {
              params = {
                Bucket: 'jibla-users-profile/thumb',
                Key: fileName,
                Body: fs.readFileSync(thumbPath),
                ContentType: file.mimetype,
                ACL: 'public-read'
              }
              s3.upload(params, (errr) => {
                if (errr) {
                  logger.error('Error while uploading thumb------------>', err)
                  reject(errr)
                } else {
                  fs.unlinkSync(thumbPath)
                  fs.unlinkSync(path.join(file.path))
                  DB.query(
                    'UPDATE users SET image = ? WHERE id = ?', [fileName, id]
                  ).then(() => {
                    resolve({
                      image_thumb: process.env.JIBLA_USER_THUMB_BASEURL + fileName,
                      image_org: process.env.JIBLA_USER_PROFILE_BASEURL + fileName
                    })
                  }).catch((er) => {
                    logger.error('Error while updating image------------>', er)
                    reject(er)
                  })
                }
              })
            }
          })
        }
      }
    })
  })
}

/**
 * Get products using mysql
 */
export let getProductsFromSql = async () => {
  try {
    return await DB.query(
      'SELECT * FROM products', []
    )
  } catch (error) {
    logger.error('SQL Error while getting products ------------>', error)
    return null
  }
}

/**
 * Get user's transactions
 * @param id 
 */
export let getUserTransactions = async (id) => {
  try {
    return await DB.query(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY last_update DESC LIMIT 10', [id]
    )
  } catch (error) {
    logger.error('SQL Error while getting transactions ------------>', error)
    return null
  }
}

/**
 * Get user's alerts
 * @param elem 
 * @param id 
 * @param offset 
 * @param limit 
 */
export let getAllAlerts = async (id, offset, limit) => {
  try {
    const collection = await mongoDB.collection('alerts').find({
      userID: id
    }).limit(limit).skip(offset * limit).sort({'updatedAt': -1})
    return await collection.toArray()
  } catch (error) {
    logger.error('Mongo Error while getting alerts ---------------->', error)
    return null
  }
}

/**
 * Get user's portfolios
 * @param elem 
 * @param id 
 * @param offset 
 * @param limit 
 */
export let getAllPortfolios = async (id, offset, limit) => {
  try {
    const collection = await mongoDB.collection('portfolios').find({
      userID: id
    }).limit(limit).skip(offset * limit)
    return await collection.toArray()
  } catch (error) {
    logger.error('Mongo Error while getting portfolios ---------------->', error)
    return null
  }
}

/**
 * Insert alert or portfolio in MongoDB
 * @param elem 
 * @param data 
 */
export let createAlertPortfolio = async (elem, data) => {
  try {
    const collection = await mongoDB.collection(elem)
    return await collection.insert(data)
  } catch (error) {
    logger.error('Mongo Error while creating ' + elem + '---------------->', error)
    return null
  }
}

/**
 * Get a particular alert or portfolio info
 * @param elem 
 * @param id 
 */
export let getAlertPortfolio = async (elem, id) => {
  try {
    const collection = await mongoDB.collection(elem).find({
      _id: new mongodb.ObjectId(id)
    })
    return await collection.toArray()
  } catch (error) {
    logger.error('Mongo Error while getting ' + elem + '---------------->', error)
    return null
  }
}

/**
 * Delete an alert or portfolio
 * @param elem 
 * @param id 
 */
export let deleteAlertPortfolio = async (elem, id) => {
  try {
    const collection = await mongoDB.collection(elem)
    const response = await collection.remove({
      _id: new mongodb.ObjectId(id)
    })
    return response
  } catch (error) {
    logger.error('Mongo Error while deleting ' + elem + '---------------->', error)
    return null
  }
}

/**
 * Updating an existing alert
 * @param elem 
 * @param id 
 * @param data 
 */
export let updateAlert = async (id, data) => {
  try {
    const collection = await mongoDB.collection('alerts')
    const response = await collection.updateOne(
      { _id: new mongodb.ObjectId(id) },
      { $set: data },
      { upsert: true }
    )
    return response
  } catch (error) {
    logger.error('Mongo Error while updating alerts---------------->', error)
    return null
  }
}

/**
 * Updating an existing portfolio
 * @param elem 
 * @param id 
 * @param data 
 */
export let updatePortfolio = async (id, data) => {
  try {
    const collection = await mongoDB.collection('portfolios')
    const response = await collection.updateOne(
      { _id: new mongodb.ObjectId(id) },
      data,
      { upsert: true }
    )
    return response
  } catch (error) {
    logger.error('Mongo Error while updating portfolios---------------->', error)
    return null
  }
}

/**
 * Check whether a portfolio exists or not 
 * @param params 
 */
export let checkPortfolio = async (params) => {
  try {
    let query
    query = { name: params.name, userID: params.userID }
    if (params.id) {
      query._id = new mongodb.ObjectID(params.id)
    }
    const collection = await mongoDB.collection('portfolios')
    return await collection.findOne(query)
  } catch (error) {
    logger.error('Mongo Error while checking portfolio---------------->', error)
    return null
  }
}

/**
 * Get product details
 * @param id
 */
export let getProductDetails = async (id) => {
  try {
    const productGroup = await mongoDB.collection("products").findOne(
      {
        language: 'en',
        'products.id': Number(id)
      },
      {
        'products.$': 1
      }
    )
    return productGroup
  } catch (error) {
    logger.error('Mongo Error while getting product---------------->', error)
    return null
  }
}

/**
 * Remove old profile images from bucket
 * @param file
 */
export let removeOldImagesFromBucket = async (file) => {
  removeFileFromBucket('jibla-users-profile/org', file)
  removeFileFromBucket('jibla-users-profile/thumb', file)
}

/**
 * Remove a file from bucket
 * @param bucket
 * @param file
 */
async function removeFileFromBucket(bucket, file) {
  s3.deleteObject({
    Bucket: bucket,
    Key: file
  },(err,data) => {
    if (err) {
      console.log('Error while deleting ', file, ' from bucket ', bucket, '-------->', err)
    }
  })
}