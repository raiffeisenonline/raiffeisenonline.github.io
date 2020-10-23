/*
 * API počítá s existujícími číselníky v databázi pro:
 *         trackType
 *         eventType
 * Dále API počítá s fixním seznamem login ID, kterým může být uživatel autentifikován (openId, ibLogin, ...).
 * POZOR: Název enumu není to samé jako label v číselníku v databázi. Např. EventType -> Type v databázi bude "Visit", ne "VISIT".
 *
 * Javascriptové číselníky se nacházejí na začátku definice objektu trask.Analytics = {...}
 *
 */

var trask = trask || {};

var TA = TA || {}; // means Trask Analytics

(function () {

    trask.Common = {
        isString: function (obj) {
            return typeof obj === 'string';
        },
        isUndefined: function (obj) {
            return typeof obj === 'undefined';
        },
        isObject: function (obj) {
            return !!obj && typeof obj === 'object';
        },
        getLocationQueryParameter: function (param) {
            var items = window.location.search.substr(1).split('&');
            for (var i = 0, ii = items.length; i < ii; i++) {
                var splitted = items[i].split('=');
                if (splitted[0] === param) {
                    return decodeURIComponent(splitted[1]);
                }
            }
            return null;
        }
    }

    trask.Analytics = {
        trackType: {
            VISIT: 1,
            EVENT_ACTIVITY: 2,
            EVENT_DISPLAY: 3
            // to be added more
        },
        eventType: {
            COMPONENT_DISPLAYED: 1,
            CALC_COMPUTATION: 2,
            FORM_SENT_SHORT: 3,
            FORM_SENT_FULL: 4,
            COMPONENT_ACTION: 5,
            COMPONENT_MORE_INFO: 6,
            COMPONENT_BACK: 7,
            COMPONENT_CALL_ME: 8,
            COMPONENT_SKIP: 9,
            COMPONENT_REDIRECT: 10,
            COMPONENT_DO_NOT_SHOW: 11,
            COMPONENT_SUBMIT_FORM: 12,
            COMPONENT_SUBMIT_CERTIFY_FORM: 13,
            CTA_CLICK: 14,
            LOGIN_SPB: 15,
            SUBMIT: 16,
            PARTIAL_SUBMIT: 17,
            SEND_PARTY: 18,
            SEND_SMS: 19,
            FORM_FIELD_ACTIVITY: 20
            // to be added more
        },
        componentEventSubType: {
            FORM_FIELD_FOCUS: 1,
            FORM_FIELD_BLUR: 2,
            FORM_FIELD_CHANGE: 3
            // to be added more
        },
        referrerType: {
            DIRECT: 1,
            ORGANIC_SEARCH: 2,
            PAID_SEARCH: 3,
            CAMPAIGN: 4,
            REFERRAL: 5
        },
        referrerSourceType: {
            EXTERNAL: 1,
            INTERNAL: 2
        },
        analyticsServerUrl: TA.analyticsServerUrl,
        jsonObject: {
            common: {
                id: {},
                url: String(window.location), // load here only
                trackingSpace: null, // fill by setTrackingSpace method
                operatorId: null, // fill by setOperatorId method
                userAgentString: navigator.userAgent, // load here only
                language: navigator.language, // load here only
                deviceResolution: window.screen.width + 'x' + window.screen.height, // load here only
                locality: {
                    'loc1': 'val-loc1',
                    'loc2': 'val-loc2' //TODO
                },
                referrer: {
                    type: null,
                    sourceType: null,
                    url: String(document.referrer),
                    campaign: trask.Common.getLocationQueryParameter('campaign'),
                    mediaType: trask.Common.getLocationQueryParameter('mediaType'),
                    mediaPosition: trask.Common.getLocationQueryParameter('mediaPosition')
                }
            },
            list: []
        },

        /**
         * Documentation is in the end of this file.
         */
        setId: function (sessionIdentifier, additionalIdentity) {
            trask.Analytics.jsonObject.common.id = {};
            var id = trask.Analytics.jsonObject.common.id;
            id.cookie = null;//TODO delete this line when remarketing server code will be ready for it
            id.sessionIdentifier = sessionIdentifier;
            if (additionalIdentity) {
                for (var key in additionalIdentity) {
                    id[key] = additionalIdentity[key];
                }
            }
        },

        /**
         * Documentation is in the end of this file.
         */
        setReferrer: function (type, sourceType) {
            var referrer = trask.Analytics.jsonObject.common.referrer;
            referrer.type = type;
            referrer.sourceType = sourceType;
        },
 
        setTrackingSpace: function (trackingSpace) {
            trask.Analytics.jsonObject.common.trackingSpace = trackingSpace;
        },
 
        setOperatorId: function (operatorId) {
            trask.Analytics.jsonObject.common.operatorId = operatorId;
        },

        /**
         * Documentation is in the end of this file.
         */
        push: function (trackType, dataObject, doNotSend) {
            if (trask.Common.isUndefined(trackType)) {
                trask.Analytics.send();
                return;
            }

            var jsonObject = trask.Analytics.jsonObject;
            var item = new trask.AnalyticsObject(trackType);

            if (trask.Common.isObject(dataObject)) {
                // event
                if (!trask.Common.isUndefined(dataObject.eventType) && dataObject.eventType !== null) {
                    item.setEventTypeId(dataObject.eventType);
                }

                // acrm
                if (trask.Common.isObject(dataObject.acrm)) {
                    item.setAcrm(dataObject.acrm[0], dataObject.acrm[1]);
                }

                // component
                if (trask.Common.isObject(dataObject.component)) {
                    item.setComponent(dataObject.component[0], dataObject.component[1], dataObject.component[2], dataObject.component[3]);
                }

                // campaign
                if (trask.Common.isObject(dataObject.campaign)) {
                    item.setCampaign(dataObject.campaign[0], dataObject.campaign[1]);
                }

                // component external
                if (trask.Common.isObject(dataObject.componentExternal)) {
                    item.setComponentExternal(dataObject.componentExternal[0]);
                }

                // page part
                if (trask.Common.isObject(dataObject.pagePart)) {
                    item.setPagePart(dataObject.pagePart[0]);
                }

                // targetUrl
                if (typeof dataObject.targetUrl === 'string') {
                    item.setTargetUrl(dataObject.targetUrl);
                }

                // extensionData
                if (trask.Common.isObject(dataObject.extensionData)) {
                    item.setExtensionData(dataObject.extensionData);
                }
            }


            // add to item list
            jsonObject.list.push(item.rawObject);

            // send or exit
            if (doNotSend !== true) {
                trask.Analytics.send();
            }
        },




        /**
         * Documentation is in the end of this file.
         */
        send: function (successCallback) {
            if (typeof successCallback !== 'function') {
                successCallback = function() {};
            }
            var xhr = new XMLHttpRequest();
            if ('withCredentials' in xhr) {
                xhr.open('POST', trask.Analytics.analyticsServerUrl, true);

            // fixing IE8 & IE9
            } else if (typeof XDomainRequest !== 'undefined') {
                xhr = new XDomainRequest();
                try {
                    xhr.open('POST', trask.Analytics.analyticsServerUrl);
                } catch (ex) {
                    successCallback.call();
                }
            } else {
                successCallback.call();
                return;
            }
            xhr.onload = function () {
                successCallback.call();
            }
            xhr.onerror = function () {
                successCallback.call();
            }

            var serializedData = trask.Analytics._getSerializedData();

            // fixing IE9
            setTimeout(function () {
                xhr.send(serializedData);
            }, 0);
        },

        _getSerializedData: function (doNotDestroyItemList) {
            var jsonString = JSON.stringify(trask.Analytics.jsonObject);
            if (doNotDestroyItemList !== true) {
                trask.Analytics.jsonObject.list = [];
            }
            return jsonString;
        }

    };

    trask.AnalyticsObject = function (trackTypeId) {
        // raw object is a tracking-item
        this.rawObject = {
            trackTypeId: trackTypeId,
            eventTypeId: null,
            acrm: null,
            component: null,
            campaign: null,
            componentExternal: null,
            pagePart: null,
            targetUrl: null,
            extensionData: null
        };

        this.setEventTypeId = function (eventTypeId) {
            this.rawObject.eventTypeId = eventTypeId;
        };

        this.setAcrm = function (category, type) {
            this.rawObject.acrm = {};
            this.rawObject.acrm.acrmCategory = category;
            this.rawObject.acrm.acrmType = type;
        };

        this.setComponent = function (cmsId, type, label, componentEvent) {
            this.rawObject.component = {};
            this.rawObject.component.cmsIdentifier = cmsId;
            this.rawObject.component.componentType = type;
            this.rawObject.component.label = label;
            if (trask.Common.isObject(componentEvent) && (componentEvent.eventSubType && componentEvent.formFieldName)) {
                this.rawObject.component.componentEvent = {};
                this.rawObject.component.componentEvent.eventSubType = componentEvent.eventSubType;
                this.rawObject.component.componentEvent.formFieldName = componentEvent.formFieldName;
                this.rawObject.component.componentEvent.formFieldValue = componentEvent.formFieldValue;
            }
        };

        this.setCampaign = function (cmsId, label) {
            this.rawObject.campaign = {};
            this.rawObject.campaign.cmsIdentifier = cmsId;
            this.rawObject.campaign.label = label;
        };

        this.setComponentExternal = function (externalIdentifier) {
            this.rawObject.componentExternal = {};
            this.rawObject.componentExternal.externalIdentifier = externalIdentifier;
        };

        this.setPagePart = function (name) {
            this.rawObject.pagePart = {};
            this.rawObject.pagePart.name = name;
        };

        this.setTargetUrl = function (targetUrl) {
            this.rawObject.targetUrl = targetUrl;
        };
        
        this.setExtensionData = function (extensionData) {
            this.rawObject.extensionData = extensionData;
        };
    }



    //
    //
    // EXPOSED objects and functions
    //
    //

    /**
     * This FUNCTION should be always called right after TA.init() -> before pushing anything!
     * TODO: Load identifiers here - by this javascript, so no TA.setId will be needed.
     *
     * examples:
     * TA.setId('Session_ASJK_01', {'openId': 'openID_87324'})
     *
     */
    TA.setId = trask.Analytics.setId;

    /**
     * This FUNCTION should be always called right after TA.setId() -> before pushing anything!
     *
     * examples:
     * TA.setReferrer(TA.referrerType.ORGANIC_SEARCH, TA.referrerSourceType.EXTERNAL)
     *
     */
    TA.setReferrer = trask.Analytics.setReferrer;
    
    /**
     * This FUNCTION can optionally be called before first TA.push(...)
     *
     * examples:
     * TA.setTrackingSpace("iPhoneApp")
     *
     */
    TA.setTrackingSpace = trask.Analytics.setTrackingSpace;
    
    /**
     * This FUNCTION can optionally be called before first TA.push(...)
     *
     * examples:
     * TA.setOperatorId("Paegas")
     *
     */
    TA.setOperatorId = trask.Analytics.setOperatorId;


    /**
     * This FUNCTION creates a new jsonObject and send it to analytics server.
     * When doNotSend === true, jsonObject (with one item) is not sent and waits until next push() or send().
     * Use next push to send jsonObject or use TA.send() method.
     *
     * examples:
     * TA.push(TA.trackType.VISIT, { acrm: ['acrm_category_1', 'acrm_type_2'] }); // creates jsonObject and send
   * TA.push(TA.trackType.VISIT, { acrm: ['acrm_category_1', 'acrm_type_2'], referrer: ['referrer_type_1', 'referrer_source_type_1'] }); // creates jsonObject and send
     * TA.push(TA.trackType.DISPLAY, { eventType: TA.event.CALC_COMPUTATION, component: ['cmsID_32987', 'CALC', 'Kalkulačka1'] }); // creates jsonObject and send
     * TA.push(TA.trackType.DISPLAY, { campaign: ['cmsID_jdf234', 'Hypodny'] }); // creates jsonObject and send
     * 
     * TA.push(TA.trackType.EVENT_ACTIVITY, { eventType: TA.event.FORM_FIELD_ACTIVITY,
     *         component: ['cmsID_32988', 'FORM', 'ZUD', { eventSubType: TA.componentEventSubType.FORM_FIELD_BLUR, formFieldName: 'surname', formFieldValue: 'Novák' }] }); // creates jsonObject and send
     *
     * TA.push(TA.trackType.DISPLAY, { campaign: ['cmsID_jdf234', 'Hypodny'] }, true); // creates item
     * TA.push(TA.trackType.DISPLAY, { component: ['cmsID_32987', 'CALC', 'Kalkulačka1'] }, true); // creates another item (there are now 2 items inside jsonObject)
     * TA.push(); // sends jsonObject with both items to server, one can also use TA.send(successCallback) for that
     *
     * You can combine anything inside dataObject parameter.
     *
     */
    TA.push = trask.Analytics.push;

    /**
     * Use this FUNCTION to send object(s) from queue.
     * If no objects found, nothing happens.
     *
     * examples:
     * TA.send();
     * TA.send(successCallback);
     *
     */
    TA.send = trask.Analytics.send;

    /**
     * trackType ENUM, see examples for TA.push method
     */
    TA.trackType = trask.Analytics.trackType;

    /**
     * eventType ENUM, see examples for TA.push method;
     */
    TA.eventType = trask.Analytics.eventType;
    TA.componentEventSubType = trask.Analytics.componentEventSubType;

    /**
     * eventType ENUM, see examples for TA.push method;
     */
    TA.referrerType = trask.Analytics.referrerType;

    /**
     * eventType ENUM, see examples for TA.push method;
     */
    TA.referrerSourceType = trask.Analytics.referrerSourceType;

})();
