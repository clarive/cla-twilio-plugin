var reg = require('cla/reg');

reg.register('config.twilio', {
    name: 'Twilio configuration',
    metadata: [{
        id: 'baseUrl',
        label: _('Base URL'),
        default: "https://${userSid}:${authToken}@api.twilio.com/2010-04-01/"
    }, {
        id: 'makeCall',
        label: _('Make call'),
        default: "Accounts/${userSid}/Calls.json"
    }]
});


reg.register('service.twilio.call', {
    name: _('Twilio call'),
    icon: '/plugin/cla-twilio-plugin/icon/twilio.svg',
    form: '/plugin/cla-twilio-plugin/form/twilio-call-form.js',
    rulebook: {
        moniker: 'twilio_call',
        description: _('Twilio calls'),
        required: ['twilio_resource', 'default_number'],
        allow: [ 'twilio_resource', 'default_number', 'twilio_number', 'destination_number', 'correspondance'],
        mapper: {
            'twilio_resource':'twilioCi',
            'default_number':'defaultNumber',
            'twilio_number':'twilioNumber',
            'destination_number':'destinationNumber'
        },
        examples: [{
            twilio_call: {
                twilio_resource: 'twilio_resource',
                default_number: '1',
                correspondance: {
                    title : "${title}",
                    description : "${description}",
                    status : "${name_status}"
                }
            }
        }]
    },
    handler: function(ctx, params) {
        var ci = require("cla/ci");
        var log = require('cla/log');
        var web = require("cla/web");
        var db = require("cla/db");
        var conf = require("cla/config");

        var agent = web.agent();
        var twilioCiMid = params.twilioCi || "";
        var correspondance = params.correspondance || "";
        var parameters = "";

        for (var key in correspondance) {
            parameters += key + "=" + encodeURI(correspondance[key]) + "&";
        }
        parameters = parameters.substring(0, parameters.length - 1);

        var twilioCi = ci.findOne({
            mid: twilioCiMid + ""
        });
        if (!twilioCi) {
            log.fatal(_("Twilio CI doesn't exist"));
        }
        var userSid = twilioCi.userSid;
        var authToken = twilioCi.authToken;
        var templateUrl = twilioCi.responseUrl;
        var twilioNumber = "";
        var destinationNumber = "";


        if ((params.defaultNumber && params.defaultNumber != '0' && params.defaultNumber != false) && (params.defaultNumber == '1' || params.defaultNumber == true)) {
            twilioNumber = twilioCi.twilioNumber;
            destinationNumber = twilioCi.destinationNumber;
        } else {
            twilioNumber = params.twilioNumber;
            destinationNumber = params.destinationNumber;
        }

        if (userSid == "" || authToken == "" || twilioNumber == "" || destinationNumber == "" || templateUrl == "") {
            log.fatal(_("Missing fields in Twilio form"));
        }
        var responseUrl = templateUrl + "?" + parameters;
        var mapObj = {
            userSid: userSid,
            authToken: authToken
        };
        var config = conf.get("config.twilio");
        var twilioUrl = config.baseUrl + config.makeCall;
        var valores = twilioUrl.match(/\$\{(.*?)\}/gi);

        var configHash = {};
        for (var i = 0; i < valores.length; i++) {
            configHash[valores[i]] = twilioCi[valores[i].substring(2, valores[i].length - 1)];
        }

        var replaceString = RegExp(valores.join("|"), "gi");
        var completeUrl = twilioUrl.replace(replaceString, function(matched) {
            return configHash[matched];
        });
        var response = agent.postForm(completeUrl, {
            To: destinationNumber,
            From: twilioNumber,
            Url: responseUrl
        });

        log.info(_("Call done"), response);

        return response;
    }
});