// Requirements
const url = require('url')
const mqtt = require('mqtt')
const _ = require('lodash')
const logging = require('homeautomation-js-lib/logging.js')
const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')
const health = require('homeautomation-js-lib/health.js')
const { setTimeout } = require('timers/promises')

// Config
const target_ip = process.env.TARGET_IP
var topic_prefix = process.env.TOPIC_PREFIX


if (_.isNil(target_ip)) {
	logging.warn('empty TARGET_IP, bailing')
	process.abort()
}

if (_.isNil(topic_prefix)) {
	logging.warn('empty topic prefix, using /artnet')
	topic_prefix = '/artnet'
}

var connectedEvent = function() {
    health.healthyEvent()

    const topics = [topic_prefix + '/+/+/set']

    logging.info('Connected, subscribing ')
    topics.forEach(function(topic) {
        logging.info(' => Subscribing to: ' + topic)
        client.subscribe(topic, { qos: 1 })
    }, this)
}

var disconnectedEvent = function() {
    health.unhealthyEvent()
}

// Setup MQTT
const client = mqtt_helpers.setupClient(connectedEvent, disconnectedEvent)

if (_.isNil(client)) {
	logging.warn('MQTT Client Failed to Startup')
	process.abort()
}

const red = [255,0,0]
const green = [0,255,0]
const blue = [0,0,255]
const white = [255,255,255]
const off = [0,0,0]


const percentage = function(in_color, percent) {
    return in_color.map(function(element) {
        return Math.floor(element * (percent / 100))
    })
}

const add = function(color_1, color_2) {
    var result = [0,0,0]
    
    for (let index = 0; index < 3; index++) {
        result[index] = color_1[index] + color_2[index]
    }

    return result
}

const dmxColor = function(rgb) {
    var result = percentage(red, rgb[0])
    result = add(result, percentage(green, rgb[1]))
    result = add(result, percentage(blue, rgb[2]))

    return result
}

const set_color = function(start_channel, in_channels, in_color) {
    var values = []

    for (let index = 0; index < in_channels; index++) {
        values.push.apply(values, in_color)
    }
    
    var options = {
        host: target_ip
    }
     
    var artnet = require('artnet')(options);

    artnet.set(start_channel, values, function (err, res) {
        artnet.close();
    });
}



client.on('message', (topic, message) => {
    logging.info(' ' + topic + ':' + message, {
        topic: topic,
        value: message
    })
    var target = '' + message

    if (topic.indexOf('/set') >= 0) {
        logging.info('Set channels: ' + target, {
            action: 'settarget',
            message: target
        })
        const components = topic.split('/')
        const startChannel = components[components.length - 3] 
        const channels = components[components.length - 2]
        const inputRGB = message.toString().split(',')

        set_color(Number(startChannel), Number(channels), dmxColor(inputRGB))

    }
})