
var warp_sessions = null;
var defaultSessionName = null;

function getWarpSessions() {
    if (warp_sessions != null)
        return Promise.resolve(warp_sessions['.sessions']);
    return http.get('http://localhost:41401/sessions')
        .then(function (result) {
            var r = result.data;
            warp_sessions = {};
            r.sessions.forEach(function(s) { warp_sessions[s.name] = s; });
            var obs = r.sessions.map(function(s) { return { namespace: 'warp_dictionary', key: s.name }; });
            warp_sessions['.sessions'] = obs;
            return obs;
        });
}

var warp_dictionaries = {};

function getSessionDictionary(sessionName) {
    var d = warp_dictionaries[sessionName];
    if (d == null || d['.packets'] == null) {
        d = {};
        warp_dictionaries[sessionName] = d;
        return http.get('http://localhost:41401/dictionary/'+sessionName+'/root')
            .then(function(result) {
                var obs = result.data.packets.map(function(p){
                    return { namespace: 'warp_dictionary', key: p.id };
                });
                d[".packets"] = obs;
                return d;
            });
    } else {
        return Promise.resolve(d);
    }
}

function getPacketsForSession(sessionName) {
    return getSessionDictionary(sessionName)
        .then(function(d) {
            //console.log('getPacketsForSession='+JSON.stringify(d[".packets"],null,2));
            return d[".packets"];
        });
}

function getPointsForPacket(sessionName, packetName) {
    return getSessionDictionary(sessionName).then(function(d) {
        var points = d[packetName];
        if (points == null) {
            return http.get('http://localhost:41401/dictionary/'+sessionName+'/id/'+packetName)
                .then(function(result) {
                    d[packetName] = result.data.points;
                    return result.data.points;
                });
        } else {
            return Promise.resolve(points);
        }
    });
}

//var warpSessionsObjectProvider = {
//    get: function (identifier) {
//        return Promise.resolve(
//            identifier.key === 'sessions_root'
//            ? {
//                identifier: identifier,
//                name: 'Sessions',
//                type: 'folder',
//                location: 'ROOT'
//            }
//            : {
//                identifier: identifier,
//                name: identifier.key,
//                type: 'folder',
//                location: 'warp_dictionary:sessions_root'
//            } );
//    }
//};

//var warpSessionsCompositionProvider = {
//    appliesTo: function (domainObject) {
//        return domainObject.identifier.namespace === 'warp_dictionary';
//    },
//    load: function (domainObject) {
//        if (domainObject.identifier.key == 'sessions_root') {
//            return getWarpSessions();
//        } else {
//            var sessionName = domainObject.identifier.key;
//            return getPacketsForSession(sessionName)
//        }
//    }
//};

var warpDictionaryObjectProvider = {
    get: function (identifier) {
        //console.log('getting object for identifier '+JSON.stringify(identifier));
        if (identifier.key === 'dictionary_root') {
            //console.log('  returning dictionary_root');
            return Promise.resolve({
                identifier: identifier,
                name: 'Dictionary',
                type: 'folder',
                location: 'ROOT'
            });
        } else if (identifier.key.indexOf('.')<0) {
            //console.log('  returning packet '+identifier.key);
            return Promise.resolve({
                identifier: identifier,
                name: identifier.key,
                type: 'folder',
                location: 'warp_dictionary:dictionary_root'
            });
        } else {
            //console.log('  returning point '+identifier.key);
            var pointId = identifier.key;
            var index = pointId.indexOf('.');
            var packetId = pointId.substring(0,index);
            var pointName = pointId.substring(1+index);
            return getPointsForPacket(defaultSessionName, packetId)
                .then(function(points) {
                    var rl = points.filter(function (m) { return m.key === pointId; });
                    var r = rl[0];
                    return {
                        identifier: identifier,
                        name: pointName,
                        type: 'warp_telemetry',
                        telemetry: r,
                        location: 'warp_dictionary:' + identifier.key.substring(0,identifier.key.indexOf('.'))
                    }
                });
        }
    }
};

var warpDictionaryCompositionProvider = {
    appliesTo: function (domainObject) {
        return domainObject.identifier.namespace === 'warp_dictionary' &&
               domainObject.type === 'folder';
    },
    load: function (domainObject) {
        if (domainObject.identifier.key == 'dictionary_root') {
            return getPacketsForSession(defaultSessionName)
                .then(function(result) {
                    //console.log('children of '+JSON.stringify(domainObject)+' are\n'+JSON.stringify(result,null,2));                    
                    return result;
                });
        } else if (domainObject.identifier.key.indexOf('.') < 0) {
            return getPointsForPacket(defaultSessionName, domainObject.identifier.key)
                .then(function(points) {
                    var result = points.map(function(p) {
                        return { namespace: 'warp_dictionary', key: p.key };
                    });
                    //console.log('children of '+JSON.stringify(domainObject)+' are\n'+JSON.stringify(result,null,2));
                    return result;
                });
        } else {
            //console.log('children of '+JSON.stringify(domainObject)+' are []');
            return Promise.resolve([]);
        }
    }
};



function WarpDictionaryPlugin(sessionName) {
    return function install(openmct) {
        openmct.objects.addRoot({
            namespace: 'warp_dictionary',
            key: 'dictionary_root'
        });

//        openmct.objects.addProvider('warp.sessions', warpSessionsObjectProvider);
        openmct.objects.addProvider('warp_dictionary', warpDictionaryObjectProvider);

//        openmct.composition.addProvider(warpSessionsCompositionProvider);
        openmct.composition.addProvider(warpDictionaryCompositionProvider);

        openmct.types.addType('warp.sessions', {
            name: 'Telemetry Session',
            description: 'A Telemetry Session Dictionary',
            cssClass: 'icon-telemetry'
        });

        openmct.types.addType('warp_dictionary', {
            name: 'Telemetry Dictionary',
            description: 'A Telemetry Session Dictionary',
            cssClass: 'icon-telemetry'
        });

        openmct.types.addType('warp_telemetry', {
            name: 'Warp Telemetry Point',
            description: 'Warp telemetry point.',
            cssClass: 'icon-telemetry'
        });

        defaultSessionName = sessionName;

    };
};
