var http = require('http');

var Accessory, Characteristic, Consumption, Service, TotalConsumption, UUIDGen;

// Setting debug = true presents copious, unneeded logs
var debug = false;

var pluginName = "homebridge-plex-sensors";
var platformName = "Plex";

module.exports = function (homebridge) {
    Accessory = homebridge.platformAccessory;
    Characteristic = homebridge.hap.Characteristic;
    Service = homebridge.hap.Service;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform(pluginName, platformName, Plex, true);
}

function Plex(log, config, api) {
    if (!config) {
        log.warn("Ignoring Plex Sensors because it is not configured");
        this.disabled = true;
        return;
    }
    this.log = log;
    this.api = api;
    this.accessories = {};
    this.sensors = config["sensors"];
    this.port = config["port"] || '22987';
    this.logSeenPlayersAndUsers = config["logSeenPlayersAndUsers"] || false;
    this.delayOff = config["delayOff"] || 0;
    this.timer;
    debug = config["debug"] || false;
    var self = this;
        
    this.server = http.createServer(function(request, response) {
        let body = [];
        request.on('data', (chunk) => {
          body.push(chunk);
        }).on('end', () => {
          body = Buffer.concat(body).toString();
          self.httpHandler(self, body);
          response.end("");
        });
    });
    
    this.server.listen(this.port, function(){
        self.log("Homebridge Plex Sensors listening for webhooks on: http://<homebridge ip>:%s", self.port);
    });

    this.api.on('didFinishLaunching', function() {
        for(var sensor of self.sensors)
        {
            if (!sensor.hasOwnProperty("service"))
            {
                var uuid = UUIDGen.generate(sensor.name);
                if (!self.accessories[uuid])
                {
                    self.log("Adding '"+sensor.name+"' sensor.");
                    var accessory = new Accessory(sensor.name, uuid);
                                        
                    var service = accessory.addService(Service.OccupancySensor, sensor.name);
                    
                    self.accessories[uuid] = accessory;
                    sensor.service = service;
                    sensor.accessory = accessory;
                    self.api.registerPlatformAccessories(pluginName, platformName, [accessory]);
                }
            }
            sensor.activePlayers = new Set();
            
            if (sensor.genres)
            {
                for (var i = 0; i < sensor.genres.length; i++)
                {
                    sensor.genres[i] = sensor.genres[i].toLowerCase();
                }
            }
            
            var informationService = sensor.accessory.getService(Service.AccessoryInformation);
            informationService
              .setCharacteristic(Characteristic.Manufacturer, "Homebridge Sensors for Plex")
              .setCharacteristic(Characteristic.Model, "Plex Sensor")
              .setCharacteristic(Characteristic.SerialNumber, sensor.name);
        }
        
        var deleteAccessories = new Array();
        for (var accessoryUUID in self.accessories)
        {
            var accessory = self.accessories[accessoryUUID];
            var foundInSensors = false;
            for(var sensor of self.sensors)
            {
                if (accessory.services[1].displayName == sensor.name)
                {
                    foundInSensors = true;
                }
            }
            
            if (!foundInSensors)
            {
                delete self.accessories[accessory.UUID];
                deleteAccessories.push(accessory);
                self.log("Removing old '"+accessory.displayName+"' sensor no longer in config.");
            }
        }
        self.api.unregisterPlatformAccessories(pluginName, platformName, deleteAccessories);
    });
}

Plex.prototype.configureAccessory = function(accessory) {
    this.log("Configuring '"+accessory.displayName+"' sensor.");
    this.accessories[accessory.UUID] = accessory;
    for(var sensor of this.sensors)
    {
        if (accessory.services[1].displayName == sensor.name)
        {
            sensor.accessory = accessory;
            sensor.service = accessory.services[1];
            sensor.activePlayers = new Set();
        }
    }
}

Plex.prototype.debugLog = function(string)
{
    if (debug)
    {
        this.log(string);
    }
}

