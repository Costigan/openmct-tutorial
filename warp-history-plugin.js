/**
 * Basic historical telemetry plugin.
 */

function WarpHistoryPlugin(sessionName) {
    return function install (openmct) {
        var provider = {
            supportsRequest: function (domainObject) {
                return domainObject.type === 'warp_telemetry';
            },
            request: function (domainObject, options) {
		console.log('getting history for '+JSON.stringify(domainObject));
                var url = 'http://localhost:41401/history/'
		    + sessionName
		    + '?points='
		    + domainObject.telemetry.key +
                    '&start=' + options.start +
                    '&end=' + options.end;

                return http.get(url)
                    .then(function (resp) {
                        return resp.data;
                    });
            }
        };

        openmct.telemetry.addProvider(provider);
    }
}
