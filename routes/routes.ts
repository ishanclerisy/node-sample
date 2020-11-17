import * as express from 'express'
import * as multer from 'multer'
import * as alerts from '../src/controllers/alerts'
import * as auth from '../src/controllers/auth'
import * as portfolios from '../src/controllers/portfolios'
import * as product from '../src/controllers/product'
import * as profile from '../src/controllers/profile'
// import * as subscribe from '../src/controllers/subscribe'
import * as transactions from '../src/controllers/transactions'
import { changePasswordValidator, createAlertValidator, createPortfolioValidator, resetPasswordGetValidator, resetPasswordPostValidator, resetValidator, signupValidator, subscribeValidator, updateAlertValidator, updatePortfolioValidator } from '../src/utils/validator'

const oauthserver = require("oauth2-server")
const router = express.Router()
export default router

const oauth = oauthserver({
  model: require('../../expressOAUTHModel'),
  grants: ['password'],
  debug: true
})
const upload = multer({
  dest: 'amit-endpoints/uploads/tmp'
})

/**
 * Authentication routes
 */
router.post('/auth/login', oauth.grant())
router.post('/auth/register', signupValidator, auth.signup)
router.get('/auth/verify', auth.verify)
router.get('/auth/resendVerification', oauth.authorise(), auth.resendVerificationLink)
router.post('/auth/changePassword', oauth.authorise(), changePasswordValidator, auth.changeUsersPassword)
router.get('/auth/resetPassword', resetPasswordGetValidator, auth.resetPasswordForm)
router.post('/auth/resetPassword', resetPasswordPostValidator, auth.resetPassword)
router.post('/auth/reset', resetValidator, auth.reset)
router.get('/auth/signout', oauth.authorise(), auth.signout)

/**
 * Profile routes
 */
router.get('/me', oauth.authorise(), profile.profile)
router.post('/me/profilePicture', oauth.authorise(), upload.single('file'), profile.uploadImagetoBucket)
router.get('/me/deleteSubscription', oauth.authorise(), profile.deleteSubscriptions)


/**
 * Routes related to products
 */
router.get('/jibla-products/all', product.allJiblaProducts)
router.get('/jibla-products', product.jiblaProducts)
router.get('/products', product.product)

/**
 * Routes for alerts
 */
router.get('/alerts', oauth.authorise(), oauth.model.hasActiveSubscription, alerts.getAlerts)
router.get('/alerts/:id', oauth.authorise(), oauth.model.hasActiveSubscription, alerts.getAlert)
router.post('/alerts', oauth.authorise(), oauth.model.hasActiveSubscription, createAlertValidator, alerts.createUpdateAlert)
router.put('/alerts', oauth.authorise(), oauth.model.hasActiveSubscription, updateAlertValidator, alerts.createUpdateAlert)
router.delete('/alerts/:id', oauth.authorise(), oauth.model.hasActiveSubscription, alerts.deleteAlert)

/**
 * Routes for portfolios
 */
router.get('/oldPortfolios', oauth.authorise(), oauth.model.hasActiveSubscription, portfolios.getOldPortfolios)
router.get('/portfolios', oauth.authorise(), oauth.model.hasActiveSubscription, portfolios.getPortfolios)
router.get('/portfolios/:id', oauth.authorise(), oauth.model.hasActiveSubscription, portfolios.getPortfolio)
router.post('/portfolios', oauth.authorise(), oauth.model.hasActiveSubscription, createPortfolioValidator, portfolios.createUpdatePortfolio)
router.put('/portfolios', oauth.authorise(), oauth.model.hasActiveSubscription, updatePortfolioValidator, portfolios.createUpdatePortfolio)
router.delete('/portfolios/:id', oauth.authorise(), oauth.model.hasActiveSubscription, portfolios.deletePortfolio)

/**
 * Routes for transactions
 */
router.get('/transactions', oauth.authorise(), transactions.getUserTransactions)

router.get('/test',(req, res) => {
  return res.render('resetPass', {
    title: 'Reset password',
    token: 'req.query.token'
  })
})

router.get('/test1', profile.saveJiblaProducts)
/**
 * Routes for subscription
 */
// router.post('/subscribe', oauth.authorise(), subscribeValidator, subscribe.subscribe)

/**
 * Oauth Server error handler
 */
router.use(oauth.errorHandler())

/**
 * Handler for 404 error
 */
router.all("*", (req, res) => {
  return res.status(404).send({
    error: {
      message: 'No route found to handle such request.',
      type: 'no_route_found',
    },
  })
})
