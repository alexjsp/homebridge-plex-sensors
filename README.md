# Homebridge Sensors for Plex

This plugin for [Homebridge](https://github.com/nfarina/homebridge) adds sensor(s) to HomeKit that are triggered by Plex playbacks.  You can use these sensors to trigger HomeKit scenes when Plex starts and stops playback.

![Example image of a Homebridge Sensor for Plex](Images/Example.png?raw=true "Example image of a Homebridge Sensor for Plex")

Automatically dim the lights when you start watching TV, or turn them off completely for a movie.  With advanced HomeKit automations you can even trigger different scenes depending on the time of day.

Plex Sensors uses Plex's [webhooks](https://support.plex.tv/articles/115002267687-webhooks/) feature to get notified by your Plex server _immediately_ when playback starts and stops, without needing to constantly poll your server.

Note: Because [webhooks](https://support.plex.tv/articles/115002267687-webhooks/) require Plex Pass for the Plex Media Server account, this plugin also effectively requires Plex Pass.

## Installation

You can install this homebridge plugin with npm:

```
sudo npm install -g homebridge-plex-sensors
```

Go to the [Homebridge](https://github.com/nfarina/homebridge) page to read more about installing and configuring Homebridge.

### Setting up the Webhook

For this plugin to receive playback events, you need to add a webhook to your Plex account.  You can do this by visiting:

[https://app.plex.tv/desktop#!/account/webhooks](https://app.plex.tv/desktop#!/account/webhooks)

On that page, click `ADD WEBHOOK` and then enter the IP of your homebridge server with the port used by this plugin (by default `22987` but this can be changed in the config file).  So for example enter `http://192.168.1.100:22987/` if you kept the default port, and your IP address is `192.168.1.100`.

Note: to work with Plex servers outside your local network you'll need to expose the address used to the outside world via port forwarding etc.

## Configuration

Plex Sensors supports various configuration options to suit your needs, and runs as a homebridge platform so it can add multiple sensors for different types of playback.

Your config for the platform should include a `sensors` object that can contain any number of sensors with different configurations (each sensor can filter events, eg. only movie events on the living room player).  Those sensor objects can include the following variables:

Variable | Description
-------- | -----------
`name` | This will be the name of this sensor, it must be included and unique.
`types` | (Optional) This is an array of types for which playback can trigger the sensor. (Valid types include `movie`, `episode`, `track`, `photo`)
`players` | (Optional) This is an array of player names or UUIDs for players that will trigger the sensor. (To find out your player name you can check the [Now Playing section of Plex Web](https://app.plex.tv/desktop#!/status/playing) while that player is playing, or enable the `logSeenPlayersAndUsers` setting described below which will also log UUID values as an alternative to names)
`users` | (Optional) This is an array of user names for users that will trigger the sensor. (To find out your user name you can check the [Now Playing section of Plex Web](https://app.plex.tv/desktop#!/status/playing) while that user is playing)
`genres` | (Optional) This is an array of genre strings. If set, movie playbacks will only trigger the sensor if the movie's genre matches one or more of the genres in this array.
`ignorePauseResume` | (Optional - default: false) If set to true the sensor will remain "triggered" while playback is paused. By default paused players will untrigger the sensor.
`customFilters` | (Optional / Advanced) Custom filters allow you to filter for specific properties on the JSON events that the above use cases don't cover. For example you could make a sensor only triggered by playing a specific TV Show or movie. See [Plex's article on Webhooks](https://support.plex.tv/articles/115002267687-webhooks/) for more details of what is passed in webhook events.

Additionally, you can set the following settings globally, outside of the `sensors` object:

Variable | Description
-------- | -----------
`logSeenPlayersAndUsers` | (Optional - default: false) Setting this to true will log every player device name and username that the plugin sees starting a playback from the webhook, potentially useful for figuring out device names.
`delayOff` | (Optional - default: 0) Setting this to a value above 0 will delay the occupancy sensor being untriggered when playback is stopped. This timeout is measured in milliseconds.
`debug` | (Optional - default: false) Setting this to true will log every webhook and how it is handled by the plugin's logic. You should probably leave this false, but you might find it useful for looking at the entire contents of a webhook payload.


### Example Configs

Example config with one sensor triggered by any Plex playback by your account or from your server:
```json
{
"platforms": [
  {
    "platform": "homebridge-plex-sensors.Plex",
    "sensors": [
      {
        "name": "Plex Playing"
      }
    ]
  }
]
}
```

Example config with a sensor triggered by TV show playbacks, and a sensor triggered by movie playbacks (both filtered to a specific user and player):
```json
{
"platforms": [
  {
    "platform": "homebridge-plex-sensors.Plex",
    "sensors": [
      {
        "name": "Movie Playing",
        "types": ["movie"],
        "players": ["Living Room"],
        "users": ["MyUserName"]
      },
      {
        "name": "TV Playing",
        "types": ["episode"],
        "players": ["Living Room"],
        "users": ["MyUserName"]
      }
    ]
  }
]
}
```

Example config with a horror movie genre-specific sensor:
```json
{
"platforms": [
  {
    "platform": "homebridge-plex-sensors.Plex",
    "sensors": [
      {
        "name": "Horror Movie",
        "types": ["movie"],
        "genres": ["Horror"]
      }
    ]
  }
]
}
```

Example config with a sensor triggered only by playing the TV show Breaking Bad (also shows a custom port number being set for the webhook server):
```json
{
"platforms": [
  {
    "platform": "homebridge-plex-sensors.Plex",
    "port": "22988",
    "sensors": [
      {
        "name": "Breaking Bad is on",
        "types": ["episode"],
        "customFilters":
        {
          "Metadata.grandparentTitle": "Breaking Bad"
        }
      }
    ]
  }
]
}
```

Example config with the `logSeenPlayersAndUsers` setting to `true` for helping you figure out device names:
```json
{
"platforms": [
  {
    "platform": "homebridge-plex-sensors.Plex",
    "logSeenPlayersAndUsers": true,
    "sensors": [
      {
        "name": "Plex Playing",
      }
    ]
  }
]
}
```
