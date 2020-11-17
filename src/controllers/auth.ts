import * as bcrypt from 'bcrypt-nodejs'
import { validationResult } from 'express-validator/check'
import * as moment from 'moment'
import * as neverbounce from 'neverbounce'
const oauthserver = require('oauth2-server')

import * as helper from '../utils/helper'

/**
 * Connections and bindings
 */
const nb = neverbounce({
  apiKey: process.env.JIBLA_NEVERBOUNCE_API_KEY,
  apiSecret: process.env.JIBLA_NEVERBOUNCE_API_SECRET
})

const oauth = oauthserver({
  model: require('../../../expressOAUTHModel'),
  grants: ['password'],
  debug: true
})

let result: any
let record: any

/**
 * url: //domain.com/v2/auth/register
 * @method: POST
 * @param: req
 * @param: res
 * @returns: JSON(username)
 * Desc: Used to register user
 */
export let signup = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).send({error: errors.array()})
  }
  
  const params = req.body

  result = await helper.getUserInfo('username', params.username)
  if (result && result[0] !== undefined) {
    return res.status(400).send({
      error: {
        message: 'User already exists.',
        type: 'user_exists'
      }
    })
  } else {
    result = await helper.getUserInfo('email', params.email)
    if (result && result[0] !== undefined) {
      return res.status(400).send({
        error: {
          message: 'E-mail is already registered. Please login with that user or e-mail.',
          type: 'email_exists'
        }
      })
    } else {
      result = await nb.single.verify(req.body.email)
      if (result && result.response !== undefined) {
        if ([0, 3, 4].indexOf(result.response.result)) {
          const hash = bcrypt.hashSync(req.body.password)

          record = {
            username: req.body.username,
            password: hash,
            email: req.body.email,
            device: req.body.os ? req.body.os : 'iOS',
            bundleID: req.get('bundleID')
          }

          result = await helper.insertUserData(record)
          if (!result) {
            return res.status(400).send({
              error: {
                message: 'Problem in creating user. Please contact us with a screenshot at executives@jiblatech.com',
                type: 'error_inserting_user_data'
              }
            })
          }

          helper.sendVerificationEmail(req.body.email)

          record = {
            user_id: result.insertId,
            start: moment().toDate(),
            end: moment().add(30, 'days').toDate(),
            product_id: helper.getProductIDforBundle(req.get('bundleID'))
          }

          result = await helper.insertUserSubscriptionData(record)
          if (!result) {
            return res.status(400).send({
              error: {
                message: 'Problem in inserting subscription data. Please contact us with a screenshot at executives@jiblatech.com',
                type: 'error_inserting_subscription_data'
              }
            })
          } else {
            return res.send({
              username: req.body.username
            })
          }
        } else {
          return res.status(400).send({
            error: {
              message: 'Email incorrect: ' + result.getResultTextCode(),
              type: 'incorrect_email'
            }
          })
        }
      }
    }
  }
}

/**
 * url: //domain.com/v2/auth/verify
 * @method: GET
 * @param: req
 * @param: res
 * @returns: Response
 * Desc: Used to verify user
 */
export let verify = async (req, res) => {
  if ( !req.query.token ) {
    return res.status(401).send({
      error: {
        message: 'The link for verification is incorrect.',
        type: 'incorrect_link'
      }
    })
  } else {
    const email = await helper.verifyUserUsingRedis('email',req.query.token)

    if (email && email !== null && email !== 'error') {
      result = await helper.getUserInfo('email', email)
      if (result && result[0] !== undefined) {
        record = await helper.verifyUserStatus(result[0].id)
        if (!record) {
          return res.status(400).send({
            error: {
              message: 'Problem in verifying user. Please contact us with a screenshot at executives@jiblatech.com',
              type: 'error_in_updating_status'
            }
          })
        } else {
          record = await helper.cleanRedis('email',req.query.token)
          return res.send({
            msg: email + ' has been verified!'
          })
        }
      } else {
        return res.status(400).send({
          error: {
            message: 'No user found. Try signing up again.',
            type: 'no_user_found'
          }
        })
      }
    } else {
      return res.status(400).send({
        error: {
          message: 'Verification failed. Maybe the link expired? Try sending another one.',
          type: 'link_expired'
        }
      })
    }
  }
}

/**
 * url: //domain.com/v2/auth/resendVerification
 * @method: GET
 * @param: req
 * @param: res
 * @returns: ok
 * Desc: Used to resend verfication link
 */