Plex.prototype.httpHandler = function(self, body) {
    var jsonStart = body.indexOf("{");
    var json = body.substring(jsonStart, body.indexOf("\n", jsonStart));
    var event;
    try {
        event = JSON.parse(json);
    }
    catch(e) {
        self.debugLog("Webhook URL called without JSON body.");
    }
    
    if (!event)
    {
        return;
    }
    
    self.debugLog("Plex incoming webhook");

    // Ignore non playback events
    if (event.event != "media.play"
        && event.event != "media.resume"
        && event.event != "media.stop"
        && event.event != "media.pause")
    {
        return;
    }
    
    if ((self.logSeenPlayersAndUsers || debug)
        && event.event == "media.play")
    {
        self.log("Seen player: \""+event.Player.title+"\" (with UUID: \""+event.Player.uuid+"\")");
        self.log("Seen user: \""+event.Account.title+"\"");
    }
    
    self.debugLog("Processing event: "+json);
    
    for (var sensor of self.sensors) {
        self.processEvent(self, event, sensor);   
    }
}

Plex.prototype.processEvent = function(self, event, sensor) {
    if (sensor.users
        && sensor.users.length > 0
        && sensor.users.indexOf(event.Account.title) == -1)
    {
        self.debugLog("Event doesn't match users for sensor: "+sensor.name);
        return;
    }
    if (sensor.players
        && sensor.players.length > 0
        && sensor.players.indexOf(event.Player.title) == -1
        && sensor.players.indexOf(event.Player.uuid) == -1)
    {
        self.debugLog("Event doesn't match players for sensor: "+sensor.name);
        return;
    }
    if (sensor.types
        && sensor.types.length > 0
        && sensor.types.indexOf(event.Metadata.type) == -1)
    {
        self.debugLog("Event doesn't match types for sensor: "+sensor.name);
        return;
    }
    if (sensor.genres
        && sensor.genres.length > 0)
    {
        var matches = false;
        self.debugLog("Testing genres for sensor: "+sensor.name);
        if (!event.Metadata.Genre
            || event.Metadata.Genre.length == 0)
        {
            self.debugLog("Event doesn't match genres for sensor: "+sensor.name);
            return;
        }
        
        for (var genre of event.Metadata.Genre)
        {
            if (sensor.genres.indexOf(genre.tag.toLowerCase()) > -1)
            {
                self.debugLog("Matched genre: "+genre.tag);
                matches = true;
            }
        }
        
        if (!matches)
        {
            self.debugLog("Event doesn't match genres for sensor: "+sensor.name);
            return;
        }
    }
    if (sensor.customFilters)
    {
        for (var filterPath of Object.keys(sensor.customFilters))
        {
            var eventValue = filterPath.split('.').reduce((previous, current) => {
                return previous[current];
            }, event);
            if (eventValue != sensor.customFilters[filterPath])
            {
                self.debugLog("Event doesn't match custom filter for sensor: "+sensor.name);
                return;
            }
        }
    }
    
    if (event.event == "media.play" || (event.event == "media.resume" && !sensor.ignorePauseResume))
    {
        clearTimeout(this.timeout)
        if (sensor.activePlayers.size == 0)
        {
            self.debugLog("Event triggered sensor on: "+sensor.name);
        }
        sensor.activePlayers.add(event.Player.uuid);
        sensor.service.getCharacteristic(Characteristic.OccupancyDetected).updateValue(true);
    }
    else if (event.event == "media.stop" || (event.event == "media.pause" && !sensor.ignorePauseResume))
    {
        sensor.activePlayers.delete(event.Player.uuid);
        if (sensor.activePlayers.size == 0)
        {
            self.debugLog("Event scheduled sensor off: "+sensor.name+" after "+this.delayOff+"ms");
            this.timeout = setTimeout(function() {
                self.debugLog("Event triggered sensor off: "+sensor.name);
                sensor.service.getCharacteristic(Characteristic.OccupancyDetected).updateValue(false);
            }.bind(this), this.delayOff);
        }
    }
    else
    {
        self.debugLog("Pause / Resume event ignored for sensor: "+sensor.name);
    }
}

Plex.prototype.getPlaying = function (callback) {
    callback(null, this.playing);
}

Plex.prototype.getServices = function () {
    var services = [];
    for (var sensor of this.sensors) {
        services.push(sensor.service);
    }
    return services;
}