export let resendVerificationLink = (req, res) => {
  helper.sendVerificationEmail(req.user.email).then(() => {
    return res.send({
      msg: 'link send to '+ req.user.email
    })
  }, (error) => {
    return res.status(400).send({
      error: {
        message: result.message,
        type: 'error_in_sending_mail'
      }
    })
  })
}

/**
 * url: //domain.com/v2/auth/changePassword
 * @method: POST
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to update user's password
 */
export let changeUsersPassword = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).send({error: errors.array()})
  }

  result = await helper.getUserInfo('id', req.user.id)
  if (result && result[0] !== undefined && bcrypt.compareSync(req.body.oldpassword, result[0].password)) {
    result = await helper.changePassword(req.user.username, req.body.newpassword)
    if (!result) {
      return res.status(400).send({
        error: {
          message: 'Problem changing password. Please contact us with a screenshot at support@jiblatech.com',
          type: 'error_in_changing_password'
        }
      })
    } else {
      oauth.model.invalidateUserTokens(req.user.id)
      helper.sendPasswordChangeSuccessEmail(req.user.email, req.user.username)
      return res.send({
        msg: 'Password has been changed!'
      })
    }
  } else {
    return res.status(400).send({
      error: {
        message: 'Your old password is incorrect.',
        type: 'old_password_incorrect'
      }
    })
  }
}

/**
 * url: //domain.com/v2/auth/resetPassword
 * @method: GET
 * @param: req
 * @param: res
 * @returns: View(Jade)
 * Desc: Used to render reset password form
 */
export let resetPasswordForm = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(401).send({error: errors.array()})
  }

  const email = await helper.verifyUserUsingRedis('password',req.query.token)
  if (email && email !== null && email !== 'error') {
    return res.render('resetPass', {
      title: 'Reset password',
      token: req.query.token
    })
  } else {
    return res.status(400).send({
      error: {
        message: 'Password reset failed. Maybe the link expired? Try sending another one.',
        type: 'link_expired'
      }
    })
  }
}

/**
 * url: //domain.com/v2/auth/resetPassword
 * @method: POST
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to reset user's password
 */
export let resetPassword = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(401).send({error: errors.array()})
  }

  const email = await helper.verifyUserUsingRedis('password',req.body.token)
  if (email && email !== null && email !== 'error') {
    result = await helper.getUserInfo('email',email)
    if (result && result[0] !== undefined) {
      record = await helper.changePassword(result[0].username, req.body.password)
      if (!record) {
        return res.status(400).send({
          error: {
            message: 'Problem changing password. Please contact us with a screenshot at support@jiblatech.com',
            type: 'error_in_changing_password'
          }
        })
      } else {
        oauth.model.invalidateUserTokens(result[0].id)
        record = await helper.cleanRedis('password',req.body.token)
        helper.sendPasswordChangeSuccessEmail(email, result[0].username)
        res.send({
          msg: 'Password has been changed!'
        })
        return next()
      }
    } else {
      return res.status(400).send({
        error: {
          message: 'No user found.',
          type: 'no_user_found'
        }
      })
    }
  } else {
    return res.status(400).send({
      error: {
        message: 'Password changing failed. May be the link expired? Try sending another one.',
        type: 'link_expired'
      }
    })
  }
}

/**
 * url: //domain.com/v2/auth/reset
 * @method: POST
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to send user's password reset mail
 */
export let reset = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).send({error: errors.array()})
  }

  result = await helper.getUserInfo('email', req.body.email)
  if (result && result[0] !== undefined) {
    helper.sendPasswordResetEmail(req.body.email, result[0].username)
    .then((response) => {
      return res.send({
        msg: 'Password reset information send to your e-mail.'
      })
    }, (error) => {
      return res.status(500).send({
        error: {
          message: error,
          type: 'sending_email_error'
        }
      })
    })
  } else {
    return res.status(400).send({
      error: {
        message: 'No user with that e-mail.',
        type: 'no_user_found'
      }
    })
  }
}

/**
 * url: //domain.com/v2/auth/signout
 * @method: GET
 * @param: req
 * @param: res
 * @returns: JSON(msg)
 * Desc: Used to signout user
 */
export let signout = (req, res) => {
  oauth.model.signout(req.oauth.bearerToken.accessToken, () => {
    res.send({
      msg: 'You have been successfully logged out!'
    })
  })
}